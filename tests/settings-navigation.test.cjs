const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const createLoader = require('./load-source.cjs');
global.IS_REACT_ACT_ENVIRONMENT = true;
const native = { ActivityIndicator: 'ActivityIndicator', Pressable: 'Pressable', Text: 'Text', StyleSheet: { create: value => value } };
const site = { id: '1', name: 'Example', domain: 'example.test', organization: 'Org' };
const connection = 'https://analytics.test';

async function startup(session, { loadSites = async () => [], select } = {}) {
  const routes = []; const chosen = [];
  const router = { push: path => routes.push(path) };
  const load = createLoader({
    'expo-router': { Redirect: 'Redirect', useRouter: () => router, useFocusEffect: callback => React.useEffect(callback, [callback]) },
    'react-native': native,
    '@/components/screen': { Screen: 'Screen' },
    '@/api/rybbit/client': { getSites: loadSites },
    '@/stores/session': { useSession: () => {
      const [site, setSite] = React.useState(session.site);
      const selectSite = React.useCallback(async next => {
        chosen.push(next.id);
        if (select) await select(next);
        setSite(next);
      }, []);
      return { ...session, site, selectSite };
    } },
  });
  const Screen = load('src/features/onboarding/startup-screen.tsx').default;
  let tree;
  await act(async () => { tree = create(React.createElement(Screen)); });
  return { tree, routes, chosen, async unmount() { await act(async () => tree.unmount()); } };
}

test('startup waits for readiness and offers Add a site without automatically opening a modal', async () => {
  const view = await startup({ ready: false, serverUrl: null, site: null });
  assert.deepEqual(view.routes, []);
  assert.ok(view.tree.root.findByType('ActivityIndicator'));
  await view.unmount();
  const ready = await startup({ ready: true, serverUrl: null, site: null });
  assert.deepEqual(ready.routes, []);
  assert.equal(ready.tree.root.findByType('Text').props.children, 'Add a site');
  await act(async () => ready.tree.root.findByType('Pressable').props.onPress());
  assert.deepEqual(ready.routes, ['/connect']);
  await ready.unmount();
});

test('an empty server shows a main-page empty state and opens site management only in a modal', async () => {
  const view = await startup({ ready: true, serverUrl: connection, site: null });
  assert.deepEqual(view.routes, []);
  assert.equal(view.tree.root.findByType('Screen').props.title, 'No sites yet');
  const manage = view.tree.root.findAllByType('Pressable').find(node => node.findByType('Text').props.children === 'Manage sites');
  await act(async () => manage.props.onPress());
  assert.deepEqual(view.routes, ['/sites']);
  await view.unmount();
});

test('a restored selected site goes to Dashboard without another discovery request or modal', async () => {
  const view = await startup({ ready: true, serverUrl: connection, site }, { loadSites: () => assert.fail('already selected') });
  assert.deepEqual(view.routes, []);
  assert.equal(view.tree.root.findByType('Redirect').props.href, '/(tabs)/overview');
  await view.unmount();
});

test('after saving, the first accessible site is selected and its Dashboard opens without the site list', async () => {
  const view = await startup({ ready: true, serverUrl: connection, site: null }, { loadSites: async () => [site, { ...site, id: '2' }] });
  assert.deepEqual(view.chosen, ['1']);
  assert.equal(view.tree.root.findByType('Redirect').props.href, '/(tabs)/overview');
  assert.deepEqual(view.routes, []);
  await view.unmount();
});

test('site discovery failures are distinct from empty lists and support retry', async () => {
  let calls = 0;
  const view = await startup({ ready: true, serverUrl: connection, site: null }, { loadSites: async () => {
    if (++calls === 1) throw new Error('Server unreachable');
    return [site];
  } });
  assert.equal(view.tree.root.findByType('Screen').props.title, 'Could not open Dashboard');
  assert.match(JSON.stringify(view.tree.toJSON()), /Server unreachable/);
  assert.deepEqual(view.chosen, []);
  const retry = view.tree.root.findAllByType('Pressable').find(node => node.findByType('Text').props.children === 'Try again');
  await act(async () => retry.props.onPress());
  assert.equal(calls, 2);
  assert.deepEqual(view.chosen, ['1']);
  assert.equal(view.tree.root.findByType('Redirect').props.href, '/(tabs)/overview');
  await view.unmount();
});

test('leaving the main page cancels discovery and prevents late site selection', async () => {
  let finish; let signal;
  const view = await startup({ ready: true, serverUrl: connection, site: null }, { loadSites: next => {
    signal = next; return new Promise(resolve => { finish = resolve; });
  } });
  assert.equal(view.tree.root.findByType('ActivityIndicator').props.accessibilityLabel, 'Opening your Dashboard');
  await view.unmount();
  assert.equal(signal.aborted, true);
  await act(async () => finish([site]));
  assert.deepEqual(view.chosen, []);
});

test('failure to persist an automatic selection retains an actionable error state', async () => {
  const view = await startup({ ready: true, serverUrl: connection, site: null }, { loadSites: async () => [site], select: async () => { throw new Error('Could not remember site'); } });
  assert.equal(view.tree.root.findByType('Screen').props.title, 'Could not open Dashboard');
  assert.match(JSON.stringify(view.tree.toJSON()), /Could not remember site/);
  assert.equal(view.tree.root.findAllByType('Redirect').length, 0);
  await view.unmount();
});

async function settings(currentSite) {
  const events = [];
  const Stack = Object.assign(({ children, ...props }) => React.createElement('Stack', props, children), { Screen: 'StackScreen' });
  const load = createLoader({
    'expo-router': { useNavigation: path => { assert.equal(path, '/'); return { canGoBack: () => true, goBack: () => events.push('close-parent') }; }, useRouter: () => ({ dismissTo: path => events.push(path) }) },
    'expo-router/stack': { Stack },
    'lucide-react-native': { X: 'X' },
    'react-native': native,
    '@/stores/session': { useSession: () => ({ ready: true, site: currentSite }) },
  });
  const Layout = load('src/features/settings/settings-modal-layout.tsx').default;
  let tree;
  await act(async () => { tree = create(React.createElement(Layout)); });
  return { tree, events, async unmount() { await act(async () => tree.unmount()); } };
}

test('settings uses card navigation inside a single modal, with Close targeting the outer stack', async () => {
  const view = await settings(site);
  const stack = view.tree.root.findByType('Stack');
  assert.equal(stack.props.screenOptions.presentation, 'card');
  const screens = view.tree.root.findAllByType('StackScreen');
  assert.deepEqual(screens.filter(node => node.props.name).map(node => node.props.name), ['connect', 'connection-form', 'sites']);
  let close;
  await act(async () => { close = create(stack.props.screenOptions.headerRight()); });
  await act(async () => close.root.findByType('Pressable').props.onPress());
  assert.deepEqual(view.events, ['close-parent']);
  await act(async () => close.unmount());
  await view.unmount();
});

test('closing settings without a selected site returns to startup and prevents interactive dismissal to a guarded dashboard', async () => {
  const view = await settings(null);
  const stack = view.tree.root.findByType('Stack');
  assert.equal(view.tree.root.findAllByType('StackScreen')[0].props.options.gestureEnabled, false);
  let close;
  await act(async () => { close = create(stack.props.screenOptions.headerRight()); });
  await act(async () => close.root.findByType('Pressable').props.onPress());
  assert.deepEqual(view.events, ['/']);
  await act(async () => close.unmount());
  await view.unmount();
});
