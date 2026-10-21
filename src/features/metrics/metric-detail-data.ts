import { getOverview, getTraffic, type TrafficPoint, type OverviewMetric } from '@/api/rybbit/client';
import type { AnalyticsQueryContext } from '@/api/rybbit/analytics-context';
import { metricDefinitions, type MetricType } from './metric-types';

export type MetricDetailData = { total: number; points: TrafficPoint[]; yesterday: TrafficPoint[] | null; comparisonError: string | null };

export function alignYesterdayByHour(today: TrafficPoint[], yesterday: TrafficPoint[], metric: OverviewMetric = 'users'): (number | null)[] {
  const hourlyValues = new Map(yesterday.map(point => [point.time.slice(11, 16), point[metric]]));
  return today.map(point => hourlyValues.get(point.time.slice(11, 16)) ?? null);
}

export async function loadMetricDetail(metric: MetricType, context: AnalyticsQueryContext, signal: AbortSignal): Promise<MetricDetailData> {
  const definition = metricDefinitions[metric];
  function validate(points: TrafficPoint[]) {
    if (points.some(point => typeof point[definition.apiMetric] !== 'number')) {
      throw new Error(`${definition.title} trend is unavailable from this Rybbit server. Try updating your server.`);
    }
    return points;
  }
  const [overview, points, comparison] = await Promise.all([
    getOverview(context, signal),
    getTraffic(context, signal).then(validate),
    context.dateRange.preset === 'today'
      ? getTraffic({ ...context, dateRange: { preset: 'yesterday' } }, signal)
        .then(validate).then(yesterday => ({ yesterday, comparisonError: null }))
        .catch(() => ({ yesterday: null, comparisonError: 'Yesterday comparison unavailable.' }))
      : Promise.resolve({ yesterday: null, comparisonError: null }),
  ]);
  const total = overview[definition.apiMetric];
  if (typeof total !== 'number') throw new Error('Unexpected metric data from Rybbit.');
  return { total, points, ...comparison };
}
