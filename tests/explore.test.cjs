const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const createLoader = require('./load-source.cjs');

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

const load = createLoader();
const { analyticsQueryIdentity, buildAnalyticsContextQuery, isValidAnalyticsTimeZone } = load('src/api/rybbit/analytics-context.ts');
const baseContext = {
  serverUrl: 'https://analytics.test/base',
  siteId: 'site/1',
  dateRange: { preset: 'last-7-days' },
  timeZone: 'Asia/Hong_Kong',
  filters: [{ parameter: 'country', type: 'equals', value: ['US'] }],
};

function response(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

test('shared analytics context serializes time and filters into one credential-free identity', () => {
  const query = buildAnalyticsContextQuery(baseContext, new Date('2026-09-13T12:00:00Z'));
  assert.equal(query.get('start_date'), '2026-09-07');
  assert.equal(query.get('end_date'), '2026-09-13');
  assert.equal(query.get('time_zone'), 'Asia/Hong_Kong');
  assert.deepEqual(JSON.parse(query.get('filters')), baseContext.filters);
  const identity = analyticsQueryIdentity(baseContext, 'metric', { page: 2, parameter: 'country', limit: 25 });
  assert.match(identity, /^https:\/\/analytics\.test\/base\/api\/sites\/site%2F1\/metric\?/);
  assert.ok(identity.includes('limit=25'));
  assert.ok(identity.includes('page=2'));
  assert.ok(identity.includes('parameter=country'));
  assert.doesNotMatch(identity, /credential|api.?key/i);
  assert.notEqual(identity, analyticsQueryIdentity({ ...baseContext, siteId: 'other' }, 'metric'));
  assert.notEqual(identity, analyticsQueryIdentity({ ...baseContext, timeZone: 'UTC' }, 'metric', { page: 2, parameter: 'country', limit: 25 }));
});

test('analytics context rejects invalid timezones before a request can be built', () => {
  assert.equal(isValidAnalyticsTimeZone('UTC'), true);
  assert.equal(isValidAnalyticsTimeZone('Not/A_Zone'), false);
  assert.throws(() => buildAnalyticsContextQuery({ ...baseContext, timeZone: 'Not/A_Zone' }), /valid analytics timezone/);
});

test('breakdown sends the shared context and returns a validated next page', async () => {
  const config = { mode: 'self-host', baseUrl: baseContext.serverUrl, apiKey: 'secret' };
  const breakdown = createLoader({ '@/storage/connection': { loadConnection: async () => config } })('src/api/rybbit/breakdown.ts');
  let call;
  global.fetch = async (url, options) => {
    call = { url: new URL(url), options };
    return response({ data: { data: [{
      value: '/pricing', count: 4, percentage: 57.14, hostname: 'example.test', pageviews: 7,
      pageviews_percentage: 63.64, bounce_rate: 25, time_on_page_seconds: 12.5,
    }], totalCount: 3 } });
  };
  const page = await breakdown.getBreakdown({ context: baseContext, dimension: 'pathname', page: 1, limit: 1 }, new AbortController().signal);
  assert.deepEqual(page, { items: [{ value: '/pricing', count: 4, percentage: 57.14, hostname: 'example.test', pageviews: 7,
    pageviewsPercentage: 63.64, bounceRate: 25, timeOnPageSeconds: 12.5 }], totalCount: 3, page: 1, limit: 1, nextPage: 2 });
  assert.equal(call.url.pathname, '/base/api/sites/site%2F1/metric');
  assert.equal(call.url.searchParams.get('parameter'), 'pathname');
  assert.equal(call.url.searchParams.get('limit'), '1');
  assert.equal(call.url.searchParams.get('page'), '1');
  assert.deepEqual(JSON.parse(call.url.searchParams.get('filters')), baseContext.filters);
  assert.equal(call.options.headers.Authorization, 'Bearer secret');
  assert.equal(call.options.credentials, 'omit');
});

test('breakdown pagination stops on an empty shifting page and deduplicates by raw value', async () => {
  const config = { mode: 'self-host', baseUrl: baseContext.serverUrl, apiKey: 'secret' };
  const breakdown = createLoader({ '@/storage/connection': { loadConnection: async () => config } })('src/api/rybbit/breakdown.ts');
  global.fetch = async () => response({ data: { data: [], totalCount: 20 } });
  const page = await breakdown.getBreakdown({ context: baseContext, dimension: 'country', page: 2, limit: 10 }, new AbortController().signal);
  assert.equal(page.nextPage, null);
  assert.deepEqual(breakdown.appendBreakdownPage(
    [{ value: 'US', count: 5, percentage: 50 }],
    { items: [{ value: 'US', count: 4, percentage: 40 }, { value: 'GB', count: 3, percentage: 30 }], totalCount: 2, page: 2, limit: 1, nextPage: null },
  ).map(item => item.value), ['US', 'GB']);
});

test('Content tabs request the exact Web metric parameters and retain Sessions instead of pageviews', async () => {
  const config = { mode: 'self-host', baseUrl: baseContext.serverUrl, apiKey: 'synthetic-key' };
  const chart = createLoader({ '@/storage/connection': { loadConnection: async () => config } })('src/api/rybbit/explore-charts.ts');
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url: new URL(url), options });
    return response({ data: { data: [{ value: '/en/', count: 3, percentage: 60, pageviews: 70 }], totalCount: 105 } });
  };
  for (const kind of ['pathname', 'page_title', 'entry_page', 'exit_page', 'hostname']) {
    const result = await chart.getExploreRanking(baseContext, kind, new AbortController().signal, 2);
    const { url, options } = calls.at(-1);
    assert.equal(url.pathname, '/base/api/sites/site%2F1/metric');
    assert.equal(url.searchParams.get('parameter'), kind);
    assert.equal(url.searchParams.get('page'), '2');
    assert.equal(url.searchParams.get('limit'), '100');
    assert.equal(url.searchParams.get('time_zone'), baseContext.timeZone);
    assert.deepEqual(JSON.parse(url.searchParams.get('filters')), baseContext.filters);
    assert.equal(options.credentials, 'omit');
    assert.equal(options.headers.Authorization, 'Bearer synthetic-key');
    assert.equal(result.items[0].count, 3);
    assert.equal(result.items[0].percentage, 60);
    assert.equal(result.nextPage, 3);
  }
});

test('breakdown rejects malformed payloads, invalid pagination and stale connection context', async () => {
  const config = { mode: 'self-host', baseUrl: baseContext.serverUrl, apiKey: 'secret' };
  const breakdown = createLoader({ '@/storage/connection': { loadConnection: async () => config } })('src/api/rybbit/breakdown.ts');
  let fetches = 0;
  global.fetch = async () => { fetches++; return response({ data: { data: [{ value: 'US', count: '2', percentage: 100 }], totalCount: 1 } }); };
  await assert.rejects(breakdown.getBreakdown({ context: baseContext, dimension: 'country' }, new AbortController().signal), /breakdown count/);
  await assert.rejects(breakdown.getBreakdown({ context: baseContext, dimension: 'country', limit: 101 }, new AbortController().signal), /valid breakdown limit/);
  await assert.rejects(breakdown.getBreakdown({ context: { ...baseContext, serverUrl: 'https://old.test' }, dimension: 'country' }, new AbortController().signal), /connection changed/);
  assert.equal(fetches, 1);
});
