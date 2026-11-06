import type { AnalyticsFilter } from '@/api/rybbit/analytics-context';

export type ClickFilterParameter = 'referrer' | 'browser';

// One value per dimension; clicking another value replaces that dimension.
// Keep unrelated filters intact so dimensions compose on the server.
export function toggleAnalyticsFilter(filters: readonly AnalyticsFilter[], parameter: ClickFilterParameter, value: string): AnalyticsFilter[] {
  const selected = filters.some(filter => filter.parameter === parameter && filter.type === 'equals' && filter.value.length === 1 && filter.value[0] === value);
  const remaining = filters.filter(filter => filter.parameter !== parameter);
  return selected ? remaining : [...remaining, { parameter, type: 'equals', value: [value] }];
}
