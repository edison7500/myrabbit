const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const createLoader = require('./load-source.cjs');
global.IS_REACT_ACT_ENVIRONMENT = true;

const load = createLoader();
const { createWidgetSnapshot, isWidgetReportingContext, widgetContextKey, widgetReportDate } = load('src/features/widgets/widget-snapshot.ts');
const { formatOverviewValue } = load('src/features/overview/overview-format.ts');
const { metricChange } = load('src/features/overview/overview-state.ts');
const site = { id: '1', name: 'Example', domain: 'example.test', organization: 'Org' };
const context = (overrides = {}) => ({ serverUrl: 'https://analytics.test', siteId: site.id, dateRange: { preset: 'today' }, timeZone: 'UTC', filters: [], ...overrides });
const values = { users: 125, sessions: 80, pageviews: 2000, pages_per_session: 2.5, bounce_rate: 40, session_duration: 90 };
const prior = { users: 100, sessions: 100, pageviews: 1000, pages_per_session: 2, bounce_rate: 50, session_duration: 60 };
function deferred() {
  let resolve; let reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
}

function synchronization(api = {}, bridgeOverride) {
  const requests = []; const contexts = []; const writes = [];
  const bridge = bridgeOverride === undefined ? {
    setContext: key => contexts.push(key),
    writeSnapshot: (key, json) => writes.push({ key, snapshot: JSON.parse(json), json }),
  } : bridgeOverride;
  const sync = createLoader({
    './native-widget': { widgetBridge: bridge },
    '@/api/rybbit/client': {
      getOverview: (...args) => { requests.push(['current', ...args]); return api.current ? api.current(...args) : Promise.resolve(values); },
      getPreviousOverview: (...args) => { requests.push(['previous', ...args]); return api.previous ? api.previous(...args) : Promise.resolve(prior); },
    },
  })('src/features/widgets/widget-sync.ts');
  function activate(query = context(), selected = site) {
    sync.setWidgetContext(query.serverUrl, selected, query.timeZone);
    return result(query, selected);
  }
  function result(query = context(), selected = site) {
    const now = Date.now();
    return {
      context: query, site: selected, overview: values, previous: prior,
      requestedAt: now, updatedAt: now, signal: new AbortController().signal,
      widgetRevision: sync.currentWidgetRevision(),
    };
  }
  return { ...sync, requests, contexts, writes, activate, result };
}

test('widget snapshots use all six Dashboard metric values and comparison semantics', () => {
  const snapshot = createWidgetSnapshot(context(), site, values, prior, Date.parse('2026-10-22T03:00:00Z'));
  assert.deepEqual(snapshot.metrics.map(metric => [metric.id, metric.label, metric.value]), [
    ['users', 'Unique Users', '125'], ['sessions', 'Sessions', '80'], ['pageviews', 'Pageviews', '2k'],
    ['pages_per_session', 'Pages per Session', '2.5'], ['bounce_rate', 'Bounce Rate', '40%'], ['session_duration', 'Session Duration', '1m 30s'],
  ]);
  for (const metric of snapshot.metrics) {
    assert.equal(metric.value, formatOverviewValue(values[metric.id], metric.id));
    assert.deepEqual(metric.change, metricChange(values[metric.id], prior[metric.id], metric.id));
  }
  assert.deepEqual(snapshot.metrics.find(metric => metric.id === 'bounce_rate').change, { percent: 20, direction: 'down', tone: 'positive' });
  assert.deepEqual(snapshot.metrics.find(metric => metric.id === 'sessions').change, { percent: 20, direction: 'down', tone: 'negative' });
});

test('zero traffic remains real widget data while missing and zero comparison baselines stay unavailable', () => {
  const zero = Object.fromEntries(Object.keys(values).map(id => [id, 0]));
  const snapshot = createWidgetSnapshot(context(), site, zero, zero, Date.now());
  assert.deepEqual(snapshot.metrics.map(metric => metric.value), ['0', '0', '0', '0.0', '0%', '0m 0s']);
  assert.ok(snapshot.metrics.every(metric => metric.change === null));
  const missing = createWidgetSnapshot(context(), site, { users: 7 }, null, Date.now());
  assert.equal(missing.metrics[0].value, '7');
  assert.ok(missing.metrics.slice(1).every(metric => metric.value === '—' && metric.change === null));
  assert.equal(formatOverviewValue(Infinity, 'users'), '—');
  assert.equal(formatOverviewValue(15_800, 'pageviews'), '15.8k');
  assert.equal(formatOverviewValue(1_200_000, 'users'), '1.2m');
});

