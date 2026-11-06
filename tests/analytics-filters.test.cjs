const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-source.cjs')();
const { toggleAnalyticsFilter } = load('src/features/explore/analytics-filters.ts');
const { buildAnalyticsContextQuery } = load('src/api/rybbit/analytics-context.ts');

test('row filters compose across dimensions, replace within a dimension and toggle off using raw values', () => {
  const original = [{ parameter: 'country', type: 'equals', value: ['US'] }];
  const source = toggleAnalyticsFilter(original, 'referrer', 'google.com');
  const both = toggleAnalyticsFilter(source, 'browser', 'IE11');
  assert.deepEqual(original, [{ parameter: 'country', type: 'equals', value: ['US'] }]);
  assert.deepEqual(both, [...source, { parameter: 'browser', type: 'equals', value: ['IE11'] }]);
  const replaced = toggleAnalyticsFilter(both, 'browser', 'Safari');
  assert.deepEqual(replaced.at(-1).value, ['Safari']);
  assert.equal(replaced.filter(filter => filter.parameter === 'browser').length, 1);
  assert.deepEqual(toggleAnalyticsFilter(replaced, 'browser', 'Safari'), source);
  const context = { serverUrl: 'https://example.test', siteId: '1', dateRange: { preset: 'today' }, timeZone: 'UTC', filters: both };
  assert.deepEqual(JSON.parse(buildAnalyticsContextQuery(context).get('filters')), both);
});
