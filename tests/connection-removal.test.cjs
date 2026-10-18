const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const createLoader = require('./load-source.cjs');
global.IS_REACT_ACT_ENVIRONMENT = true;
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });
const config = { mode: 'self-host', baseUrl: 'https://analytics.test', apiKey: 'secret' };
const site = { id: '1', name: 'Example', domain: 'example.test', organization: 'Org' };

test('native connection removal deletes only its SecureStore entry, with no network call', async () => {
  let stored = null; const removed = [];
  global.fetch = () => assert.fail('removal must not contact Rybbit');
  const load = createLoader({ 'expo-secure-store': {
    setItemAsync: async (_key, value) => { stored = value; },
    getItemAsync: async () => stored,
    deleteItemAsync: async key => { removed.push(key); stored = null; },
  } });
  const storage = load('src/storage/connection.ts');
  await storage.saveConnection(config);
  await storage.clearConnection();
  assert.equal(await storage.loadConnection(), null);
  assert.deepEqual(removed, ['myrabbit.connection.v1']);
});

test('web connection removal clears memory without writing browser storage or calling the server', async () => {
  global.fetch = () => assert.fail('removal must not contact Rybbit');
  const storage = createLoader()('src/storage/connection.web.ts');
  await storage.saveConnection(config);
  assert.deepEqual(await storage.loadConnection(), config);
  await storage.clearConnection();
  assert.equal(await storage.loadConnection(), null);
});

async function session({ selectionError = false, credentialError = false } = {}) {
  let observed; const events = [];
  const load = createLoader({
    '@/api/rybbit/client': { getSites: async () => [site] },
    '@/storage/connection': {
      loadConnection: async () => config,
      clearConnection: async () => { events.push('credentials'); if (credentialError) throw new Error('SecureStore unavailable'); },
    },
    '@/storage/selected-site': {
      restoreSelectedSite: async () => site, saveSelectedSite: async () => {},
      clearSelectedSite: async () => { events.push('selection'); if (selectionError) throw new Error('selection storage unavailable'); },
    },
  });
  const { SessionProvider, useSession } = load('src/stores/session.tsx');
  function Probe() { observed = useSession(); return null; }
  let tree;
  await act(async () => { tree = create(React.createElement(SessionProvider, null, React.createElement(Probe))); });
  return { get current() { return observed; }, events, async unmount() { await act(async () => tree.unmount()); } };
}

test('disconnection clears credentials, selection, analytics context and filters locally', async () => {
  global.fetch = () => assert.fail('must not send a DELETE or any other server request');
  const view = await session();
  await act(async () => view.current.selectFilters([{ parameter: 'country', type: 'equals', value: ['US'] }]));
  await act(async () => view.current.disconnect());
  assert.deepEqual(view.events, ['selection', 'credentials']);
  assert.equal(view.current.serverUrl, null);
  assert.equal(view.current.site, null);
  assert.equal(view.current.analyticsContext, null);
  assert.deepEqual(view.current.filters, []);
  await view.unmount();
});

for (const failure of ['selectionError', 'credentialError']) {
  test(`${failure} retains the active connection and reports failure for retry`, async () => {
    const view = await session({ [failure]: true });
    await act(async () => assert.rejects(view.current.disconnect(), /unavailable/));
    assert.equal(view.current.serverUrl, config.baseUrl);
    assert.deepEqual(view.current.site, site);
    assert.deepEqual(view.events, failure === 'selectionError' ? ['selection'] : ['selection', 'credentials']);
    await view.unmount();
  });
}

async function screen({ confirm = async () => true, disconnect = async () => {}, sites = [site] } = {}) {
  const routes = []; let confirmations = 0;
  const router = { dismissTo: path => routes.push(path), navigate: path => routes.push(path), push: path => routes.push(path) };
  const native = Object.fromEntries(['View', 'Text', 'Pressable', 'ActivityIndicator'].map(name => [name, name]));
  native.StyleSheet = { create: value => value };
  native.FlatList = ({ data, renderItem, ListHeaderComponent, ListEmptyComponent, ListFooterComponent }) =>
    React.createElement('FlatList', null, ListHeaderComponent, data.map(item => React.createElement(React.Fragment, { key: item.id }, renderItem({ item }))), data.length ? null : ListEmptyComponent, ListFooterComponent);
  const load = createLoader({
    'react-native': native,
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    'lucide-react-native': { Settings2: 'Settings2', Plus: 'Plus' },
    'expo-router': { Redirect: 'Redirect', useRouter: () => router, useFocusEffect: callback => React.useEffect(callback, [callback]) },
    '@/components/loading-skeleton': { LoadingSkeleton: 'LoadingSkeleton' },
    './site-row': { SiteRow: 'SiteRow' },
    '@/components/screen': { Screen: ({ children }) => React.createElement('Screen', null, children) },
    '@/features/sites/connection-row': { ConnectionRow: 'ConnectionRow' },
    '@/features/sites/confirm-connection-removal': { confirmConnectionRemoval: async url => { confirmations++; assert.equal(url, config.baseUrl); return confirm(); } },
    '@/api/rybbit/client': { getSites: async () => sites },
    '@/stores/session': { useSession: () => ({ ready: true, serverUrl: config.baseUrl, site, selectSite: async () => {}, disconnect }) },
  });
  const Screen = load('src/features/onboarding/connections-screen.tsx').default;
  let tree;
  await act(async () => { tree = create(React.createElement(Screen)); });
  return { tree, routes, get confirmations() { return confirmations; }, async unmount() { await act(async () => tree.unmount()); } };
}
const connectionRow = view => view.tree.root.findByType('ConnectionRow');

