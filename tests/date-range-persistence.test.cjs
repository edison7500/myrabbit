const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const createLoader = require('./load-source.cjs');
global.IS_REACT_ACT_ENVIRONMENT = true;

const key = 'myrabbit.date-range.v1';
const config = { mode: 'self-host', baseUrl: 'https://analytics.test', apiKey: 'private-key' };
const site = { id: '1', name: 'Example', domain: 'example.test', organization: 'Org' };
const { analyticsDatePresets, buildAnalyticsQuery } = createLoader()('src/api/rybbit/date-range.ts');

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

function memory(initial = null, { read, write } = {}) {
  const values = new Map(initial === null ? [] : [[key, initial]]);
  const writes = [];
  const storage = {
    getItem: read ?? (async name => values.get(name) ?? null),
    setItem: async (name, value) => {
      writes.push([name, value]);
      await write?.(name, value);
      values.set(name, value);
    },
  };
  return { values, writes, storage };
}

function storageLoader(store, mocks = {}) {
  return createLoader({
    '@react-native-async-storage/async-storage': { __esModule: true, default: store.storage },
    ...mocks,
  });
}

async function session(store, { loadConnection = async () => config } = {}) {
  let current;
  const load = storageLoader(store, {
    '@/api/rybbit/client': { getSites: async () => [site] },
    '@/storage/connection': { loadConnection, clearConnection: async () => {} },
    '@/storage/selected-site': {
      restoreSelectedSite: async () => site,
      saveSelectedSite: async () => {}, clearSelectedSite: async () => {},
    },
    '@/features/widgets/widget-sync': { setWidgetContext: () => {} },
  });
  const { SessionProvider, useSession } = load('src/stores/session.tsx');
  function Probe() { current = useSession(); return null; }
  let tree;
  await act(async () => { tree = create(React.createElement(SessionProvider, null, React.createElement(Probe))); });
  return { get current() { return current; }, async close() { await act(async () => tree.unmount()); } };
}

test('every preset and custom dates survive a fresh storage module with only canonical range fields', async () => {
  const store = memory();
  for (const range of [...analyticsDatePresets.map(preset => ({ preset })),
    { preset: 'custom', startDate: '2024-02-29', endDate: '2024-03-02' }]) {
    await storageLoader(store)('src/storage/date-range.ts').saveDateRange({ ...range, apiKey: 'must-not-be-saved' });
    const restored = await storageLoader(store)('src/storage/date-range.ts').loadDateRange();
    assert.deepEqual(restored, range);
    assert.deepEqual(JSON.parse(store.values.get(key)), range);
  }
  assert.deepEqual([...store.values.keys()], [key]);
});

test('missing, malformed and invalid saved ranges fall back to Today', async () => {
  const invalid = [null, '', '{', 'null', '[]', '42', '"last-7-days"', '{}',
    '{"preset":"unknown"}', '{"preset":null}',
    '{"preset":"custom","startDate":"2025-02-29","endDate":"2025-03-01"}',
    '{"preset":"custom","startDate":"2026-03-02","endDate":"2026-03-01"}',
    '{"preset":"custom","startDate":"2026-3-01","endDate":"2026-03-02"}',
    '{"preset":"custom","startDate":123,"endDate":"2026-03-02"}'];
  for (const value of invalid) {
    const store = memory(value);
    assert.deepEqual(await storageLoader(store)('src/storage/date-range.ts').loadDateRange(), { preset: 'today' }, String(value));
    assert.equal(store.writes.length, 0);
  }
  const store = memory();
  const { saveDateRange } = storageLoader(store)('src/storage/date-range.ts');
  await assert.rejects(saveDateRange({ preset: 'unknown' }));
  await assert.rejects(saveDateRange({ preset: 'custom', startDate: '2026-02-30', endDate: '2026-03-01' }));
  assert.equal(store.writes.length, 0);
});

test('restored relative presets resolve against the current request date', async () => {
  const store = memory();
  await storageLoader(store)('src/storage/date-range.ts').saveDateRange({ preset: 'last-7-days' });
  const range = await storageLoader(store)('src/storage/date-range.ts').loadDateRange();
  const beforeMidnight = buildAnalyticsQuery(range, 'Asia/Hong_Kong', new Date('2026-10-27T15:59:00Z'));
  const afterMidnight = buildAnalyticsQuery(range, 'Asia/Hong_Kong', new Date('2026-10-27T16:01:00Z'));
  assert.equal(beforeMidnight.get('start_date'), '2026-10-21');
  assert.equal(beforeMidnight.get('end_date'), '2026-10-27');
  assert.equal(afterMidnight.get('start_date'), '2026-10-22');
  assert.equal(afterMidnight.get('end_date'), '2026-10-28');
  assert.deepEqual(JSON.parse(store.values.get(key)), { preset: 'last-7-days' });
});

