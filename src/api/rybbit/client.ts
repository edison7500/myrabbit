import { request } from './request';
import { loadConnection } from '@/storage/connection';
import { analyticsBucket } from './date-range';
import { buildAnalyticsContextQuery, buildPreviousAnalyticsContextQuery, type AnalyticsQueryContext } from './analytics-context';

export type Site = { id: string; name: string; domain: string; organization: string };
export type Overview = Partial<Record<'sessions' | 'pageviews' | 'users' | 'pages_per_session' | 'bounce_rate' | 'session_duration', number>>;
export type TrafficPoint = { time: string; users: number; pageviews: number };

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Unexpected response from Rybbit.');
  return value as Record<string, unknown>;
}

async function connection() {
  const config = await loadConnection();
  if (!config) throw new Error('Configure your Rybbit connection first.');
  return config;
}

async function analyticsConnection(context: AnalyticsQueryContext) {
  const config = await connection();
  if (config.baseUrl !== context.serverUrl) throw new Error('The analytics connection changed. Try again.');
  return config;
}

export async function getSites(signal: AbortSignal): Promise<Site[]> {
  const config = await connection();
  const organizations = await request(config, '/organizations', signal);
  if (!Array.isArray(organizations)) throw new Error('Unexpected organization list from Rybbit.');
  const groups = await Promise.all(organizations.map(async (value) => {
    const org = object(value);
    if (typeof org.id !== 'string') throw new Error('Unexpected organization ID from Rybbit.');
    const response = object(await request(config, `/organizations/${encodeURIComponent(org.id)}/sites`, signal));
    if (!Array.isArray(response.sites)) throw new Error('Unexpected site list from Rybbit.');
    return response.sites.map((value): Site => {
      const site = object(value);
      if (typeof site.siteId !== 'number' && typeof site.siteId !== 'string') throw new Error('Unexpected site ID from Rybbit.');
      return { id: String(site.siteId), name: typeof site.name === 'string' ? site.name : String(site.domain ?? site.siteId),
        domain: typeof site.domain === 'string' ? site.domain : '', organization: typeof org.name === 'string' ? org.name : org.id as string };
    });
  }));
  return Array.from(new Map(groups.flat().map(site => [site.id, site])).values());
}

export async function getOverview(context: AnalyticsQueryContext, signal: AbortSignal): Promise<Overview> {
  const config = await analyticsConnection(context);
  const query = buildAnalyticsContextQuery(context);
  const response = object(await request(config, `/sites/${encodeURIComponent(context.siteId)}/overview?${query}`, signal));
  return parseOverview(response);
}

export async function getPreviousOverview(context: AnalyticsQueryContext, signal: AbortSignal): Promise<Overview | null> {
  const query = buildPreviousAnalyticsContextQuery(context);
  if (!query) return null;
  const config = await analyticsConnection(context);
  const response = object(await request(config, `/sites/${encodeURIComponent(context.siteId)}/overview?${query}`, signal));
  return parseOverview(response);
}

function parseOverview(response: Record<string, unknown>): Overview {
  const data = object(response.data);
  const overview: Overview = {};
  for (const key of ['sessions', 'pageviews', 'users', 'pages_per_session', 'bounce_rate', 'session_duration'] as const) {
    const value = data[key];
    if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value))) throw new Error('Unexpected analytics data from Rybbit.');
    if (typeof value === 'number') overview[key] = value;
  }
  return overview;
}

export async function getTraffic(context: AnalyticsQueryContext, signal: AbortSignal): Promise<TrafficPoint[]> {
  const config = await analyticsConnection(context);
  const query = buildAnalyticsContextQuery(context);
  query.set('bucket', analyticsBucket(context.dateRange));
  const response = object(await request(config, `/sites/${encodeURIComponent(context.siteId)}/overview/time-series?${query}`, signal));
  if (!Array.isArray(response.data)) throw new Error('Unexpected traffic data from Rybbit.');
  return response.data.map((value): TrafficPoint => {
    const point = object(value);
    if (typeof point.time !== 'string' || typeof point.users !== 'number' || !Number.isFinite(point.users) ||
      typeof point.pageviews !== 'number' || !Number.isFinite(point.pageviews)) {
      throw new Error('Unexpected traffic data from Rybbit.');
    }
    return { time: point.time, users: point.users, pageviews: point.pageviews };
  });
}
