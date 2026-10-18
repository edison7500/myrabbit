import { buildAnalyticsQuery, buildPreviousAnalyticsQuery, type AnalyticsDateRange } from './date-range';

export type AnalyticsFilterType =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'regex'
  | 'not_regex'
  | 'is_null'
  | 'is_not_null'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equal'
  | 'less_than_or_equal';

export type AnalyticsFilterParameter =
  | 'browser'
  | 'operating_system'
  | 'language'
  | 'country'
  | 'region'
  | 'city'
  | 'device_type'
  | 'referrer'
  | 'hostname'
  | 'pathname'
  | 'page_title'
  | 'querystring'
  | 'event_name'
  | 'channel'
  | 'utm_source'
  | 'utm_medium'
  | 'utm_campaign'
  | 'utm_term'
  | 'utm_content'
  | 'entry_page'
  | 'exit_page'
  | 'dimensions'
  | 'browser_version'
  | 'operating_system_version'
  | 'user_id'
  | 'lat'
  | 'lon'
  | 'timezone'
  | 'tag'
  | `feature_flag:${string}`;

export type AnalyticsFilter = {
  parameter: AnalyticsFilterParameter;
  value: readonly (string | number)[];
  type: AnalyticsFilterType;
};

export type AnalyticsQueryContext = {
  serverUrl: string;
  siteId: string;
  dateRange: AnalyticsDateRange;
  timeZone: string;
  filters: readonly AnalyticsFilter[];
};

export function isValidAnalyticsTimeZone(timeZone: string) {
  if (!timeZone.trim()) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format();
    return true;
  } catch {
    return false;
  }
}

export function buildAnalyticsContextQuery(context: AnalyticsQueryContext, now = new Date()) {
  if (!isValidAnalyticsTimeZone(context.timeZone)) throw new Error('Choose a valid analytics timezone.');
  const query = buildAnalyticsQuery(context.dateRange, context.timeZone, now);
  if (context.filters.length) query.set('filters', JSON.stringify(context.filters));
  return query;
}

export function buildPreviousAnalyticsContextQuery(context: AnalyticsQueryContext, now = new Date()) {
  if (!isValidAnalyticsTimeZone(context.timeZone)) throw new Error('Choose a valid analytics timezone.');
  const query = buildPreviousAnalyticsQuery(context.dateRange, context.timeZone, now);
  if (query && context.filters.length) query.set('filters', JSON.stringify(context.filters));
  return query;
}

export function analyticsQueryIdentity(
  context: AnalyticsQueryContext,
  resource: string,
  parameters: Readonly<Record<string, string | number>> = {},
) {
  const query = buildAnalyticsContextQuery(context);
  for (const [key, value] of Object.entries(parameters).sort(([left], [right]) => left.localeCompare(right))) {
    query.set(key, String(value));
  }
  return `${context.serverUrl}/api/sites/${encodeURIComponent(context.siteId)}/${resource}?${query}`;
}
