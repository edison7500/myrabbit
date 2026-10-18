const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const createLoader = require('./load-source.cjs');
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });
const load = createLoader();
const { hasOverviewData, metricChange, siteHeading } = load('src/features/overview/overview-state.ts');
const { analyticsBucket, analyticsDatePresets, buildAnalyticsQuery, buildPreviousAnalyticsQuery, isValidCustomRange } = load('src/api/rybbit/date-range.ts');
const { isMetricType, metricDefinitions } = load('src/features/metrics/metric-types.ts');
const context = (overrides = {}) => ({ serverUrl: 'https://example.test', siteId: '1', dateRange: { preset: 'today' }, timeZone: 'UTC', filters: [], ...overrides });
test('site heading removes duplicates and handles missing names/domains', () => {
  assert.equal(siteHeading({ name: 'cypherhunter.com', domain: 'cypherhunter.com' }), 'cypherhunter.com');
  assert.equal(siteHeading({ name: ' CYPHERHUNTER.COM ', domain: 'cypherhunter.com' }), 'cypherhunter.com');
  assert.equal(siteHeading({ name: 'My site', domain: 'example.test' }), 'My site · example.test');
  assert.equal(siteHeading({ name: '', domain: 'example.test' }), 'example.test');
  assert.equal(siteHeading({ name: 'My site', domain: '' }), 'My site');
});
test('zero metrics are data, not an empty state', () => {
  assert.equal(hasOverviewData({ sessions: 0, users: 0 }), true);
  assert.equal(hasOverviewData(null), false);
  assert.equal(hasOverviewData({}), false);
});
test('metric comparison omits absent or zero baselines and treats a falling bounce rate as favorable', () => {
  assert.deepEqual(metricChange(125, 100, 'users'), { percent: 25, direction: 'up', tone: 'positive' });
  assert.deepEqual(metricChange(40, 50, 'bounce_rate'), { percent: 20, direction: 'down', tone: 'positive' });
  assert.deepEqual(metricChange(45, 40, 'bounce_rate'), { percent: 12.5, direction: 'up', tone: 'negative' });
  assert.deepEqual(metricChange(8, 8, 'sessions'), { percent: 0, direction: 'flat', tone: 'neutral' });
  assert.equal(metricChange(100, 0, 'users'), null);
  assert.equal(metricChange(100, undefined, 'users'), null);
});
test('metric route model reserves future KPIs while enabling only Visitors', () => {
  assert.equal(isMetricType('visitors'), true); assert.equal(isMetricType('unknown'), false);
  assert.equal(metricDefinitions.visitors.apiMetric, 'users'); assert.equal(metricDefinitions.visitors.detailAvailable, true);
  for (const metric of ['pageviews', 'sessions', 'bounce_rate', 'pages_per_session', 'avg_session_duration']) {
    assert.equal(metricDefinitions[metric].detailAvailable, false);
  }
});
test('Visitors detail data reuses overview and time-series requests with one shared context', async () => {
  const calls = [];
  const points = [{ time: '2026-01-01 00:00:00', users: 4, pageviews: 8 }];
  const detail = createLoader({ '@/api/rybbit/client': {
    getOverview: async (...args) => { calls.push(['overview', ...args]); return { users: 7 }; },
    getTraffic: async (...args) => { calls.push(['traffic', ...args]); return points; },
  } })('src/features/metrics/metric-detail-data.ts');
  const queryContext = context({ siteId: 'site-1', dateRange: { preset: 'last-7-days' } }); const signal = new AbortController().signal;
  assert.deepEqual(await detail.loadMetricDetail('visitors', queryContext, signal), { total: 7, points, yesterday: null, comparisonError: null });
  assert.deepEqual(calls, [
    ['overview', queryContext, signal], ['traffic', queryContext, signal],
  ]);
  await assert.rejects(detail.loadMetricDetail('pageviews', queryContext, signal), /not available yet/);
  assert.equal(calls.length, 2);
});
test('Today detail requests Yesterday with the same site, timezone and filters, then aligns hourly visitors', async () => {
  const calls = [];
  const today = [
    { time: '2026-01-02 00:00:00', users: 4, pageviews: 8 },
    { time: '2026-01-02 02:00:00', users: 6, pageviews: 9 },
    { time: '2026-01-02 03:00:00', users: 7, pageviews: 10 },
  ];
  const yesterday = [
    { time: '2026-01-01 00:00:00', users: 10, pageviews: 12 },
    { time: '2026-01-01 02:00:00', users: 20, pageviews: 22 },
  ];
  const detail = createLoader({ '@/api/rybbit/client': {
    getOverview: async () => ({ users: 17 }),
    getTraffic: async (query, signal) => { calls.push([query, signal]); return query.dateRange.preset === 'yesterday' ? yesterday : today; },
  } })('src/features/metrics/metric-detail-data.ts');
  const queryContext = context({ siteId: 'site-1', timeZone: 'Asia/Hong_Kong', filters: [{ parameter: 'country', type: 'equals', value: ['HK'] }] });
  const signal = new AbortController().signal;
  assert.deepEqual(await detail.loadMetricDetail('visitors', queryContext, signal), { total: 17, points: today, yesterday, comparisonError: null });
  assert.deepEqual(calls, [[queryContext, signal], [{ ...queryContext, dateRange: { preset: 'yesterday' } }, signal]]);
  assert.deepEqual(detail.alignYesterdayByHour(today, yesterday), [10, 20, null]);
});
test('Yesterday comparison failure does not discard the current Visitors trend', async () => {
  const detail = createLoader({ '@/api/rybbit/client': {
    getOverview: async () => ({ users: 3 }),
    getTraffic: async query => query.dateRange.preset === 'yesterday' ? Promise.reject(new Error('Offline')) : [{ time: '2026-01-02 00:00:00', users: 3, pageviews: 5 }],
  } })('src/features/metrics/metric-detail-data.ts');
  const result = await detail.loadMetricDetail('visitors', context(), new AbortController().signal);
  assert.equal(result.total, 3); assert.equal(result.points.length, 1); assert.equal(result.yesterday, null);
  assert.match(result.comparisonError, /Yesterday comparison unavailable/);
});
test('Rybbit Web date presets use inclusive calendar and relative-minute semantics', () => {
  assert.deepEqual(analyticsDatePresets, [
    'last-30-minutes', 'last-24-hours', 'today', 'yesterday', 'last-7-days', 'last-30-days',
    'this-week', 'this-month', 'this-year', 'all-time',
  ]);
  const now = new Date('2026-03-08T07:30:00Z');
  assert.equal(buildAnalyticsQuery({ preset: 'today' }, 'America/Los_Angeles', now).toString(), 'time_zone=America%2FLos_Angeles&start_date=2026-03-07&end_date=2026-03-07');
  assert.equal(buildAnalyticsQuery({ preset: 'last-7-days' }, 'UTC', now).get('start_date'), '2026-03-02');
  const week = buildAnalyticsQuery({ preset: 'this-week' }, 'UTC', now);
  assert.equal(week.get('start_date'), '2026-03-02'); assert.equal(week.get('end_date'), '2026-03-08');
  const month = buildAnalyticsQuery({ preset: 'this-month' }, 'UTC', now);
  assert.equal(month.get('start_date'), '2026-03-01'); assert.equal(month.get('end_date'), '2026-03-31');
  const recent = buildAnalyticsQuery({ preset: 'last-30-minutes' }, 'UTC', now);
  assert.equal(recent.get('past_minutes_start'), '30'); assert.equal(recent.get('past_minutes_end'), '0'); assert.equal(recent.has('start_date'), false);
  const all = buildAnalyticsQuery({ preset: 'all-time' }, 'UTC', now);
  assert.equal(all.get('start_date'), ''); assert.equal(all.get('end_date'), '');
});
test('custom ranges are inclusive and reject malformed or reversed dates', () => {
  assert.equal(isValidCustomRange('2026-02-01', '2026-02-28'), true);
  assert.equal(isValidCustomRange('2026-03-02', '2026-03-01'), false);
  assert.equal(isValidCustomRange('2026-02-30', '2026-03-01'), false);
  const query = buildAnalyticsQuery({ preset: 'custom', startDate: '2026-02-01', endDate: '2026-02-28' }, 'Asia/Hong_Kong');
  assert.equal(query.get('start_date'), '2026-02-01'); assert.equal(query.get('end_date'), '2026-02-28');
});
test('previous-period queries preserve timezone and use the adjacent equal-length window', () => {
  const now = new Date('2026-03-08T07:30:00Z');
  assert.equal(buildPreviousAnalyticsQuery({ preset: 'today' }, 'America/Los_Angeles', now).toString(),
    'time_zone=America%2FLos_Angeles&start_date=2026-03-06&end_date=2026-03-06');
  assert.equal(buildPreviousAnalyticsQuery({ preset: 'last-7-days' }, 'UTC', now).toString(),
    'time_zone=UTC&start_date=2026-02-23&end_date=2026-03-01');
  assert.equal(buildPreviousAnalyticsQuery({ preset: 'custom', startDate: '2026-02-01', endDate: '2026-02-28' }, 'UTC', now).toString(),
    'time_zone=UTC&start_date=2026-01-04&end_date=2026-01-31');
  assert.equal(buildPreviousAnalyticsQuery({ preset: 'last-30-minutes' }, 'UTC', now).toString(),
    'time_zone=UTC&past_minutes_start=60&past_minutes_end=30');
  assert.equal(buildPreviousAnalyticsQuery({ preset: 'last-24-hours' }, 'UTC', now).toString(),
    'time_zone=UTC&past_minutes_start=2880&past_minutes_end=1440');
  assert.equal(buildPreviousAnalyticsQuery({ preset: 'all-time' }, 'UTC', now), null);
});
test('traffic buckets follow Rybbit Web granularity', () => {
  assert.equal(analyticsBucket({ preset: 'last-30-minutes' }), 'minute');
  assert.equal(analyticsBucket({ preset: 'today' }), 'hour');
  assert.equal(analyticsBucket({ preset: 'last-24-hours' }), 'hour');
  assert.equal(analyticsBucket({ preset: 'last-7-days' }), 'day');
  assert.equal(analyticsBucket({ preset: 'this-year' }), 'month');
  assert.equal(analyticsBucket({ preset: 'custom', startDate: '2026-01-01', endDate: '2026-02-15' }), 'week');
  assert.equal(analyticsBucket({ preset: 'custom', startDate: '2025-01-01', endDate: '2026-01-01' }), 'month');
});
test('getOverview sends the selected range and validates all six metrics', async () => {
  const config = { mode: 'self-host', baseUrl: 'https://example.test/analytics', apiKey: 'credential' };
  const client = createLoader({ '@/storage/connection': { loadConnection: async () => config } })('src/api/rybbit/client.ts');
  let call;
  global.fetch = async (url, options) => {
    call = { url, options };
    return { ok: true, status: 200, json: async () => ({ data: { users: 12, pageviews: 24, sessions: 14, bounce_rate: 40.5, pages_per_session: 1.71, session_duration: 61 } }) };
  };
  const filters = [{ parameter: 'country', type: 'equals', value: ['US'] }];
  const overview = await client.getOverview(context({ serverUrl: config.baseUrl, siteId: 'site/1', dateRange: { preset: 'custom', startDate: '2026-01-02', endDate: '2026-01-08' }, timeZone: 'Asia/Hong_Kong', filters }), new AbortController().signal);
  assert.deepEqual(overview, { users: 12, pageviews: 24, sessions: 14, bounce_rate: 40.5, pages_per_session: 1.71, session_duration: 61 });
  const url = new URL(call.url);
  assert.equal(url.pathname, '/analytics/api/sites/site%2F1/overview');
  assert.equal(url.searchParams.get('start_date'), '2026-01-02');
  assert.equal(url.searchParams.get('end_date'), '2026-01-08');
  assert.equal(url.searchParams.get('time_zone'), 'Asia/Hong_Kong');
  assert.deepEqual(JSON.parse(url.searchParams.get('filters')), filters);
  assert.equal(call.options.headers.Authorization, 'Bearer credential');
});
test('getOverview accepts zero values and rejects malformed API responses', async () => {
  const config = { mode: 'self-host', baseUrl: 'https://example.test', apiKey: 'credential' };
  const client = createLoader({ '@/storage/connection': { loadConnection: async () => config } })('src/api/rybbit/client.ts');
  global.fetch = async () => ({ ok: true, status: 200, json: async () => ({ data: { sessions: 0, users: 0 } }) });
  assert.deepEqual(await client.getOverview(context(), new AbortController().signal), { sessions: 0, users: 0 });
  global.fetch = async () => ({ ok: true, status: 200, json: async () => ({ data: { users: '12' } }) });
  await assert.rejects(client.getOverview(context(), new AbortController().signal), /Unexpected analytics data/);
  global.fetch = async () => ({ ok: true, status: 200, json: async () => ({ data: null }) });
  await assert.rejects(client.getOverview(context(), new AbortController().signal), /Unexpected response/);
});
test('getPreviousOverview requests the preceding period with the same site and filters', async () => {
  const config = { mode: 'self-host', baseUrl: 'https://example.test', apiKey: 'credential' };
  const client = createLoader({ '@/storage/connection': { loadConnection: async () => config } })('src/api/rybbit/client.ts');
  let call;
  global.fetch = async (url, options) => {
    call = { url: new URL(url), options };
    return { ok: true, status: 200, json: async () => ({ data: { users: 12, bounce_rate: 38 } }) };
  };
  const filters = [{ parameter: 'country', type: 'equals', value: ['US'] }];
  const result = await client.getPreviousOverview(context({ siteId: 'site/1', dateRange: { preset: 'custom', startDate: '2026-03-01', endDate: '2026-03-07' }, filters }), new AbortController().signal);
  assert.deepEqual(result, { users: 12, bounce_rate: 38 });
  assert.equal(call.url.pathname, '/api/sites/site%2F1/overview');
  assert.equal(call.url.searchParams.get('start_date'), '2026-02-22');
  assert.equal(call.url.searchParams.get('end_date'), '2026-02-28');
  assert.deepEqual(JSON.parse(call.url.searchParams.get('filters')), filters);
  assert.equal(call.options.headers.Authorization, 'Bearer credential');
  global.fetch = () => { throw new Error('All-time must not request a previous period'); };
  assert.equal(await client.getPreviousOverview(context({ dateRange: { preset: 'all-time' } }), new AbortController().signal), null);
});
test('getTraffic requests the time-series endpoint with the selected range and bucket', async () => {
  const config = { mode: 'self-host', baseUrl: 'https://example.test', apiKey: 'credential' };
  const client = createLoader({ '@/storage/connection': { loadConnection: async () => config } })('src/api/rybbit/client.ts');
  let requestedUrl;
  global.fetch = async (url) => {
    requestedUrl = new URL(url);
    return { ok: true, status: 200, json: async () => ({ data: [
      { time: '2026-01-01 00:00:00', users: 2, pageviews: 4 },
      { time: '2026-01-02 00:00:00', users: 3, pageviews: 8 },
    ] }) };
  };
  assert.deepEqual(await client.getTraffic(context({ siteId: 'site/1', dateRange: { preset: 'last-7-days' }, timeZone: 'Asia/Hong_Kong' }), new AbortController().signal), [
    { time: '2026-01-01 00:00:00', users: 2, pageviews: 4 },
    { time: '2026-01-02 00:00:00', users: 3, pageviews: 8 },
  ]);
  assert.equal(requestedUrl.pathname, '/api/sites/site%2F1/overview/time-series');
  assert.equal(requestedUrl.searchParams.get('bucket'), 'day');
  assert.equal(requestedUrl.searchParams.get('time_zone'), 'Asia/Hong_Kong');
  global.fetch = async () => ({ ok: true, status: 200, json: async () => ({ data: [{ time: 'bad', users: '2', pageviews: 4 }] }) });
  await assert.rejects(client.getTraffic(context(), new AbortController().signal), /Unexpected traffic data/);
});
