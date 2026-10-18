const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const createLoader = require('./load-source.cjs');
global.IS_REACT_ACT_ENVIRONMENT = true;
const originalOS = process.env.EXPO_OS;
afterEach(() => {
  if (originalOS === undefined) delete process.env.EXPO_OS;
  else process.env.EXPO_OS = originalOS;
});
const { lightColors, darkColors, resolveColorScheme } = createLoader()('src/constants/theme.ts');

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

async function appearance({ stored = null, initialSystem = 'light', read, write, web = false, children } = {}) {
  process.env.EXPO_OS = web ? 'web' : 'ios';
  let system = initialSystem;
  let override = 'unspecified';
  let state;
  const subscribers = new Set();
  const nativeOverrides = [], backgrounds = [], writes = [];
  const effective = () => override === 'unspecified' ? system : override;
  const publish = () => subscribers.forEach(callback => callback());
  const native = Object.fromEntries(['View', 'Text', 'Pressable'].map(value => [value, value]));
  native.StyleSheet = { create: value => value };
  native.useColorScheme = () => React.useSyncExternalStore(callback => {
    subscribers.add(callback);
    return () => subscribers.delete(callback);
  }, effective);
  native.Appearance = { setColorScheme: value => {
    nativeOverrides.push(value);
    override = value;
    publish();
  } };
  const Picker = Object.assign(({ children, ...props }) => React.createElement('Picker', props, children), { Item: 'PickerItem' });
  const load = createLoader({
    'react-native': native,
    'expo-system-ui': { setBackgroundColorAsync: async value => { backgrounds.push(value); } },
    '@react-native-async-storage/async-storage': { __esModule: true, default: {
      getItem: read ?? (async () => stored),
      setItem: async (key, value) => { writes.push({ key, value }); if (write) await write(key, value); stored = value; },
    } },
    '@expo/ui': { Host: 'Host', Picker, Row: 'Row', Spacer: 'Spacer', Text: 'NativeText' },
    'lucide-react-native': { ChevronRight: 'ChevronRight' },
    'react-native-svg': { __esModule: true, default: 'Svg', Circle: 'Circle', Defs: 'Defs', LinearGradient: 'LinearGradient', Line: 'Line', Path: 'Path', Stop: 'Stop' },
  });
  const { AppearanceProvider } = load('src/stores/appearance.tsx');
  const { useTheme } = load('src/stores/theme.ts');
  function Probe() {
    state = useTheme();
    return children ? children(load) : null;
  }
  let tree;
  await act(async () => { tree = create(React.createElement(AppearanceProvider, null, React.createElement(Probe))); });
  return {
    tree, state: () => state, stored: () => stored, writes, nativeOverrides, backgrounds,
    system: async next => { await act(async () => { system = next; publish(); }); },
    set: async value => { await act(async () => { await state.setPreference(value); }); },
    close: async () => { await act(async () => tree.unmount()); },
  };
}

test('appearance storage defaults to Auto and validates saved values without touching credentials', async () => {
  for (const stored of [null, '', 'system', '"dark"', 'invalid', 'auto', 'light', 'dark']) {
    const calls = [];
    const storage = createLoader({ '@react-native-async-storage/async-storage': { __esModule: true, default: {
      getItem: async key => { calls.push(key); return stored; }, setItem: async (key, value) => { calls.push([key, value]); },
    } } })('src/storage/appearance.ts');
    assert.equal(await storage.loadAppearance(), ['auto', 'light', 'dark'].includes(stored) ? stored : 'auto');
    await storage.saveAppearance('dark');
    await assert.rejects(storage.saveAppearance('system'), /Auto, Light, or Dark/);
    assert.deepEqual(calls, ['myrabbit.appearance.v1', ['myrabbit.appearance.v1', 'dark']]);
  }
  assert.equal(resolveColorScheme('auto', undefined), 'light');
  assert.equal(resolveColorScheme('auto', 'unspecified'), 'light');
});

test('Auto responds to system changes, explicit overrides remain fixed, and Auto releases the native override', async t => {
  const view = await appearance(); t.after(view.close);
  assert.equal(view.state().ready, true);
  assert.equal(view.state().preference, 'auto');
  assert.equal(view.state().scheme, 'light');
  assert.equal(view.state().colors.background, lightColors.background);
  await view.system('dark');
  assert.equal(view.state().scheme, 'dark');
  await view.set('light');
  await view.system('light'); await view.system('dark');
  assert.equal(view.state().scheme, 'light');
  await view.set('auto');
  assert.equal(view.state().scheme, 'dark');
  assert.equal(view.nativeOverrides.at(-1), 'unspecified');
  await view.system('light');
  assert.equal(view.state().scheme, 'light');
  assert.equal(view.backgrounds.at(-1), lightColors.background);
  assert.deepEqual(view.writes.map(item => item.value), ['light', 'auto']);
});

