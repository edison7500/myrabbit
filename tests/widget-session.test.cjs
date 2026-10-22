const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const createLoader = require('./load-source.cjs');
global.IS_REACT_ACT_ENVIRONMENT = true;

const site = { id: '1', name: 'Example', domain: 'example.test', organization: 'Org' };
const serverUrl = 'https://analytics.test';

async function session({ saved = true, restoreSite = site, widgetFailure = false } = {}) {
  const contexts = []; let current;
  const load = createLoader({
    '@/api/rybbit/client': { getSites: async () => [site] },
    '@/storage/connection': {
      loadConnection: async () => saved ? { baseUrl: serverUrl, apiKey: 'private-key' } : null,
      clearConnection: async () => {},
    },
    '@/storage/selected-site': {
      restoreSelectedSite: async () => restoreSite,
      saveSelectedSite: async () => {}, clearSelectedSite: async () => {},
    },
    '@/features/widgets/widget-sync': widgetFailure ? createLoader({ '@/api/rybbit/client': {}, './native-widget': { widgetBridge: {
      setContext: () => { throw new Error('Shared container unavailable'); }, writeSnapshot: () => {},
    } } })('src/features/widgets/widget-sync.ts') : { setWidgetContext: (...context) => contexts.push(context) },
  });
  const { SessionProvider, useSession } = load('src/stores/session.tsx');
  function Probe() { current = useSession(); return null; }
  let tree;
  await act(async () => { tree = create(React.createElement(SessionProvider, null, React.createElement(Probe))); });
  return { get current() { return current; }, contexts, async unmount() { await act(async () => tree.unmount()); } };
}

test('restored site, site changes and timezone changes select the matching widget context', async () => {
  const view = await session();
  assert.equal(view.current.ready, true);
  assert.deepEqual(view.contexts, [[serverUrl, site, view.current.timeZone]]);
  const nextSite = { ...site, id: '2', domain: 'second.test' };
  await act(async () => view.current.selectSite(nextSite));
  assert.deepEqual(view.contexts.at(-1), [serverUrl, nextSite, view.current.timeZone]);
  await act(async () => view.current.selectTimeZone('Asia/Hong_Kong'));
  assert.deepEqual(view.contexts.at(-1), [serverUrl, nextSite, 'Asia/Hong_Kong']);
  assert.doesNotMatch(JSON.stringify(view.contexts), /private-key/);
  await view.unmount();
});

test('missing local connection or missing restored site invalidates cached widget data', async () => {
  for (const options of [{ saved: false }, { restoreSite: null }]) {
    const view = await session(options);
    const [url, restored] = view.contexts.at(-1);
    assert.equal(restored, null);
    assert.equal(url, options.saved === false ? null : serverUrl);
    await view.unmount();
  }
});

test('replacing credentials on the same URL and removing a connection clear widget context', async () => {
  const view = await session();
  await act(async () => view.current.connected(serverUrl));
  assert.deepEqual(view.contexts.at(-1), [null, null, view.current.timeZone]);
  assert.equal(view.current.site, null);
  await act(async () => view.current.selectSite(site));
  await act(async () => view.current.disconnect());
  assert.equal(view.current.serverUrl, null);
  assert.deepEqual(view.contexts.at(-1), [null, null, view.current.timeZone]);
  await view.unmount();
});

test('failed widget invalidation does not block a local disconnect', async () => {
  const view = await session({ widgetFailure: true });
  await act(async () => view.current.disconnect());
  assert.equal(view.current.serverUrl, null);
  assert.equal(view.current.site, null);
  await view.unmount();
});

test('no-session nullable ratios are unavailable while zero counts remain real data', async () => {
  const load = createLoader({
    '@/storage/connection': { loadConnection: async () => ({ baseUrl: serverUrl, apiKey: 'private-key' }) },
    './request': { request: async () => ({ data: {
      users: 0, sessions: 0, pageviews: 0, pages_per_session: null, bounce_rate: null, session_duration: null,
    } }) },
  });
  const { getOverview } = load('src/api/rybbit/client.ts');
  const result = await getOverview({ serverUrl, siteId: '1', dateRange: { preset: 'today' }, timeZone: 'UTC', filters: [] }, new AbortController().signal);
  assert.deepEqual(result, { users: 0, sessions: 0, pageviews: 0 });
});
