import { buildAnalyticsContextQuery, type AnalyticsQueryContext } from './analytics-context';
import { getBreakdown, type ExploreDimension } from './breakdown';
import { request } from './request';
import { normalizeSessionTimestamp } from './session-timestamp';
import { loadConnection } from '@/storage/connection';

export type EventCategory = 'custom' | 'outbound' | 'button_click' | 'form_submit' | 'copy';
export type RankingKind = ExploreDimension | EventCategory;
export type RankingItem = { value: string; count: number; percentage?: number };
export type Ranking = { items: RankingItem[]; totalCount: number; nextPage: number | null };
export const weeklyMetrics = {
  users: 'Unique Visitors', pageviews: 'Pageviews', sessions: 'Sessions',
  bounce_rate: 'Bounce Rate', pages_per_session: 'Pages per Session', session_duration: 'Session Duration',
} as const;
export type WeeklyMetric = keyof typeof weeklyMetrics;
export type HourlyPoint = { day: number; hour: number; metrics: Partial<Record<WeeklyMetric, number>> };

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Unexpected chart response from Rybbit.');
  return value as Record<string, unknown>;
}

async function chartRequest(context: AnalyticsQueryContext, path: string, signal: AbortSignal, params: Record<string, string> = {}) {
  const config = await loadConnection();
  if (!config) throw new Error('Configure your Rybbit connection first.');
  if (config.baseUrl !== context.serverUrl) throw new Error('The analytics connection changed. Try again.');
  const query = buildAnalyticsContextQuery(context);
  for (const [key, value] of Object.entries(params)) query.set(key, value);
  return object(await request(config, `/sites/${encodeURIComponent(context.siteId)}/${path}?${query}`, signal)).data;
}

const eventCategories = new Set<string>(['custom', 'outbound', 'button_click', 'form_submit', 'copy']);
export async function getExploreRanking(context: AnalyticsQueryContext, kind: RankingKind, signal: AbortSignal, page = 1): Promise<Ranking> {
  if (!eventCategories.has(kind)) {
    const result = await getBreakdown({ context, dimension: kind as ExploreDimension, page, limit: 100 }, signal);
    return { items: result.items, totalCount: result.totalCount, nextPage: result.nextPage };
  }
  const path = kind === 'custom' ? 'events/names' : kind === 'outbound' ? 'events/outbound' : 'events/autocapture';
  const data = await chartRequest(context, path, signal, kind === 'custom' || kind === 'outbound' ? {} : { type: kind });
  if (!Array.isArray(data)) throw new Error('Unexpected event chart response from Rybbit.');
  const field = kind === 'custom' ? 'eventName' : kind === 'outbound' ? 'url' : 'value';
  const seen = new Set<string>();
  const items = data.map(value => {
    const row = object(value);
    const label = row[field];
    if (typeof label !== 'string' || typeof row.count !== 'number' || !Number.isSafeInteger(row.count) || row.count < 0 || seen.has(label)) {
      throw new Error('Unexpected event chart metrics from Rybbit.');
    }
    seen.add(label);
    return { value: label, count: row.count };
  }).sort((a, b) => b.count - a.count);
  return { items, totalCount: items.length, nextPage: null };
}

export async function getCompleteRanking(context: AnalyticsQueryContext, kind: RankingKind, signal: AbortSignal, load = getExploreRanking): Promise<Ranking> {
  const items: RankingItem[] = [];
  const seen = new Set<string>();
  let page: number | null = 1;
  let totalCount = 0;
  while (page !== null) {
    if (signal.aborted) throw new Error('Cancelled');
    const result = await load(context, kind, signal, page);
    for (const item of result.items) {
      if (!seen.has(item.value)) { seen.add(item.value); items.push(item); }
    }
    totalCount = result.totalCount;
    const next = result.nextPage;
    if (next !== null && next <= page) throw new Error('Unexpected ranking pagination from Rybbit.');
    page = next;
  }
  if (signal.aborted) throw new Error('Cancelled');
  return { items, totalCount: Math.max(items.length, totalCount), nextPage: null };
}

// Time-series SQL timestamps are wall-clock times in the requested timezone,
// unlike session timestamps. Only explicitly zoned ISO timestamps need conversion.
export function parseHourlyPoints(data: unknown, timeZone: string): HourlyPoint[] {
  if (!Array.isArray(data)) throw new Error('Unexpected weekly trend response from Rybbit.');
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' });
  return data.map(value => {
    const row = object(value);
    if (typeof row.time !== 'string') throw new Error('Unexpected weekly trend timestamp from Rybbit.');
    const normalized = normalizeSessionTimestamp(row.time);
    const date = new Date(normalized);
    let calendar = date;
    let hour = date.getUTCHours();
    if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(row.time)) {
      const parts = formatter.formatToParts(date);
      const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(part => part.type === type)?.value);
      calendar = new Date(Date.UTC(get('year'), get('month') - 1, get('day')));
      hour = get('hour');
    }
    const metrics: HourlyPoint['metrics'] = {};
    for (const metric of Object.keys(weeklyMetrics) as WeeklyMetric[]) {
      const number = row[metric];
      if (number === undefined || number === null) continue;
      if (typeof number !== 'number' || !Number.isFinite(number) || number < 0 || (metric === 'bounce_rate' && number > 100)) {
        throw new Error('Unexpected weekly trend metrics from Rybbit.');
      }
      metrics[metric] = number;
    }
    if (metrics.users === undefined || metrics.pageviews === undefined) throw new Error('Unexpected weekly trend metrics from Rybbit.');
    return { day: (calendar.getUTCDay() + 6) % 7, hour, metrics };
  });
}

export async function getWeeklyTrend(context: AnalyticsQueryContext, signal: AbortSignal): Promise<HourlyPoint[]> {
  return parseHourlyPoints(await chartRequest(context, 'overview/time-series', signal, { bucket: 'hour' }), context.timeZone);
}

// Match Rybbit Web: average hourly buckets for each weekday/hour combination.
export function weeklyHeatmap(points: readonly HourlyPoint[], metric: WeeklyMetric): (number | null)[][] {
  const sums = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  const counts = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  for (const point of points) {
    const value = point.metrics[metric];
    if (value === undefined) continue;
    sums[point.day][point.hour] += value;
    counts[point.day][point.hour]++;
  }
  return sums.map((day, d) => day.map((sum, h) => counts[d][h] ? sum / counts[d][h] : null));
}
