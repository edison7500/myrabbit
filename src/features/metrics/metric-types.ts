import type { OverviewMetric } from '@/api/rybbit/client';

export const metricDefinitions = {
  visitors: { title: 'Unique Users', apiMetric: 'users' },
  sessions: { title: 'Sessions', apiMetric: 'sessions' },
  pageviews: { title: 'Pageviews', apiMetric: 'pageviews' },
  pages_per_session: { title: 'Pages per Session', apiMetric: 'pages_per_session' },
  bounce_rate: { title: 'Bounce Rate', apiMetric: 'bounce_rate' },
  avg_session_duration: { title: 'Session Duration', apiMetric: 'session_duration' },
} as const satisfies Record<string, { title: string; apiMetric: OverviewMetric }>;

export type MetricType = keyof typeof metricDefinitions;
export const metricOrder = Object.keys(metricDefinitions) as MetricType[];

export function isMetricType(value: string): value is MetricType {
  return Object.hasOwn(metricDefinitions, value);
}