test('shared widget payload explicitly allows display fields and excludes credentials, server URLs, filters and raw data', () => {
  const credential = 'secret-widget-test-api-key';
  const query = context({ apiKey: credential, connection: { apiKey: credential } });
  const selected = { ...site, apiKey: credential, serverUrl: query.serverUrl };
  const snapshot = createWidgetSnapshot(query, selected, { ...values, credential }, prior, 1_792_635_000_000, '2026-10-22');
  assert.deepEqual(Object.keys(snapshot).sort(), ['metrics', 'reportDate', 'siteDomain', 'siteId', 'timeZone', 'updatedAt', 'version'].sort());
  for (const metric of snapshot.metrics) assert.deepEqual(Object.keys(metric).sort(), ['change', 'id', 'label', 'value']);
  const json = JSON.stringify(snapshot);
  for (const excluded of [credential, query.serverUrl, 'apiKey', 'connection', 'filters', 'organization']) assert.equal(json.includes(excluded), false);
  assert.equal(snapshot.siteDomain, site.domain);
  assert.equal(createWidgetSnapshot(query, { ...site, domain: ' ', name: ' Fallback ' }, values, null, Date.now()).siteDomain, 'Fallback');
});

test('only Today without filters for the matching selected site can be labeled as a widget snapshot', () => {
  const filtered = context({ filters: [{ parameter: 'country', type: 'equals', value: ['HK'] }] });
  const older = context({ dateRange: { preset: 'yesterday' } });
  assert.equal(isWidgetReportingContext(context()), true);
  assert.equal(isWidgetReportingContext(filtered), false);
  for (const query of [filtered, older, context({ siteId: 'another-site' })]) {
    assert.equal(createWidgetSnapshot(query, site, values, prior, Date.now()), null);
  }
  assert.equal(createWidgetSnapshot(context(), site, {}, null, Date.now()), null);
  assert.equal(createWidgetSnapshot(context(), site, values, prior, NaN), null);
  assert.notEqual(widgetContextKey('https://first.test', '1', 'UTC'), widgetContextKey('https://second.test', '1', 'UTC'));
  assert.notEqual(widgetContextKey('https://first.test', '1', 'UTC'), widgetContextKey('https://first.test', '2', 'UTC'));
  assert.notEqual(widgetContextKey('https://first.test', '1', 'UTC'), widgetContextKey('https://first.test', '1', 'Asia/Hong_Kong'));
});

test('widget report dates use the Dashboard analytics timezone at midnight boundaries', () => {
  const now = new Date('2026-10-22T00:30:00Z');
  assert.equal(widgetReportDate('UTC', now), '2026-10-22');
  assert.equal(widgetReportDate('America/Los_Angeles', now), '2026-10-21');
  assert.equal(widgetReportDate('Asia/Hong_Kong', now), '2026-10-22');
});

test('Today widget sync reuses the successful Dashboard response without additional network requests', async () => {
  const sync = synchronization(); const result = sync.activate();
  await sync.syncDashboardWidget(result);
  assert.deepEqual(sync.requests, []);
  assert.equal(sync.writes.length, 1);
  assert.equal(sync.writes[0].snapshot.updatedAt, result.updatedAt);
  assert.equal(sync.writes[0].snapshot.reportDate, widgetReportDate('UTC', new Date(result.requestedAt)));
  assert.equal(sync.writes[0].key, widgetContextKey(result.context.serverUrl, site.id, 'UTC'));
});

