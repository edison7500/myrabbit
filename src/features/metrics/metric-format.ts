import type { OverviewMetric } from '@/api/rybbit/client';

export const metricLabels: Record<OverviewMetric, string> = {
  users: 'Visitors', sessions: 'Sessions', pageviews: 'Pageviews',
  pages_per_session: 'Pages per Session', bounce_rate: 'Bounce Rate', session_duration: 'Session Duration',
};

export function formatMetricValue(value: number, metric: OverviewMetric) {
  if (metric === 'bounce_rate') return `${Number(value.toFixed(1))}%`;
  if (metric === 'pages_per_session') return value.toFixed(1);
  if (metric === 'session_duration') {
    const seconds = Math.round(value);
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}
