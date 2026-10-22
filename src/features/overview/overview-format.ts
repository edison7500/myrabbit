import type { OverviewMetric } from '@/api/rybbit/client';

// Keep the Dashboard and its cached widget values identical.
export function formatOverviewValue(value: number | undefined, metric: OverviewMetric) {
  if (value === undefined || !Number.isFinite(value)) return '—';
  if (metric === 'bounce_rate') return `${Math.round(value)}%`;
  if (metric === 'session_duration') return `${Math.floor(Math.round(value) / 60)}m ${Math.round(value) % 60}s`;
  if (metric === 'pages_per_session') return value.toFixed(1);
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}m`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}