test('other Dashboard ranges and filters fetch one pinned Today and prior period using the same unfiltered context', async () => {
  const filter = { parameter: 'country', type: 'equals', value: ['HK'] };
  for (const query of [context({ dateRange: { preset: 'last-7-days' } }), context({ filters: [filter] })]) {
    const original = structuredClone(query);
    const sync = synchronization(); const result = sync.activate(query);
    result.overview = { users: 9999 };
    await sync.syncDashboardWidget(result);
    assert.deepEqual(sync.requests.map(([period]) => period), ['current', 'previous']);
    const fixed = sync.requests[0][1]; const today = widgetReportDate(query.timeZone);
    assert.equal(sync.requests[1][1], fixed);
    assert.deepEqual(fixed, { ...query, filters: [], dateRange: { preset: 'custom', startDate: today, endDate: today } });
    assert.ok(sync.requests.every(([, , signal]) => signal === result.signal));
    assert.equal(sync.writes[0].snapshot.metrics[0].value, '125');
    assert.equal(sync.writes[0].snapshot.reportDate, today);
    assert.deepEqual(query, original);
  }
});

test('a Today Dashboard request spanning calendar days fetches the new fixed day instead of relabeling old totals', async () => {
  const sync = synchronization(); const result = sync.activate();
  result.requestedAt = Date.parse('2000-01-01T12:00:00Z');
  result.overview = { users: 9999 };
  await sync.syncDashboardWidget(result);
  assert.equal(sync.requests.length, 2);
  assert.equal(sync.writes[0].snapshot.reportDate, widgetReportDate('UTC'));
  assert.equal(sync.writes[0].snapshot.metrics[0].value, '125');
});

test('network failures preserve cached widget data and unavailable comparison data does not discard current totals', async () => {
  const sync = synchronization({ current: async () => { throw new Error('offline'); } });
  await sync.syncDashboardWidget(sync.activate());
  const cached = sync.writes[0];
  await sync.syncDashboardWidget(sync.result(context({ dateRange: { preset: 'last-7-days' } })));
  assert.deepEqual(sync.writes, [cached]);
  const comparison = synchronization({ previous: async () => { throw new Error('previous period unsupported'); } });
  await comparison.syncDashboardWidget(comparison.activate(context({ dateRange: { preset: 'last-7-days' } })));
  assert.equal(comparison.writes[0].snapshot.metrics[0].value, '125');
  assert.ok(comparison.writes[0].snapshot.metrics.every(metric => metric.change === null));
});

test('unsupported platforms do no widget work and native storage failures cannot fail the Dashboard', async () => {
  const unsupported = synchronization({}, null);
  await unsupported.syncDashboardWidget(unsupported.activate());
  assert.deepEqual(unsupported.requests, []);
  const failedStorage = synchronization({}, { setContext() {}, writeSnapshot() { throw new Error('App Group unavailable'); } });
  await assert.doesNotReject(failedStorage.syncDashboardWidget(failedStorage.activate()));
});

test('native context failures still invalidate outstanding responses and a later successful write retries the context', async () => {
  const pending = deferred(); const nativeCalls = []; let unavailable = true;
  const sync = synchronization({ current: () => pending.promise }, {
    setContext: key => {
      nativeCalls.push(['context', key]);
      if (unavailable) throw new Error('App Group unavailable');
    },
    writeSnapshot: (key, json) => nativeCalls.push(['snapshot', key, JSON.parse(json)]),
  });
  let result;
  assert.doesNotThrow(() => { result = sync.activate(context({ dateRange: { preset: 'last-7-days' } })); });
  const earlierRevision = sync.currentWidgetRevision();
  const completion = sync.syncDashboardWidget(result);
  assert.doesNotThrow(() => sync.setWidgetContext('https://analytics.test', site, 'UTC'));
  assert.ok(sync.currentWidgetRevision() > earlierRevision);
  pending.resolve(values); await completion;
  assert.equal(nativeCalls.filter(([kind]) => kind === 'snapshot').length, 0);
  unavailable = false;
  await assert.doesNotReject(sync.syncDashboardWidget(sync.result()));
  assert.deepEqual(nativeCalls.slice(-2).map(([kind]) => kind), ['context', 'snapshot']);
  assert.equal(nativeCalls.at(-1)[2].metrics[0].value, '125');
});

test('aborted requests and mismatched selected sites never publish widget data', async () => {
  const sync = synchronization(); const result = sync.activate();
  const controller = new AbortController(); controller.abort();
  await sync.syncDashboardWidget({ ...result, signal: controller.signal });
  await sync.syncDashboardWidget({ ...result, site: { ...site, id: '2' } });
  assert.equal(sync.writes.length, 0);
  assert.equal(sync.requests.length, 0);
  const pending = deferred(); const fetching = synchronization({ current: () => pending.promise });
  const request = fetching.activate(context({ dateRange: { preset: 'last-7-days' } }));
  const cancellation = new AbortController(); request.signal = cancellation.signal;
  const completion = fetching.syncDashboardWidget(request);
  cancellation.abort(); pending.resolve(values); await completion;
  assert.equal(fetching.writes.length, 0);
});