test('connection setup exposes saved connection removal separately from sites', async () => {
  const view = await screen();
  assert.equal(view.tree.root.findAllByType('SiteRow').length, 0);
  assert.equal(typeof connectionRow(view).props.onRemove, 'function');
  await view.unmount();
});

test('cancelled confirmation preserves the connection and does not navigate', async () => {
  const view = await screen({ confirm: async () => false, disconnect: async () => assert.fail('must preserve credentials') });
  await act(async () => connectionRow(view).props.onRemove());
  assert.equal(view.confirmations, 1);
  assert.deepEqual(view.routes, []);
  await view.unmount();
});

test('confirmed local removal blocks duplicates and closes the modal only after completion', async () => {
  let finish; let calls = 0;
  global.fetch = () => assert.fail('must not contact Rybbit during removal');
  const view = await screen({ disconnect: () => { calls++; return new Promise(resolve => { finish = resolve; }); } });
  await act(async () => { connectionRow(view).props.onRemove(); connectionRow(view).props.onRemove(); });
  assert.equal(view.confirmations, 1);
  assert.equal(calls, 1);
  assert.equal(connectionRow(view).props.removing, true);
  assert.equal(view.tree.root.findByProps({ accessibilityLabel: 'Add connection' }).props.disabled, true);
  assert.deepEqual(view.routes, []);
  await act(async () => finish());
  assert.deepEqual(view.routes, ['/']);
  await view.unmount();
});

test('local removal failures retain the screen with an error and allow retry', async () => {
  let calls = 0;
  const view = await screen({ disconnect: async () => { calls++; throw new Error('disk failure'); } });
  await act(async () => connectionRow(view).props.onRemove());
  assert.deepEqual(view.routes, []);
  assert.match(JSON.stringify(view.tree.toJSON()), /Could not remove the saved connection/);
  assert.equal(connectionRow(view).props.disabled, false);
  await act(async () => connectionRow(view).props.onRemove());
  assert.equal(calls, 2);
  await view.unmount();
});

test('an empty server still exposes connection removal independently of site rows', async () => {
  const view = await screen({ sites: [] });
  assert.ok(connectionRow(view));
  assert.equal(view.tree.root.findAllByType('SiteRow').length, 0);
  await view.unmount();
});

test('the API client exposes no site-deletion operation', () => {
  const client = createLoader({ '@/storage/connection': { loadConnection: async () => config } })('src/api/rybbit/client.ts');
  assert.equal(client.deleteSite, undefined);
});

test('native confirmation explicitly describes local credentials and preserved server data', async () => {
  let alert;
  const { confirmConnectionRemoval } = createLoader({ 'react-native': { Alert: { alert: (...args) => { alert = args; } } } })('src/features/sites/confirm-connection-removal.ts');
  const result = confirmConnectionRemoval(config.baseUrl);
  assert.equal(alert[0], 'Remove saved connection?');
  assert.match(alert[1], /saved API URL and API key/);
  assert.match(alert[1], /on this device/);
  assert.match(alert[1], /sites and analytics data will be kept/);
  assert.doesNotMatch(alert[1], /secret/);
  alert[2][0].onPress();
  assert.equal(await result, false);
});

test('the real site row is an ordinary dashboard control without destructive accessibility actions', async () => {
  const load = createLoader({
    'react-native': { Pressable: 'Pressable', View: 'View', Text: 'Text', ActivityIndicator: 'ActivityIndicator', StyleSheet: { create: value => value } },
    'lucide-react-native': { ChevronRight: 'ChevronRight', Globe: 'Globe' },
  });
  const { SiteRow } = load('src/features/sites/site-row.tsx');
  let opens = 0; let tree;
  await act(async () => { tree = create(React.createElement(SiteRow, { site, current: true, selecting: false, disabled: false, onSelect: () => { opens++; } })); });
  const row = tree.root.findByType('Pressable');
  assert.equal(row.props.accessibilityActions, undefined);
  assert.equal(row.props.onAccessibilityAction, undefined);
  await act(async () => row.props.onPress());
  assert.equal(opens, 1);
  await act(async () => tree.unmount());
});

 test('connection setup opens saved connection for editing and Add opens a blank form', async () => {
  const view = await screen();
  await act(async () => connectionRow(view).props.onEdit());
  await act(async () => view.tree.root.findByProps({ accessibilityLabel: 'Add connection' }).props.onPress());
  assert.deepEqual(view.routes, ['/connection-form', { pathname: '/connection-form', params: { action: 'add' } }]);
  await view.unmount();
});
