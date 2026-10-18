import { getOverview, getTraffic, type TrafficPoint } from '@/api/rybbit/client';
import type { AnalyticsQueryContext } from '@/api/rybbit/analytics-context';
import { metricDefinitions, type MetricType } from './metric-types';

export type MetricDetailData = { total: number; points: TrafficPoint[]; yesterday: TrafficPoint[] | null; comparisonError: string | null };

export function alignYesterdayByHour(today: TrafficPoint[], yesterday: TrafficPoint[]): (number | null)[] {
  const hourlyVisitors = new Map(yesterday.map(point => [point.time.slice(11, 16), point.users]));
  return today.map(point => hourlyVisitors.get(point.time.slice(11, 16)) ?? null);
}

export async function loadMetricDetail(metric: MetricType, context: AnalyticsQueryContext, signal: AbortSignal): Promise<MetricDetailData> {
  const definition = metricDefinitions[metric];
  if (!definition.detailAvailable) throw new Error(`${definition.title} details are not available yet.`);
  const [overview, points, comparison] = await Promise.all([
    getOverview(context, signal),
    getTraffic(context, signal),
    context.dateRange.preset === 'today'
      ? getTraffic({ ...context, dateRange: { preset: 'yesterday' } }, signal)
        .then(yesterday => ({ yesterday, comparisonError: null }))
        .catch(() => ({ yesterday: null, comparisonError: 'Yesterday comparison unavailable.' }))
      : Promise.resolve({ yesterday: null, comparisonError: null }),
  ]);
  const total = overview[definition.apiMetric];
  if (typeof total !== 'number') throw new Error('Unexpected metric data from Rybbit.');
  return { total, points, ...comparison };
}