test('site, timezone and reconnect revisions prevent outstanding responses from repopulating the previous context', async () => {
  const changes = [
    sync => sync.setWidgetContext('https://analytics.test', { ...site, id: '2' }, 'UTC'),
    sync => sync.setWidgetContext('https://analytics.test', site, 'Asia/Hong_Kong'),
    sync => sync.setWidgetContext(null, null, 'UTC'),
    // A replaced API key can keep the same URL and site, but must still invalidate old responses.
    sync => sync.setWidgetContext('https://analytics.test', site, 'UTC'),
  ];
  for (const change of changes) {
    const pending = deferred(); const sync = synchronization({ current: () => pending.promise });
    const result = sync.activate(context({ dateRange: { preset: 'last-7-days' } }));
    const completion = sync.syncDashboardWidget(result);
    change(sync); pending.resolve(values); await completion;
    assert.equal(sync.writes.length, 0);
    await sync.syncDashboardWidget(result);
    assert.equal(sync.writes.length, 0);
    assert.equal(sync.requests.length, 2);
  }
});

test('a slower earlier Dashboard sync cannot overwrite a newer successful snapshot', async () => {
  const earlier = deferred(); const later = deferred(); let calls = 0;
  const sync = synchronization({ current: () => (++calls === 1 ? earlier : later).promise });
  const result = sync.activate(context({ dateRange: { preset: 'last-7-days' } }));
  const first = sync.syncDashboardWidget(result); const second = sync.syncDashboardWidget(sync.result(result.context));
  later.resolve({ ...values, users: 222 }); await second;
  earlier.resolve({ ...values, users: 111 }); await first;
  assert.equal(sync.writes.length, 1);
  assert.equal(sync.writes[0].snapshot.metrics[0].value, '222');
});

test('widget deep links wait for startup restoration then reset a warm Dashboard to Today with no filters', async () => {
  let session = { ready: false, serverUrl: 'https://analytics.test', site };
  const changes = []; const targets = [];
  const Entry = createLoader({
    'expo-router': { Redirect: props => { targets.push(props.href); return React.createElement('Redirect', props); } },
    '@/stores/session': { useSession: () => {
      const [dateRange, setDateRange] = React.useState({ preset: 'last-7-days' });
      const [filters, setFilters] = React.useState([{ parameter: 'country', type: 'equals', value: ['HK'] }]);
      const selectDateRange = React.useCallback(value => { changes.push(['range', value]); setDateRange(value); }, []);
      const selectFilters = React.useCallback(value => { changes.push(['filters', value]); setFilters(value); }, []);
      return { ...session, dateRange, filters, selectDateRange, selectFilters };
    } },
  })('src/features/widgets/widget-entry-screen.tsx').default;
  let tree;
  await act(async () => { tree = create(React.createElement(Entry)); });
  assert.equal(tree.toJSON(), null); assert.deepEqual(changes, []); assert.deepEqual(targets, []);
  session = { ...session, ready: true };
  await act(async () => tree.update(React.createElement(Entry)));
  assert.deepEqual(changes, [['range', { preset: 'today' }], ['filters', []]]);
  assert.equal(tree.root.findByType('Redirect').props.href, '/(tabs)/overview');
  await act(async () => tree.unmount());
});

test('widget deep links without a connection or selected site return through guarded startup', async () => {
  for (const session of [{ ready: true, serverUrl: null, site: null }, { ready: true, serverUrl: 'https://analytics.test', site: null }]) {
    const Entry = createLoader({
      'expo-router': { Redirect: 'Redirect' },
      '@/stores/session': { useSession: () => ({ ...session, dateRange: { preset: 'today' }, filters: [], selectDateRange() {}, selectFilters() {} }) },
    })('src/features/widgets/widget-entry-screen.tsx').default;
    let tree;
    await act(async () => { tree = create(React.createElement(Entry)); });
    assert.equal(tree.root.findByType('Redirect').props.href, '/');
    await act(async () => tree.unmount());
  }
});
