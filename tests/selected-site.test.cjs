const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const createLoader = require('./load-source.cjs');
global.IS_REACT_ACT_ENVIRONMENT = true;

let value = null;
const storage = {
  getItem: async () => value,
  setItem: async (_key, next) => { value = next; },
  removeItem: async () => { value = null; },
};
const load = createLoader({ '@react-native-async-storage/async-storage': storage });
const { loadSelectedSite, saveSelectedSite, restoreSelectedSite } = load('src/storage/selected-site.ts');
const saved = { id: 'site-1', name: 'Old name', domain: 'example.test', organization: 'Org' };

beforeEach(() => { value = null; });

test('selected site storage contains stable ID and non-secret display metadata', async () => {
  await saveSelectedSite('https://analytics.test', saved);
  assert.deepEqual(await loadSelectedSite(), { ...saved, serverUrl: 'https://analytics.test' });
  assert.doesNotMatch(value, /api.?key|credential/i);
});

test('startup refreshes a valid persisted site from the available-site list', async () => {
  await saveSelectedSite('https://analytics.test', saved);
  const current = { ...saved, name: 'Updated name' };
  const restored = await restoreSelectedSite('https://analytics.test', async () => [current], new AbortController().signal);
  assert.deepEqual(restored, current);
  assert.equal((await loadSelectedSite()).name, 'Updated name');
});

test('startup clears a site only after a successful list proves it is absent', async () => {
  await saveSelectedSite('https://analytics.test', saved);
  assert.equal(await restoreSelectedSite('https://analytics.test', async () => [], new AbortController().signal), null);
  assert.equal(await loadSelectedSite(), null);
});

test('startup preserves the saved site during temporary API failures', async () => {
  await saveSelectedSite('https://analytics.test', saved);
  const restored = await restoreSelectedSite('https://analytics.test', async () => { throw new Error('offline'); }, new AbortController().signal);
  assert.deepEqual(restored, saved);
  assert.deepEqual(await loadSelectedSite(), { ...saved, serverUrl: 'https://analytics.test' });
});

test('a saved site from a different server is discarded', async () => {
  await saveSelectedSite('https://old.test', saved);
  assert.equal(await restoreSelectedSite('https://new.test', async () => { throw new Error('must not load'); }, new AbortController().signal), null);
  assert.equal(await loadSelectedSite(), null);
});

test('SessionProvider restores the selected site before marking startup ready', async () => {
  const restored = { id: 'site-1', name: 'Site', domain: 'example.test', organization: 'Org' };
  let receivedServer = '';
  let observed;
  const sessionLoad = createLoader({
    '@/api/rybbit/client': { getSites: async () => [restored] },
    '@/storage/connection': { loadConnection: async () => ({ mode: 'self-host', baseUrl: 'https://analytics.test', apiKey: 'secret' }) },
    '@/storage/selected-site': {
      clearSelectedSite: async () => {}, saveSelectedSite: async () => {},
      restoreSelectedSite: async (serverUrl) => { receivedServer = serverUrl; return restored; },
    },
  });
  const { SessionProvider, useSession } = sessionLoad('src/stores/session.tsx');
  function Probe() { observed = useSession(); return React.createElement('Probe'); }
  let tree;
  await act(async () => { tree = create(React.createElement(SessionProvider, null, React.createElement(Probe))); });
  assert.equal(receivedServer, 'https://analytics.test');
  assert.equal(observed.ready, true);
  assert.equal(observed.serverUrl, 'https://analytics.test');
  assert.deepEqual(observed.site, restored);
  assert.deepEqual(observed.dateRange, { preset: 'today' });
  assert.ok(observed.timeZone);
  assert.deepEqual(observed.filters, []);
  assert.deepEqual(observed.analyticsContext, {
    serverUrl: 'https://analytics.test', siteId: 'site-1', dateRange: { preset: 'today' }, timeZone: observed.timeZone, filters: [],
  });
  await act(async () => {
    observed.selectTimeZone('UTC');
    observed.selectFilters([{ parameter: 'country', type: 'equals', value: ['US'] }]);
  });
  assert.equal(observed.analyticsContext.timeZone, 'UTC');
  assert.deepEqual(observed.analyticsContext.filters, [{ parameter: 'country', type: 'equals', value: ['US'] }]);
  assert.throws(() => observed.selectTimeZone('Not/A_Zone'), /valid analytics timezone/);
  await act(async () => tree.unmount());
});