test('saved appearance restores before readiness and survives provider recreation', async t => {
  const pending = deferred();
  const first = await appearance({ read: () => pending.promise }); t.after(first.close);
  assert.equal(first.state().ready, false);
  await act(async () => pending.resolve('dark'));
  assert.equal(first.state().ready, true);
  assert.equal(first.state().scheme, 'dark');
  assert.equal(first.backgrounds.at(-1), darkColors.background);
  await first.set('light');
  const next = await appearance({ stored: first.stored(), initialSystem: 'dark' }); t.after(next.close);
  assert.equal(next.state().preference, 'light');
  assert.equal(next.state().scheme, 'light');
});

test('unavailable preference storage falls back to Auto; failed writes retain the active mode and allow retry', async t => {
  let fails = true;
  const view = await appearance({ initialSystem: 'dark', read: async () => { throw new Error('Read failure'); }, write: async () => {
    if (fails) throw new Error('Write failure');
  } }); t.after(view.close);
  assert.equal(view.state().ready, true);
  assert.equal(view.state().scheme, 'dark');
  assert.match(view.state().error, /Could not load appearance/);
  await view.set('light');
  assert.equal(view.state().preference, 'auto');
  assert.equal(view.state().scheme, 'dark');
  assert.equal(view.state().saving, false);
  assert.match(view.state().error, /Could not save appearance/);
  fails = false;
  await view.set('light');
  assert.equal(view.state().scheme, 'light');
  assert.equal(view.state().error, '');
});

test('pending writes disable selection and cannot race another mode into storage', async t => {
  const pending = deferred();
  const view = await appearance({ write: () => pending.promise }); t.after(view.close);
  let save;
  await act(async () => { save = view.state().setPreference('dark'); });
  assert.equal(view.state().saving, true);
  await view.set('light');
  assert.equal(view.writes.length, 1);
  await act(async () => { pending.resolve(); await save; });
  assert.equal(view.stored(), 'dark');
  assert.equal(view.state().scheme, 'dark');
});

test('Settings changes native control and chart palettes without losing inspected data; web avoids native Appearance APIs', async t => {
  const view = await appearance({ web: true, children: load => {
    const { AppearanceSettings } = load('src/features/settings/appearance-settings.tsx');
    const { TrendChart, visitorsSeries } = load('src/features/overview/traffic-chart.tsx');
    return React.createElement(React.Fragment, null,
      React.createElement(AppearanceSettings),
      React.createElement(TrendChart, { points: [4, 7].map((users, hour) => ({ time: `2000-01-01 0${hour}:00:00`, users, pageviews: 10 })),
        bucket: 'hour', series: visitorsSeries, interactive: true, accessibilityLabel: 'Visitors' }));
  } }); t.after(view.close);
  const picker = () => view.tree.root.findByType('Picker');
  const chart = () => view.tree.root.findByProps({ accessibilityRole: 'adjustable' });
  assert.equal(picker().props.selectedValue, 'auto');
  assert.deepEqual(view.tree.root.findAllByType('PickerItem').map(item => item.props.value), ['auto', 'light', 'dark']);
  await act(async () => chart().props.onPress({ nativeEvent: { locationX: 320 } }));
  const inspected = chart().props.accessibilityValue.text;
  for (const mode of ['dark', 'light', 'auto']) {
    await act(async () => picker().props.onValueChange(mode));
    const palette = mode === 'dark' ? darkColors : lightColors;
    assert.equal(view.tree.root.findByType('Host').props.colorScheme, mode === 'dark' ? 'dark' : 'light');
    assert.equal(view.tree.root.findAllByType('Path').find(item => item.props.stroke).props.stroke, palette.accent);
    assert.equal(chart().props.accessibilityValue.text, inspected);
    assert.equal(picker().props.selectedValue, mode);
  }
  assert.deepEqual(view.nativeOverrides, []);
});

test('web marks the root theme so system-dark CSS and native form controls respect explicit Light', () => {
  const oldDocument = global.document;
  const root = { dataset: {}, style: {} };
  global.document = { documentElement: root };
  try {
    const { syncBrowserAppearance } = createLoader()('src/stores/browser-appearance.web.ts');
    syncBrowserAppearance('dark');
    assert.equal(root.dataset.theme, 'dark');
    assert.equal(root.style.colorScheme, 'dark');
    syncBrowserAppearance('light');
    assert.equal(root.dataset.theme, 'light');
    assert.equal(root.style.colorScheme, 'light');
  } finally {
    if (oldDocument === undefined) delete global.document;
    else global.document = oldDocument;
  }
});
