import { getOverview, getTraffic, type Overview, type TrafficPoint } from '@/api/rybbit/client';
import type { AnalyticsQueryContext } from '@/api/rybbit/analytics-context';

export type MetricDetailData = { overview: Overview; points: TrafficPoint[]; yesterday: TrafficPoint[] | null; comparisonError: string | null };

export async function loadMetricDetail(context: AnalyticsQueryContext, signal: AbortSignal): Promise<MetricDetailData> {
  const [overview, points, comparison] = await Promise.all([
    getOverview(context, signal),
    getTraffic(context, signal),
    context.dateRange.preset === 'today'
      ? getTraffic({ ...context, dateRange: { preset: 'yesterday' } }, signal)
        .then(yesterday => ({ yesterday, comparisonError: null }))
        .catch(() => ({ yesterday: null, comparisonError: 'Yesterday comparison unavailable.' }))
      : Promise.resolve({ yesterday: null, comparisonError: null }),
  ]);
  return { overview, points, ...comparison };
}