test('date selection survives provider recreation, site changes, reconnect and local removal', async t => {
  const store = memory();
  const first = await session(store);
  const range = { preset: 'custom', startDate: '2026-09-01', endDate: '2026-09-30' };
  await act(async () => first.current.selectDateRange(range));
  assert.deepEqual(first.current.analyticsContext.dateRange, range);
  await first.close();
  const next = await session(store); t.after(next.close);
  assert.equal(next.current.ready, true);
  assert.deepEqual(next.current.dateRange, range);
  assert.deepEqual(next.current.analyticsContext.dateRange, range);
  await act(async () => next.current.selectSite({ ...site, id: '2' }));
  assert.deepEqual(next.current.dateRange, range);
  await act(async () => next.current.connected(config.baseUrl));
  assert.deepEqual(next.current.dateRange, range);
  await act(async () => next.current.disconnect());
  assert.equal(next.current.analyticsContext, null);
  assert.deepEqual(next.current.dateRange, range);
  assert.deepEqual(JSON.parse(store.values.get(key)), range);
});

test('startup waits for preference restoration and never writes its default over the saved range', async t => {
  const pending = deferred();
  const store = memory(null, { read: () => pending.promise });
  const view = await session(store); t.after(view.close);
  assert.equal(view.current.ready, false);
  assert.equal(store.writes.length, 0);
  await act(async () => pending.resolve(JSON.stringify({ preset: 'this-month' })));
  assert.equal(view.current.ready, true);
  assert.deepEqual(view.current.analyticsContext.dateRange, { preset: 'this-month' });
  assert.equal(store.writes.length, 0);
});

test('preference and credential read failures remain independent during restoration', async t => {
  const unreadable = memory(null, { read: async () => { throw new Error('Storage unavailable'); } });
  const withConnection = await session(unreadable); t.after(withConnection.close);
  assert.equal(withConnection.current.ready, true);
  assert.equal(withConnection.current.serverUrl, config.baseUrl);
  assert.deepEqual(withConnection.current.site, site);
  assert.deepEqual(withConnection.current.dateRange, { preset: 'today' });
  const store = memory(JSON.stringify({ preset: 'last-30-days' }));
  const noConnection = await session(store, { loadConnection: async () => { throw new Error('SecureStore unavailable'); } });
  t.after(noConnection.close);
  assert.equal(noConnection.current.ready, true);
  assert.equal(noConnection.current.serverUrl, null);
  assert.deepEqual(noConnection.current.dateRange, { preset: 'last-30-days' });
});

test('rapid selections save in order while keeping the newest range active', async t => {
  const pending = deferred();
  let writes = 0;
  const store = memory(null, { write: async () => { if (++writes === 1) await pending.promise; } });
  const view = await session(store); t.after(view.close);
  await act(async () => {
    view.current.selectDateRange({ preset: 'last-7-days' });
    view.current.selectDateRange({ preset: 'this-year' });
  });
  assert.deepEqual(view.current.dateRange, { preset: 'this-year' });
  assert.equal(store.writes.length, 1);
  await act(async () => pending.resolve());
  assert.deepEqual(JSON.parse(store.values.get(key)), { preset: 'this-year' });
  assert.deepEqual(store.writes.map(([, value]) => JSON.parse(value)), [{ preset: 'last-7-days' }, { preset: 'this-year' }]);
});

test('a failed preference write keeps analytics usable and does not poison later saves', async t => {
  let fail = true;
  const store = memory(null, { write: async () => { if (fail) throw new Error('Disk unavailable'); } });
  const view = await session(store); t.after(view.close);
  await act(async () => view.current.selectDateRange({ preset: 'yesterday' }));
  assert.deepEqual(view.current.analyticsContext.dateRange, { preset: 'yesterday' });
  fail = false;
  await act(async () => view.current.selectDateRange({ preset: 'last-24-hours' }));
  assert.deepEqual(JSON.parse(store.values.get(key)), { preset: 'last-24-hours' });
});
