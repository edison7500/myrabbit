import { buildAnalyticsContextQuery, type AnalyticsQueryContext } from './analytics-context';
import { request } from './request';
import { loadConnection } from '@/storage/connection';

export const exploreDimensions = ['referrer', 'pathname', 'page_title', 'entry_page', 'exit_page', 'hostname', 'browser', 'device_type', 'operating_system', 'dimensions', 'country', 'region', 'city', 'language', 'timezone'] as const;
export type ExploreDimension = (typeof exploreDimensions)[number];

export type BreakdownItem = {
  value: string;
  count: number;
  percentage: number;
  hostname?: string;
  pageviews?: number;
  pageviewsPercentage?: number;
  bounceRate?: number;
  timeOnPageSeconds?: number;
};

export type BreakdownPage = {
  items: BreakdownItem[];
  totalCount: number;
  page: number;
  limit: number;
  nextPage: number | null;
};

export type BreakdownQuery = {
  context: AnalyticsQueryContext;
  dimension: ExploreDimension;
  page?: number;
  limit?: number;
};

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Unexpected breakdown response from Rybbit.');
  return value as Record<string, unknown>;
}

function finiteNumber(value: unknown, field: string): number;
function finiteNumber(value: unknown, field: string, optional: true): number | undefined;
function finiteNumber(value: unknown, field: string, optional = false): number | undefined {
  if (optional && value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Unexpected breakdown ${field} from Rybbit.`);
  return value;
}

function optionalNonNegative(value: unknown, field: string) {
  const number = finiteNumber(value, field, true);
  if (number !== undefined && number < 0) throw new Error(`Unexpected breakdown ${field} from Rybbit.`);
  return number;
}

function parseItem(value: unknown): BreakdownItem {
  const item = object(value);
  if (typeof item.value !== 'string') throw new Error('Unexpected breakdown value from Rybbit.');
  const count = finiteNumber(item.count, 'count');
  const percentage = finiteNumber(item.percentage, 'percentage');
  if (!Number.isInteger(count) || count < 0 || percentage < 0 || percentage > 100) {
    throw new Error('Unexpected breakdown metrics from Rybbit.');
  }
  if (item.hostname !== undefined && typeof item.hostname !== 'string') throw new Error('Unexpected breakdown hostname from Rybbit.');
  return {
    value: item.value,
    count,
    percentage,
    ...(item.hostname === undefined ? {} : { hostname: item.hostname }),
    ...(item.pageviews === undefined ? {} : { pageviews: optionalNonNegative(item.pageviews, 'pageviews')! }),
    ...(item.pageviews_percentage === undefined ? {} : { pageviewsPercentage: optionalNonNegative(item.pageviews_percentage, 'pageviews percentage')! }),
    ...(item.bounce_rate === undefined ? {} : { bounceRate: optionalNonNegative(item.bounce_rate, 'bounce rate')! }),
    ...(item.time_on_page_seconds === undefined ? {} : { timeOnPageSeconds: optionalNonNegative(item.time_on_page_seconds, 'time on page')! }),
  };
}

function positiveInteger(value: number, field: string, maximum?: number) {
  if (!Number.isInteger(value) || value < 1 || (maximum !== undefined && value > maximum)) {
    throw new Error(`Choose a valid breakdown ${field}.`);
  }
  return value;
}

export async function getBreakdown({ context, dimension, page = 1, limit = 100 }: BreakdownQuery, signal: AbortSignal): Promise<BreakdownPage> {
  positiveInteger(page, 'page');
  positiveInteger(limit, 'limit', 100);
  const config = await loadConnection();
  if (!config) throw new Error('Configure your Rybbit connection first.');
  if (config.baseUrl !== context.serverUrl) throw new Error('The analytics connection changed. Try again.');

  const query = buildAnalyticsContextQuery(context);
  query.set('parameter', dimension);
  query.set('limit', String(limit));
  query.set('page', String(page));
  const response = object(await request(config, `/sites/${encodeURIComponent(context.siteId)}/metric?${query}`, signal));
  const payload = object(response.data);
  if (!Array.isArray(payload.data) || typeof payload.totalCount !== 'number' ||
    !Number.isInteger(payload.totalCount) || payload.totalCount < 0) {
    throw new Error('Unexpected breakdown response from Rybbit.');
  }
  const items = payload.data.map(parseItem);
  const fetchedThrough = (page - 1) * limit + items.length;
  return {
    items,
    totalCount: payload.totalCount,
    page,
    limit,
    nextPage: items.length > 0 && fetchedThrough < payload.totalCount ? page + 1 : null,
  };
}

export function appendBreakdownPage(current: readonly BreakdownItem[], next: BreakdownPage) {
  const seen = new Set(current.map(item => item.value));
  return [...current, ...next.items.filter(item => {
    if (seen.has(item.value)) return false;
    seen.add(item.value);
    return true;
  })];
}
