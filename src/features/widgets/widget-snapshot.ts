import type { AnalyticsQueryContext } from '@/api/rybbit/analytics-context';
import { buildAnalyticsQuery } from '@/api/rybbit/date-range';
import type { Overview, Site } from '@/api/rybbit/client';
import { formatOverviewValue } from '@/features/overview/overview-format';
import { hasOverviewData, metricChange } from '@/features/overview/overview-state';
import type { WidgetSnapshot } from './widget-types';

const metrics = [
  ['users', 'Unique Users'], ['sessions', 'Sessions'], ['pageviews', 'Pageviews'],
  ['pages_per_session', 'Pages per Session'], ['bounce_rate', 'Bounce Rate'], ['session_duration', 'Session Duration'],
] as const;

export function widgetContextKey(serverUrl: string, siteId: string, timeZone: string) {
  return JSON.stringify([serverUrl, siteId, timeZone]);
}

export function widgetReportDate(timeZone: string, now = new Date()) {
  return buildAnalyticsQuery({ preset: 'today' }, timeZone, now).get('start_date')!;
}

export function isWidgetReportingContext(context: AnalyticsQueryContext) {
  return context.dateRange.preset === 'today' && context.filters.length === 0;
}

export function createWidgetSnapshot(
  context: AnalyticsQueryContext, site: Site, overview: Overview, previous: Overview | null,
  updatedAt: number, reportDate?: string,
): WidgetSnapshot | null {
  if (site.id !== context.siteId || !isWidgetReportingContext(context) || !hasOverviewData(overview) || !Number.isFinite(updatedAt)) return null;
  // Explicit allowlist: no connection configuration, credentials, filters, or raw responses.
  return {
    version: 1, siteId: site.id, siteDomain: site.domain.trim() || site.name.trim(),
    reportDate: reportDate ?? widgetReportDate(context.timeZone, new Date(updatedAt)), timeZone: context.timeZone, updatedAt,
    metrics: metrics.map(([id, label]) => ({
      id, label, value: formatOverviewValue(overview[id], id), change: metricChange(overview[id], previous?.[id], id),
    })),
  };
}
