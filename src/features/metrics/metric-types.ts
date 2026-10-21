import type { Overview } from '@/api/rybbit/client';

export type MetricType = 'visitors' | 'pageviews' | 'sessions' | 'bounce_rate' | 'pages_per_session' | 'avg_session_duration';

export const metricDefinitions: Record<MetricType, { title: string; apiMetric: keyof Overview; detailAvailable: boolean }> = {
  visitors: { title: 'Visitors', apiMetric: 'users', detailAvailable: true },
  pageviews: { title: 'Pageviews', apiMetric: 'pageviews', detailAvailable: true },
  sessions: { title: 'Sessions', apiMetric: 'sessions', detailAvailable: true },
  bounce_rate: { title: 'Bounce Rate', apiMetric: 'bounce_rate', detailAvailable: true },
  pages_per_session: { title: 'Pages per Session', apiMetric: 'pages_per_session', detailAvailable: true },
  avg_session_duration: { title: 'Session Duration', apiMetric: 'session_duration', detailAvailable: true },
};

export function isMetricType(value: string): value is MetricType {
  return Object.hasOwn(metricDefinitions, value);
}
