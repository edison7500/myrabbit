import { buildAnalyticsQuery, isValidCustomRange, shiftDate, type AnalyticsDateRange } from '@/api/rybbit/date-range';
import type { Overview, Site } from '@/api/rybbit/client';
import { formatOverviewValue } from '@/features/overview/overview-format';
import { hasOverviewData, metricChange } from '@/features/overview/overview-state';
import type { WidgetDateRange, WidgetSnapshot } from './widget-types';

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

export function widgetDateRange(range: AnalyticsDateRange): WidgetDateRange | null {
  switch (range.preset) {
    case 'today':
    case 'yesterday':
    case 'last-7-days':
    case 'this-week':
    case 'last-30-minutes':
    case 'last-24-hours':
      return { preset: range.preset };
    case 'custom': {
      if (!isValidCustomRange(range.startDate, range.endDate)) return null;
      const earliest = shiftDate(range.endDate, -6);
      return { preset: 'custom', startDate: range.startDate < earliest ? earliest : range.startDate, endDate: range.endDate };
    }
    default:
      return { preset: 'last-7-days' };
  }
}

export function sameDateRange(left: AnalyticsDateRange, right: WidgetDateRange) {
  if (left.preset === 'custom') {
    return right.preset === 'custom' && left.startDate === right.startDate && left.endDate === right.endDate;
  }
  return left.preset === right.preset;
}

export function createWidgetSnapshot(
  dateRange: WidgetDateRange, timeZone: string, site: Site, overview: Overview, previous: Overview | null,
  updatedAt: number, reportDate: string,
): WidgetSnapshot | null {
  if (!hasOverviewData(overview) || !Number.isFinite(updatedAt)) return null;
  // Explicit allowlist: no connection configuration, credentials, filters, or raw responses.
  return {
    version: 1, siteId: site.id, siteDomain: site.domain.trim() || site.name.trim(),
    reportDate, dateRange, timeZone, updatedAt,
    metrics: metrics.map(([id, label]) => ({
      id, label, value: formatOverviewValue(overview[id], id), change: metricChange(overview[id], previous?.[id], id),
    })),
  };
}
