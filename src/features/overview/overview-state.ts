import type { Overview, Site } from '@/api/rybbit/client';

export function siteHeading(site: Pick<Site, 'name' | 'domain'> | null) {
  if (!site) return 'Your site analytics.';
  const name = site.name.trim();
  const domain = site.domain.trim();
  return !name || name.toLowerCase() === domain.toLowerCase() ? domain : !domain ? name : `${name} · ${domain}`;
}

export function hasOverviewData(data: Overview | null) {
  return data !== null && Object.values(data).some(value => typeof value === 'number');
}

export function metricChange(current: number | undefined, previous: number | undefined, metric: keyof Overview) {
  if (current === undefined || previous === undefined || !Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) return null;
  const percent = ((current - previous) / previous) * 100;
  if (!Number.isFinite(percent)) return null;
  const direction = percent > 0 ? 'up' : percent < 0 ? 'down' : 'flat';
  const favorable = metric === 'bounce_rate' ? percent < 0 : percent > 0;
  return { percent: Math.abs(percent), direction, tone: direction === 'flat' ? 'neutral' : favorable ? 'positive' : 'negative' } as const;
}
