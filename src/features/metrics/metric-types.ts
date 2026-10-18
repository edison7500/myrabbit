import type { Overview } from '@/api/rybbit/client';

export type MetricType = 'visitors' | 'pageviews' | 'sessions' | 'bounce_rate' | 'pages_per_session' | 'avg_session_duration';

export const metricDefinitions: Record<MetricType, { title: string; apiMetric: keyof Overview; detailAvailable: boolean }> = {
  visitors: { title: 'Visitors', apiMetric: 'users', detailAvailable: true },
  pageviews: { title: 'Pageviews', apiMetric: 'pageviews', detailAvailable: false },
  sessions: { title: 'Sessions', apiMetric: 'sessions', detailAvailable: false },
  bounce_rate: { title: 'Bounce rate', apiMetric: 'bounce_rate', detailAvailable: false },
  pages_per_session: { title: 'Pages / session', apiMetric: 'pages_per_session', detailAvailable: false },
  avg_session_duration: { title: 'Avg. session', apiMetric: 'session_duration', detailAvailable: false },
};

export function isMetricType(value: string): value is MetricType {
  return Object.hasOwn(metricDefinitions, value);
}
