const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const createLoader = require('./load-source.cjs');
global.IS_REACT_ACT_ENVIRONMENT = true;
const originalFetch = global.fetch;
const { lightColors: colors } = createLoader()('src/constants/theme.ts');
afterEach(() => { global.fetch = originalFetch; });
const native = Object.fromEntries(['View', 'Text', 'ScrollView', 'RefreshControl', 'Pressable', 'ActivityIndicator', 'TextInput', 'Modal'].map(name => [name, name]));
native.StyleSheet = { create: value => value };
native.useWindowDimensions = () => ({ width: 390, height: 844, scale: 3, fontScale: 1 });
function slot(value) { return React.isValidElement(value) || value == null ? value : React.createElement(value); }
native.FlatList = ({ data = [], renderItem, ListHeaderComponent, ListEmptyComponent, ListFooterComponent, ItemSeparatorComponent, ...props }) =>
  React.createElement('FlatList', props,
    slot(ListHeaderComponent),
    data.map((item, index) => React.createElement(React.Fragment, { key: item.value ?? index },
      renderItem({ item, index }),
      index < data.length - 1 ? slot(ItemSeparatorComponent) : null)),
    data.length ? null : slot(ListEmptyComponent),
    slot(ListFooterComponent));
const Picker = Object.assign(({ children, ...props }) => React.createElement('Picker', props, children), { Item: 'PickerItem' });
const icons = Object.fromEntries(['CalendarDays', 'ChartSpline', 'ChevronDown', 'ChevronRight', 'Globe', 'Link2', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Eye', 'EyeOff', 'ShieldCheck', 'Maximize2', 'Minimize2', 'FileText', 'Laptop', 'MousePointerClick', 'ChartNoAxesColumn', 'X'].map(name => [name, name]));
let exploreHeaderOptions = {};
const headerNavigation = { setOptions: options => { exploreHeaderOptions = { ...exploreHeaderOptions, ...options }; } };
const Link = ({ children, ...props }) => React.createElement('Link', props, children);
const baseMocks = { 'react-native': native, 'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }, 'lucide-react-native': icons,
  'react-native-reanimated': { __esModule: true, default: { View: 'AnimatedView' }, useReducedMotion: () => false },
  'expo-status-bar': { StatusBar: 'StatusBar' },
  '@/api/rybbit/client': {
    getOverview: () => Promise.reject(new Error('Inject an overview loader in component tests.')),
    getPreviousOverview: async () => null,
    getTraffic: () => Promise.reject(new Error('Inject a traffic loader in component tests.')),
  },
  '@/api/rybbit/breakdown': {
    getBreakdown: async () => ({ items: [], totalCount: 0, page: 1, limit: 5, nextPage: null }),
    appendBreakdownPage: (current, page) => {
      const values = new Set(current.map(item => item.value));
      return [...current, ...page.items.filter(item => !values.has(item.value))];
    },
  },
  '@/api/rybbit/explore-charts': {
    ...createLoader({ '@/storage/connection': { loadConnection: async () => null } })('src/api/rybbit/explore-charts.ts'),
    getExploreRanking: async () => ({ items: [], totalCount: 0, nextPage: null }),
    getWeeklyTrend: async () => [],
  },
  'react-native-svg': { __esModule: true, default: 'Svg', Circle: 'Circle', Defs: 'Defs', LinearGradient: 'LinearGradient', Line: 'Line', Path: 'Path', Stop: 'Stop' },
  'expo-router': { Link, useRouter: () => ({ push: () => {} }), useNavigation: () => headerNavigation, useFocusEffect: callback => React.useEffect(callback, [callback]) },
  '@expo/ui': { Host: 'Host', Picker, RNHostView: 'RNHostView', BottomSheet: ({ isPresented, children }) => isPresented ? React.createElement('BottomSheet', null, children) : null, Row: 'Row', Spacer: 'Spacer', Text: 'NativeText' } };
function text(node) { return Array.isArray(node) ? node.map(text).join('') : typeof node === 'string' || typeof node === 'number' ? String(node) : node?.children?.map(text).join('') ?? ''; }
function deferred() { let resolve; let reject; const promise = new Promise((a,b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
function button(tree, label) { return tree.root.findAllByType('Pressable').find(node => text(node).includes(label)); }
function datePicker(tree) {
  if (exploreHeaderOptions.headerRight) {
    const control = exploreHeaderOptions.headerRight();
    return { props: { selectedValue: control.props.value.preset, onValueChange: preset => control.props.onChange({ preset }) } };
  }
  return tree.root.findAllByType('Picker').filter(node => React.Children.toArray(node.props.children).some(item => item.props.value === 'today')).at(-1);
}
function refreshControl(tree) { return tree.root.findAllByType('ScrollView').filter(node => node.props.refreshControl).at(-1).props.refreshControl; }
function dashboardSession(site) {
  return { useSession: () => {
    const [dateRange, selectDateRange] = React.useState({ preset: 'today' });
    const timeZone = 'UTC'; const filters = []; const serverUrl = 'https://example.test';
    const analyticsContext = React.useMemo(() => site ? { serverUrl, siteId: site.id, dateRange, timeZone, filters } : null, [dateRange]);
    return { site, dateRange, timeZone, filters, analyticsContext, selectDateRange };
  } };
}
const saved = { mode: 'self-host', baseUrl: 'https://example.test', apiKey: 'test-key' };

test('connection screen tests before saving, invalidates edits and blocks keyboard bypass', async () => {
  let stored = null; const routes = [];
  const load = createLoader({ ...baseMocks,
    'expo-router': { useLocalSearchParams: () => ({}), useRouter: () => ({ replace: path => routes.push(path), push: path => routes.push(path), navigate: path => routes.push(path), dismissTo: path => routes.push(path) }) },
    '@/stores/session': { useSession: () => ({ connected: () => {} }) },
    '@/storage/connection': { ...createLoader()('src/storage/connection-config.ts'), loadConnection: async () => saved, saveConnection: async value => { stored = value; } },
  });
  const Screen = load('src/features/onboarding/connection-screen.tsx').default;
  let tree; await act(async () => { tree = create(React.createElement(Screen)); });
  assert.equal(button(tree, 'Save & Continue').props.disabled, true);
  const pending = deferred(); global.fetch = () => pending.promise;
  await act(async () => { button(tree, 'Test Connection').props.onPress(); });
  assert.equal(button(tree, 'Testing connection').props.disabled, true);
  assert.equal(stored, null);
  await act(async () => { pending.resolve({ ok: true, status: 200, json: async () => [{ id: 'org' }] }); });
  assert.match(text(tree.toJSON()), /Connection verified/);
  assert.equal(button(tree, 'Save & Continue').props.disabled, false);
  assert.equal(stored, null);
  await act(async () => { tree.root.findByProps({ accessibilityLabel: 'API Key' }).props.onChangeText('different'); });
  assert.equal(button(tree, 'Save & Continue').props.disabled, true);
  assert.doesNotMatch(text(tree.toJSON()), /Connection verified/);
  global.fetch = async () => ({ ok: false, status: 401 });
  await act(async () => { await tree.root.findByProps({ accessibilityLabel: 'API Key' }).props.onSubmitEditing(); });
  assert.match(text(tree.toJSON()), /Invalid API key/); assert.equal(stored, null); assert.equal(routes.length, 0);
  global.fetch = async () => ({ ok: true, status: 200, json: async () => [] });
  await act(async () => { await button(tree, 'Test Connection').props.onPress(); });
  await act(async () => { await button(tree, 'Save & Continue').props.onPress(); });
  assert.equal(stored.apiKey, 'different'); assert.deepEqual(routes, ['/']);
  await act(async () => tree.unmount());
});

test('adding starts with a blank key while editing restores saved credentials', async () => {
  for (const adding of [false, true]) {
    const load = createLoader({ ...baseMocks,
      'expo-router': { useLocalSearchParams: () => adding ? { action: 'add' } : {}, useRouter: () => ({}) },
      '@/stores/session': { useSession: () => ({ serverUrl: saved.baseUrl, connected: () => {} }) },
      '@/storage/connection': { ...createLoader()('src/storage/connection-config.ts'), loadConnection: async () => saved },
    });
    const Form = load('src/features/onboarding/connection-screen.tsx').default;
    let tree;
    await act(async () => { tree = create(React.createElement(Form)); });
    assert.equal(tree.root.findByProps({ accessibilityLabel: 'API Key' }).props.value, adding ? '' : saved.apiKey);
    assert.equal(button(tree, 'Save & Continue').props.disabled, true);
    if (adding) assert.match(text(tree.toJSON()), /replace the saved connection/);
    await act(async () => tree.unmount());
  }
});

test('Dashboard renders six cards, retains them while refreshing, and offers retry after failure', async () => {
  const routes = [];
  const load = createLoader({ ...baseMocks,
    'expo-router': { ...baseMocks['expo-router'], Link, useRouter: () => ({ push: path => routes.push(path), navigate: path => routes.push(path), dismissTo: path => routes.push(path) }) },
    '@/stores/session': dashboardSession({ id: '1', name: 'example.test', domain: 'example.test' }),
  });
  const { Dashboard } = load('src/features/overview/overview-screen.tsx');
  const overview = { users: 544, pageviews: 972, sessions: 571, bounce_rate: 85.8, pages_per_session: 1.7, session_duration: 53 };
  let pending = deferred(); let calls = 0;
  const requestedSites = [];
  const requestedRanges = [];
  const loader = queryContext => { calls++; requestedSites.push(queryContext.siteId); requestedRanges.push(queryContext.dateRange); return pending.promise; };
  let tree; await act(async () => { tree = create(React.createElement(Dashboard, { loadOverview: loader })); });
  assert.equal(tree.root.findByProps({ accessibilityLabel: 'Loading today analytics…' }).props.accessibilityRole, 'progressbar');
  await act(async () => { pending.resolve(overview); });
  for (const label of ['Unique Users', 'Sessions', 'Pageviews', 'Pages per Session', 'Bounce Rate', 'Session Duration']) assert.ok(text(tree.toJSON()).includes(label));
  assert.equal((text(tree.toJSON()).match(/example.test/g) ?? []).length, 1);
  assert.equal(tree.root.findAllByType('Globe').length, 1);
  const visitorsCard = tree.root.findAllByType('Pressable').find(node => node.props.accessibilityLabel === 'Open Visitors details');
  assert.equal(visitorsCard.props.accessibilityRole, 'button');
  assert.equal(visitorsCard.props.style({ pressed: false })[0].flexBasis, '45%');
  await act(async () => { visitorsCard.props.onPress(); });
  assert.deepEqual(routes, ['/metrics/visitors']);
  assert.doesNotMatch(text(tree.toJSON()), /Traffic|Referrers/);
  assert.doesNotMatch(text(tree.toJSON()), /Refresh analytics/);
  assert.doesNotMatch(text(tree.toJSON()), /Demo|Sample data/);
  assert.deepEqual(requestedSites, ['1']);
  assert.deepEqual(requestedRanges, [{ preset: 'today' }]);
  pending = deferred();
  await act(async () => { datePicker(tree).props.onValueChange('last-7-days'); });
  assert.equal(calls, 2); assert.deepEqual(requestedRanges.at(-1), { preset: 'last-7-days' });
  await act(async () => { pending.resolve(overview); });
  pending = deferred();
  const refreshControl = () => tree.root.findByType('ScrollView').props.refreshControl;
  await act(async () => { refreshControl().props.onRefresh(); refreshControl().props.onRefresh(); });
  assert.equal(calls, 3); assert.equal(refreshControl().props.refreshing, true);
  assert.deepEqual(requestedRanges.at(-1), { preset: 'last-7-days' });
  assert.match(text(tree.toJSON()), /544/);
  await act(async () => { pending.reject(new Error('Refresh unavailable')); });
  assert.equal(refreshControl().props.refreshing, false); assert.match(text(tree.toJSON()), /Refresh unavailable/); assert.match(text(tree.toJSON()), /544/);
  pending = deferred();
  await act(async () => { button(tree, 'Try again').props.onPress(); });
  await act(async () => { pending.resolve({ users: 0, sessions: 0 }); });
  assert.doesNotMatch(text(tree.toJSON()), /No data yet|Refresh unavailable/);
  pending = deferred();
  await act(async () => { refreshControl().props.onRefresh(); });
  await act(async () => { pending.resolve(null); });
  assert.match(text(tree.toJSON()), /No data yet/);
  await act(async () => tree.unmount());
});

test('Dashboard displays valid previous-period changes and hides them when comparison fails', async () => {
  const load = createLoader({ ...baseMocks,
    '@/stores/session': dashboardSession({ id: '1', name: 'example.test', domain: 'example.test' }),
  });
  const { Dashboard } = load('src/features/overview/overview-screen.tsx');
  const current = { users: 150, sessions: 80, pageviews: 200, pages_per_session: 2, bounce_rate: 40, session_duration: 120 };
  const previous = { users: 100, sessions: 100, pageviews: 0, pages_per_session: 1, bounce_rate: 50, session_duration: 180 };
  const contexts = []; let comparisonCalls = 0;
  const loadPreviousOverview = async context => {
    contexts.push(context);
    return ++comparisonCalls === 1 ? previous : Promise.reject(new Error('Comparison unavailable'));
  };
  let tree; await act(async () => { tree = create(React.createElement(Dashboard, {
    loadOverview: async () => current, loadPreviousOverview, loadTraffic: async () => [],
  })); });
  assert.equal(comparisonCalls, 1);
  assert.equal(contexts[0].siteId, '1');
  assert.deepEqual(contexts[0].dateRange, { preset: 'today' });
  assert.ok(tree.root.findByProps({ accessibilityLabel: 'Up 50.0 percent from previous period' }));
  assert.equal(tree.root.findAllByProps({ accessibilityLabel: 'Down 20.0 percent from previous period' }).length, 2);
  assert.equal(tree.root.findAllByType('ArrowUp').length, 2);
  assert.equal(tree.root.findAllByType('ArrowDown').length, 3);
  assert.equal(tree.root.findAllByProps({ accessibilityLabel: 'Up 0.0 percent from previous period' }).length, 0);
  await act(async () => { refreshControl(tree).props.onRefresh(); });
  assert.equal(comparisonCalls, 2);
  assert.match(text(tree.toJSON()), /Unique Users150/);
  assert.equal(tree.root.findAllByType('ArrowUp').length, 0);
  assert.equal(tree.root.findAllByType('ArrowDown').length, 0);
  await act(async () => tree.unmount());
});

test('traffic chart redraws to its available width and shows intermediate time labels', async () => {
  const load = createLoader(baseMocks);
  const { TrendChart, visitorsSeries } = load('src/features/overview/traffic-chart.tsx');
  const points = Array.from({ length: 12 }, (_, hour) => ({ time: `2026-01-01 ${String(hour).padStart(2, '0')}:00:00`, users: hour + 4, pageviews: hour + 7 }));
  let tree;
  await act(async () => { tree = create(React.createElement(TrendChart, { points, bucket: 'hour', series: visitorsSeries, height: 140, accessibilityLabel: 'Visitors trend' })); });
  await act(async () => { tree.root.findAllByType('View').find(node => node.props.onLayout).props.onLayout({ nativeEvent: { layout: { width: 640 } } }); });
  assert.equal(tree.root.findByType('Svg').props.viewBox, '0 0 640 140');
  assert.match(tree.root.findAllByType('Path').find(node => node.props.stroke).props.d, /L 640\.00 /);
  assert.match(text(tree.toJSON()), /00:00.*03:00.*06:00.*08:00.*11:00/);
  await act(async () => tree.unmount());
});

test('Visitors route leaves app orientation unchanged', async () => {
  const load = createLoader({
    'expo-router': { Redirect: 'Redirect', useLocalSearchParams: () => ({ metric: 'visitors' }) },
    '@/features/metrics/metric-detail-screen': 'MetricDetailScreen',
  });
  const Route = load('src/app/metrics/[metric].tsx').default;
  let tree;
  await act(async () => { tree = create(React.createElement(Route)); });
  assert.equal(tree.root.findByType('MetricDetailScreen').props.metric, 'visitors');
  assert.equal(require('../app.json').expo.orientation, 'portrait');
  await act(async () => tree.unmount());
});
test('Visitors fills the current series and draws a neutral solid comparison on the same scale', async () => {
  const { TrendChart, visitorsSeries } = createLoader(baseMocks)('src/features/overview/traffic-chart.tsx');
  const points = [{ time: '2026-01-02 00:00:00', users: 5, pageviews: 8 }, { time: '2026-01-02 01:00:00', users: 10, pageviews: 12 }];
  let tree; await act(async () => { tree = create(React.createElement(TrendChart, { points, bucket: 'hour', series: visitorsSeries, comparisonValues: [20, 4], comparisonLabel: 'Yesterday', accessibilityLabel: 'Visitors trend' })); });
  const paths = tree.root.findAllByType('Path');
  assert.equal(paths.length, 3);
  assert.match(paths[0].props.fill, /^url\(#/);
  assert.match(paths[0].props.d, / Z$/);
  assert.equal(paths[1].props.stroke, colors.chartComparison);
  assert.equal(paths[1].props.strokeDasharray, undefined);
  assert.equal(paths[2].props.stroke, colors.accent);
  assert.match(paths[1].props.d, /^M 0\.00 8\.00/);
  assert.match(text(tree.toJSON()), /Yesterday/);
  assert.doesNotMatch(paths[1].props.d, /NaN/);
  await act(async () => tree.unmount());
});

test('Visitors keeps future buckets on the axis but only draws an unfilled dashed transition', async () => {
  const { TrendChart, visitorsSeries } = createLoader(baseMocks)('src/features/overview/traffic-chart.tsx');
  const points = [
    { time: '2000-01-01 00:00:00', users: 5, pageviews: 8 },
    { time: '2000-01-01 01:00:00', users: 10, pageviews: 12 },
    { time: '2099-01-01 02:00:00', users: 0, pageviews: 0 },
    { time: '2099-01-01 03:00:00', users: 0, pageviews: 0 },
  ];
  let tree; await act(async () => { tree = create(React.createElement(TrendChart, {
    points, bucket: 'hour', timeZone: 'Asia/Hong_Kong', series: visitorsSeries, accessibilityLabel: 'Visitors trend',
  })); });
  const paths = tree.root.findAllByType('Path');
  const solid = paths.find(node => node.props.stroke && !node.props.strokeDasharray);
  const future = paths.find(node => node.props.strokeDasharray);
  assert.match(solid.props.d, /L 106\.67 /);
  assert.doesNotMatch(solid.props.d, /213\.33/);
  assert.match(future.props.d, /^M 106\.67 .* L 213\.33 /);
  assert.doesNotMatch(future.props.d, /320\.00/);
  assert.equal(future.props.fill, 'none');
  assert.doesNotMatch(paths[0].props.d, /213\.33/);
  assert.match(text(tree.toJSON()), /03:00/);
  await act(async () => tree.unmount());
});

test('Visitors time boundary uses analytics timezone and bucket precision, including zoned ISO timestamps', () => {
  const { chartElapsedCount } = createLoader(baseMocks)('src/features/overview/traffic-chart.tsx');
  const point = time => ({ time, users: 0, pageviews: 0 });
  const now = new Date('2026-10-18T16:30:00Z');
  const hours = ['2026-10-18 23:00:00', '2026-10-19 00:00:00', '2026-10-19 01:00:00'].map(point);
  assert.equal(chartElapsedCount(hours, 'hour', 'Asia/Hong_Kong', now), 1);
  assert.equal(chartElapsedCount(hours, 'hour', 'UTC', now), 0);
  assert.equal(chartElapsedCount(['2026-10-18T16:00:00Z', '2026-10-18T17:00:00Z'].map(point), 'hour', 'Asia/Hong_Kong', now), 0);
  assert.equal(chartElapsedCount(['2026-10-18 16:29:00', '2026-10-18 16:30:00', '2026-10-18 16:31:00'].map(point), 'minute', 'UTC', now), 1);
  assert.equal(chartElapsedCount(['2026-10-18', '2026-10-19', '2026-10-20'].map(point), 'day', 'Asia/Hong_Kong', now), 1);
  assert.equal(chartElapsedCount(['2026-10-01', '2026-11-01'].map(point), 'month', 'UTC', now), 0);
  assert.equal(chartElapsedCount(['2026-10-17 23:00:00'].map(point), 'hour', 'UTC', now), 1);
  assert.equal(chartElapsedCount([], 'hour', 'UTC', now), 0);
});

test('Today at 21:30 +08 draws the 21–22 bucket dashed on a fixed 0–24 axis', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-18T13:30:00Z') });
  const { TrendChart, visitorsSeries } = createLoader(baseMocks)('src/features/overview/traffic-chart.tsx');
  const points = Array.from({ length: 22 }, (_, hour) => ({ time: `2026-10-18 ${String(hour).padStart(2, '0')}:00:00`, users: hour + 1, pageviews: 2 }));
  let tree; await act(async () => { tree = create(React.createElement(TrendChart, {
    points, bucket: 'hour', fullDay: true, timeZone: 'Asia/Hong_Kong', series: visitorsSeries, accessibilityLabel: 'Visitors trend',
  })); });
  t.after(async () => { await act(async () => tree.unmount()); });
  const paths = tree.root.findAllByType('Path');
  const dashed = paths.find(node => node.props.strokeDasharray);
  const solid = paths.find(node => node.props.stroke && !node.props.strokeDasharray);
  assert.match(dashed.props.d, /^M 280\.00 .* L 293\.33 /);
  assert.match(solid.props.d, / L 280\.00 [\d.]+$/);
  assert.doesNotMatch(paths[0].props.d, /293\.33/);
  assert.match(text(tree.toJSON()), /00:00.*06:00.*12:00.*18:00.*24:00/);
});

test('Today at 01:00 keeps the full axis and full Yesterday comparison even with only two current buckets', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-17T17:00:00Z') });
  const { TrendChart, visitorsSeries } = createLoader(baseMocks)('src/features/overview/traffic-chart.tsx');
  const points = [0, 1].map(hour => ({ time: `2026-10-18 0${hour}:00:00`, users: hour + 2, pageviews: 2 }));
  const comparisonPoints = Array.from({ length: 24 }, (_, hour) => ({ time: `2026-10-17 ${String(hour).padStart(2, '0')}:00:00`, users: 10, pageviews: 20 }));
  let tree; await act(async () => { tree = create(React.createElement(TrendChart, {
    points, comparisonPoints, comparisonLabel: 'Yesterday', bucket: 'hour', fullDay: true, timeZone: 'Asia/Hong_Kong', series: visitorsSeries, accessibilityLabel: 'Visitors trend',
  })); });
  t.after(async () => { await act(async () => tree.unmount()); });
  const paths = tree.root.findAllByType('Path');
  assert.match(paths.find(node => node.props.strokeDasharray).props.d, /^M 13\.33 .* L 26\.67 /);
  assert.match(paths.find(node => node.props.stroke === colors.chartComparison).props.d, / L 320\.00 [\d.]+$/);
  assert.match(text(tree.toJSON()), /00:00.*24:00.*Yesterday/);
  await act(async () => { tree.root.findAllByType('View').find(node => node.props.onLayout).props.onLayout({ nativeEvent: { layout: { width: 640 } } }); });
  assert.match(text(tree.toJSON()), /00:00.*03:00.*06:00.*09:00.*12:00.*15:00.*18:00.*21:00.*24:00/);
});

test('Today bucket endpoints handle midnight, 23–24, missing buckets and ISO timezone conversion', () => {
  const { dailyChartData } = createLoader(baseMocks)('src/features/overview/traffic-chart.tsx');
  const points = [{ time: '2026-10-17T16:00:00Z', users: 7, pageviews: 12 }, { time: '2026-10-18 23:00:00', users: 3, pageviews: 5 }];
  const midnight = dailyChartData(points, undefined, 'Asia/Hong_Kong', new Date('2026-10-17T16:00:00Z'));
  assert.equal(midnight.values.users.length, 25);
  assert.deepEqual(midnight.values.users.slice(0, 3), [0, 7, 0]);
  assert.equal(midnight.elapsedCount, 1);
  assert.equal(midnight.comparisonValues.every(value => value === null), true);
  const lastHour = dailyChartData(points, undefined, 'Asia/Hong_Kong', new Date('2026-10-18T15:59:00Z'));
  assert.equal(lastHour.elapsedCount, 24);
  assert.equal(lastHour.values.users[24], 3);
});

test('Visitors shows the full Today axis with zero current buckets in both portrait and expanded views', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-18T01:00:00Z') });
  const load = createLoader({ ...baseMocks,
    '@/stores/session': dashboardSession({ id: 'site-1', name: 'Site', domain: 'site.test' }),
  });
  const Detail = load('src/features/metrics/metric-detail-screen.tsx').default;
  let tree; await act(async () => { tree = create(React.createElement(Detail, {
    metric: 'visitors', loadDetail: async () => ({ total: 0, points: [], yesterday: null, comparisonError: null }),
  })); });
  t.after(async () => { await act(async () => tree.unmount()); });
  assert.equal(tree.root.findAllByType('Svg').length, 1);
  assert.match(text(tree.toJSON()), /00:00.*24:00/);
  await act(async () => { tree.root.findByProps({ accessibilityLabel: 'Expand Visitors chart' }).props.onPress(); });
  assert.equal(tree.root.findAllByType('Svg').length, 2);
  assert.equal(tree.root.findAllByType('Text').filter(node => node.props.children === '24:00').length, 2);
});

test('Dashboard cancels an active refresh when leaving the screen', async () => {
  const load = createLoader({ ...baseMocks, '@/stores/session': dashboardSession({ id: 'site-1', name: 'Site', domain: 'site.test' }) });
  const { Dashboard } = load('src/features/overview/overview-screen.tsx');
  let signal; let calls = 0;
  const loader = (queryContext, next) => { assert.equal(queryContext.siteId, 'site-1'); assert.deepEqual(queryContext.dateRange, { preset: 'today' }); assert.ok(queryContext.timeZone); signal = next; return ++calls === 1 ? Promise.resolve({ users: 1 }) : new Promise(() => {}); };
  let tree; await act(async () => { tree = create(React.createElement(Dashboard, { loadOverview: loader, loadTraffic: async () => [] })); });
  await act(async () => { refreshControl(tree).props.onRefresh(); });
  await act(async () => tree.unmount()); assert.equal(signal.aborted, true);
});

test('an Explore traffic failure keeps Referrers usable and can be retried independently', async () => {
  const load = createLoader({ ...baseMocks, '@/stores/session': dashboardSession({ id: '1', name: 'Site', domain: 'site.test' }) });
  const { Explore } = load('src/features/explore/explore-screen.tsx');
  let fail = true;
  const points = [{ time: '2026-01-01 00:00:00', users: 2, pageviews: 3 }];
  const loadTraffic = async () => { if (fail) throw new Error('Chart unavailable'); return points; };
  let tree; await act(async () => { tree = create(React.createElement(Explore, { loadOverview: async () => ({ users: 10, pageviews: 20, sessions: 8 }), loadTraffic })); });
  assert.match(text(tree.toJSON()), /Visitors10/);
  assert.match(text(tree.toJSON()), /Unable to load trafficChart unavailable/);
  fail = false;
  await act(async () => { await button(tree, 'Try chart again').props.onPress(); });
  assert.doesNotMatch(text(tree.toJSON()), /Chart unavailable/);
  assert.ok(tree.root.findAllByProps({ accessibilityLabel: 'Traffic trend with 1 time buckets' }).some(node => node.props.accessibilityRole === 'image'));
  const paths = tree.root.findAllByType('Path');
  assert.equal(paths.length, 2); assert.notEqual(paths[0].props.stroke, paths[1].props.stroke);
  for (const path of paths) assert.doesNotMatch(path.props.d, /NaN/);
  await act(async () => tree.unmount());
});

test('Visitors detail inherits the shared site and range, refreshes, and updates the shared range', async () => {
  const load = createLoader({ ...baseMocks, 'expo-router': { Link, Redirect: 'Redirect' },
    '@/stores/session': dashboardSession({ id: 'site-1', name: 'Site', domain: 'site.test' }) });
  const Detail = load('src/features/metrics/metric-detail-screen.tsx').default;
  let pending = deferred(); const requests = [];
  const loader = (metric, queryContext) => { requests.push({ metric, ...queryContext }); return pending.promise; };
  const points = [{ time: '2026-01-01 00:00:00', users: 5, pageviews: 8 }, { time: '2026-01-02 00:00:00', users: 7, pageviews: 10 }];
  let tree; await act(async () => { tree = create(React.createElement(Detail, { metric: 'visitors', loadDetail: loader })); });
  assert.equal(tree.root.findByProps({ accessibilityLabel: 'Loading visitors…' }).props.accessibilityRole, 'progressbar');
  await act(async () => { pending.resolve({ total: 513, points }); });
  assert.match(text(tree.toJSON()), /513Visitors/);
  assert.ok(tree.root.findAllByProps({ accessibilityLabel: 'Visitors trend with 2 time buckets' }).some(node => node.props.accessibilityRole === 'adjustable'));
  await act(async () => { tree.root.findByProps({ accessibilityLabel: 'Expand Visitors chart' }).props.onPress(); });
  assert.ok(tree.root.findByType('Modal'));
  assert.deepEqual(tree.root.findByType('Modal').findAllByType('View').find(node => node.props.style?.[1]?.transform).props.style[1].transform, [{ rotate: '-90deg' }]);
  assert.ok(tree.root.findByProps({ accessibilityLabel: 'Expanded visitors trend with 2 time buckets' }));
  await act(async () => { tree.root.findByProps({ accessibilityLabel: 'Close expanded chart' }).props.onPress(); });
  assert.equal(tree.root.findAllByType('Modal').length, 0);
  assert.deepEqual(requests[0].dateRange, { preset: 'today' }); assert.equal(requests[0].siteId, 'site-1');
  pending = deferred();
  await act(async () => { datePicker(tree).props.onValueChange('last-7-days'); });
  assert.deepEqual(requests.at(-1).dateRange, { preset: 'last-7-days' });
  await act(async () => { pending.resolve({ total: 900, points }); });
  pending = deferred();
  const refreshControl = tree.root.findByType('ScrollView').props.refreshControl;
  await act(async () => { refreshControl.props.onRefresh(); });
  assert.deepEqual(requests.at(-1).dateRange, { preset: 'last-7-days' });
  await act(async () => { pending.resolve({ total: 901, points }); });
  assert.match(text(tree.toJSON()), /901Visitors/);
  await act(async () => tree.unmount());
});

test('Visitors detail handles empty and error results', async () => {
  const make = (loader) => {
    const load = createLoader({ ...baseMocks, 'expo-router': { Link, Redirect: 'Redirect' },
      '@/stores/session': dashboardSession({ id: 'site-1', name: 'Site', domain: 'site.test' }) });
    const Detail = load('src/features/metrics/metric-detail-screen.tsx').default;
    return React.createElement(Detail, { metric: 'visitors', loadDetail: loader });
  };
  let empty; await act(async () => { empty = create(make(async () => ({ total: 0, points: [] }))); });
  assert.match(text(empty.toJSON()), /No data yetNo visitors were recorded/);
  await act(async () => empty.unmount());
  let failed; await act(async () => { failed = create(make(async () => { throw new Error('Visitors unavailable'); })); });
  assert.match(text(failed.toJSON()), /Unable to load dataVisitors unavailable/);
  await act(async () => failed.unmount());
});

test('Traffic detail shows both real series and follows the shared date range', async () => {
  const load = createLoader({ ...baseMocks, 'expo-router': { Link, Redirect: 'Redirect' },
    '@/stores/session': dashboardSession({ id: 'site-1', name: 'Site', domain: 'site.test' }) });
  const Detail = load('src/features/overview/traffic-detail-screen.tsx').default;
  const pending = []; const requests = [];
  const loader = (context, signal) => { const next = deferred(); pending.push(next); requests.push({ context, signal }); return next.promise; };
  const points = [
    { time: '2026-01-01 00:00:00', users: 4, pageviews: 9 },
    { time: '2026-01-01 01:00:00', users: 6, pageviews: 12 },
  ];
  let tree; await act(async () => { tree = create(React.createElement(Detail, { loadTraffic: loader })); });
  assert.equal(tree.root.findByProps({ accessibilityLabel: 'Loading traffic…' }).props.accessibilityRole, 'progressbar');
  assert.equal(requests[0].context.siteId, 'site-1');
  await act(async () => { pending[0].resolve(points); });
  assert.equal(tree.root.findAllByType('Path').filter(node => node.props.stroke).length, 2);
  assert.ok(tree.root.findByProps({ accessibilityLabel: 'Traffic trend with 2 time buckets' }));
  await act(async () => { datePicker(tree).props.onValueChange('last-7-days'); });
  assert.deepEqual(requests[1].context.dateRange, { preset: 'last-7-days' });
  await act(async () => { pending[1].resolve([]); });
  assert.match(text(tree.toJSON()), /No traffic was recorded for this range/);
  await act(async () => { refreshControl(tree).props.onRefresh(); });
  assert.deepEqual(requests[2].context.dateRange, { preset: 'last-7-days' });
  await act(async () => { pending[2].reject(new Error('Traffic unavailable')); });
  assert.match(text(tree.toJSON()), /Traffic unavailable/);
  await act(async () => { button(tree, 'Try again').props.onPress(); });
  await act(async () => { pending[3].resolve(points); });
  assert.equal(tree.root.findAllByType('Path').filter(node => node.props.stroke).length, 2);
  await act(async () => tree.unmount());
  assert.equal(requests[1].signal.aborted, true);
});

test('Explore previews only five referrers and opens the full list', async () => {
  const routes = []; const queries = [];
  const load = createLoader({ ...baseMocks,
    'expo-router': { ...baseMocks['expo-router'], Link, useRouter: () => ({ push: path => routes.push(path), navigate: path => routes.push(path), dismissTo: path => routes.push(path) }) },
    '@/stores/session': dashboardSession({ id: 'site-1', name: 'Site', domain: 'site.test' }),
  });
  const { Explore } = load('src/features/explore/explore-screen.tsx');
  const items = Array.from({ length: 6 }, (_, index) => ({ value: `source-${index}.example`, count: 6 - index, percentage: 30 - index * 4 }));
  const loadReferrers = async (query, signal) => { queries.push({ query, signal }); return { items, totalCount: 20, page: 1, limit: 5, nextPage: 2 }; };
  let tree; await act(async () => { tree = create(React.createElement(Explore, {
    loadOverview: async () => ({ users: 10, pageviews: 20, sessions: 8 }), loadTraffic: async () => [], loadReferrers,
  })); });
  assert.deepEqual(queries[0].query, {
    context: { serverUrl: 'https://example.test', siteId: 'site-1', dateRange: { preset: 'today' }, timeZone: 'UTC', filters: [] },
    dimension: 'referrer', limit: 5,
  });
  assert.equal(tree.root.findAllByType('Link2').length, 1);
  assert.equal(tree.root.findAllByType('Globe').length, 6);
  assert.equal(tree.root.findAllByProps({ accessibilityLabel: 'source-5.example, 1 sessions' }).length, 0);
  assert.equal(tree.root.findAllByProps({ accessibilityLabel: 'source-4.example, 2 sessions' }).length, 1);
  assert.equal(tree.root.findAllByProps({ accessibilityLabel: 'View all referrers' }).length, 0);
  assert.doesNotMatch(text(tree.toJSON()), /View all/);
  await act(async () => { tree.root.findByProps({ accessibilityLabel: 'See all referrers' }).props.onPress(); });
  assert.deepEqual(routes, ['/referrers']);
  await act(async () => { refreshControl(tree).props.onRefresh(); });
  assert.equal(queries.length, 2); assert.equal(queries[1].query.limit, 5);
  await act(async () => { datePicker(tree).props.onValueChange('last-7-days'); });
  assert.deepEqual(queries.at(-1).query.context.dateRange, { preset: 'last-7-days' });
  await act(async () => tree.unmount());
});

test('Explore pins each section header and updates sticky indices when introductory loading content disappears', async t => {
  const load = createLoader({ ...baseMocks, '@/stores/session': dashboardSession({ id: '1', name: 'Site', domain: 'site.test' }) });
  const { Explore } = load('src/features/explore/explore-screen.tsx');
  const overview = deferred(); let tree;
  await act(async () => { tree = create(React.createElement(Explore, { loadOverview: () => overview.promise, loadTraffic: async () => [] })); });
  t.after(async () => { await act(async () => tree.unmount()); });
  const scroll = () => tree.root.findAllByType('ScrollView').find(node => node.props.stickyHeaderIndices);
  assert.deepEqual(scroll().props.stickyHeaderIndices, [1, 3, 5, 7, 9, 11, 13]);
  await act(async () => overview.resolve({ users: 1, pageviews: 1 }));
  assert.deepEqual(scroll().props.stickyHeaderIndices, [0, 2, 4, 6, 8, 10, 12]);
  const children = scroll().children;
  assert.deepEqual(scroll().props.stickyHeaderIndices.map(index => text(children[index])), ['Traffic', 'Referrers', 'Content', 'Technology', 'Locations', 'Events', 'Weekly Trends']);
  for (const icon of ['Link2', 'Laptop', 'MousePointerClick', 'ChartNoAxesColumn']) assert.equal(tree.root.findByType(icon).props.color, colors.muted);
});

test('Dashboard and Explore share date changes while chart requests belong only to Explore', async () => {
  const Context = React.createContext(null);
  const site = { id: 'site-1', name: 'Site', domain: 'site.test' };
  const overviewRequests = []; const trafficRequests = []; const referrerRequests = []; const routes = [];
  const points = [{ time: '2026-01-01 00:00:00', users: 4, pageviews: 7 }];
  const load = createLoader({ ...baseMocks,
    'expo-router': { ...baseMocks['expo-router'], Link, useRouter: () => ({ push: path => routes.push(path), navigate: path => routes.push(path), dismissTo: path => routes.push(path) }) },
    '@/stores/session': { useSession: () => React.use(Context) },
    '@/api/rybbit/client': {
      getOverview: async (context, signal) => { overviewRequests.push({ context, signal }); return { users: 4, pageviews: 7 }; },
      getPreviousOverview: async () => null,
      getTraffic: async (context, signal) => { trafficRequests.push({ context, signal }); return points; },
    },
    '@/api/rybbit/breakdown': { ...baseMocks['@/api/rybbit/breakdown'],
      getBreakdown: async (query, signal) => { referrerRequests.push({ query, signal }); return { items: [], totalCount: 0, nextPage: null }; },
    },
  });
  const Dashboard = load('src/features/overview/overview-screen.tsx').default;
  const Explore = load('src/features/explore/explore-screen.tsx').default;
  function App({ tab }) {
    const [dateRange, selectDateRange] = React.useState({ preset: 'today' });
    const analyticsContext = React.useMemo(() => ({ serverUrl: 'https://example.test', siteId: site.id, dateRange, timeZone: 'UTC', filters: [] }), [dateRange]);
    return React.createElement(Context, { value: { site, dateRange, selectDateRange, analyticsContext, timeZone: 'UTC' } },
      React.createElement('DashboardTab', { hidden: tab !== 'dashboard' }, React.createElement(Dashboard)),
      tab === 'explore' ? React.createElement(Explore) : null);
  }
  let tree;
  await act(async () => { tree = create(React.createElement(App, { tab: 'dashboard' })); });
  assert.equal(trafficRequests.length, 0); assert.equal(referrerRequests.length, 0);
  await act(async () => { tree.update(React.createElement(App, { tab: 'explore' })); });
  assert.equal(trafficRequests.length, 1); assert.equal(referrerRequests.length, 1);
  await act(async () => { tree.root.findByProps({ accessibilityLabel: 'Open Traffic details' }).props.onPress(); });
  await act(async () => { tree.root.findByProps({ accessibilityLabel: 'Open full Traffic chart' }).props.onPress(); });
  assert.deepEqual(routes, ['/traffic', '/traffic']);
  const oldSignal = trafficRequests[0].signal;
  await act(async () => { datePicker(tree).props.onValueChange('last-7-days'); });
  assert.equal(oldSignal.aborted, true);
  assert.deepEqual(trafficRequests.at(-1).context.dateRange, { preset: 'last-7-days' });
  assert.deepEqual(referrerRequests.at(-1).query.context.dateRange, { preset: 'last-7-days' });
  assert.deepEqual(overviewRequests.at(-1).context.dateRange, { preset: 'last-7-days' });
  const beforeRefresh = [overviewRequests.length, trafficRequests.length, referrerRequests.length];
  await act(async () => { refreshControl(tree).props.onRefresh(); });
  assert.deepEqual([overviewRequests.length, trafficRequests.length, referrerRequests.length], beforeRefresh.map(count => count + 1));
  await act(async () => { tree.update(React.createElement(App, { tab: 'dashboard' })); });
  assert.equal(datePicker(tree).props.selectedValue, 'last-7-days');
  assert.doesNotMatch(text(tree.toJSON()), /Traffic|Referrers/);
  await act(async () => tree.unmount());
});

test('Referrers preview failure keeps Explore traffic usable and can be retried', async () => {
  const load = createLoader({ ...baseMocks,
    '@/stores/session': dashboardSession({ id: 'site-1', name: 'Site', domain: 'site.test' }),
  });
  const { Explore } = load('src/features/explore/explore-screen.tsx');
  const pending = []; const signals = [];
  const loadReferrers = (_query, signal) => { const next = deferred(); pending.push(next); signals.push(signal); return next.promise; };
  let tree; await act(async () => { tree = create(React.createElement(Explore, {
    loadOverview: async () => ({ users: 12, pageviews: 15, sessions: 13 }), loadTraffic: async () => [], loadReferrers,
  })); });
  await act(async () => { pending[0].reject(new Error('Referrers unavailable')); });
  assert.match(text(tree.toJSON()), /Visitors12/);
  assert.match(text(tree.toJSON()), /Referrers unavailableTry referrers again/);
  await act(async () => { button(tree, 'Try referrers again').props.onPress(); });
  await act(async () => { pending[1].resolve({ items: [{ value: 'search.example', count: 2, percentage: 100 }], totalCount: 1, page: 1, limit: 5, nextPage: null }); });
  assert.match(text(tree.toJSON()), /search\.example2/);
  assert.doesNotMatch(text(tree.toJSON()), /View all/);
  assert.doesNotMatch(text(tree.toJSON()), /Referrers unavailable/);
  await act(async () => tree.unmount());
  assert.equal(signals[0].aborted, true);
});

test('Referrers detail loads, scales, paginates, refreshes, and follows the shared date range', async () => {
  const load = createLoader({ ...baseMocks,
    'expo-router': { Link, Redirect: 'Redirect' },
    '@/stores/session': dashboardSession({ id: 'site-1', name: 'Site', domain: 'site.test' }),
  });
  const Referrers = load('src/features/referrers/referrers-screen.tsx').default;
  const pending = []; const requests = [];
  const loader = (query, signal) => {
    const next = deferred(); pending.push(next); requests.push({ query, signal }); return next.promise;
  };
  let tree;
  await act(async () => { tree = create(React.createElement(Referrers, { loadBreakdown: loader })); });
  assert.equal(tree.root.findByProps({ accessibilityLabel: 'Loading referrers…' }).props.accessibilityRole, 'progressbar');
  assert.deepEqual(requests[0].query, {
    context: { serverUrl: 'https://example.test', siteId: 'site-1', dateRange: { preset: 'today' }, timeZone: 'UTC', filters: [] },
    dimension: 'referrer', limit: 25,
  });
  await act(async () => { pending[0].resolve({
    items: [
      { value: 'a-very-long-referrer-domain.example', count: 1234, percentage: 80 },
      { value: 'search.example', count: 250, percentage: 20 },
    ], totalCount: 3, page: 1, limit: 25, nextPage: 2,
  }); });
  assert.match(text(tree.toJSON()), /Where sessions came from for the selected range\.Sessions/);
  assert.match(text(tree.toJSON()), /a-very-long-referrer-domain\.example1,234search\.example250/);
  assert.match(text(tree.toJSON()), /Showing 2 of 3 referrers/);
  assert.ok(tree.root.findByProps({ accessibilityLabel: 'a-very-long-referrer-domain.example, 1,234 sessions' }));
  const widths = tree.root.findAll(node => node.props.accessible === false && Array.isArray(node.props.style) && node.props.style.some(value => value?.width))
    .map(node => node.props.style.find(value => value?.width).width);
  assert.deepEqual(widths, ['100%', '25%']);

  await act(async () => { tree.root.findByType('FlatList').props.onEndReached(); });
  assert.equal(requests[1].query.page, 2);
  await act(async () => { pending[1].resolve({
    items: [{ value: 'newsletter.example', count: 100, percentage: 8 }], totalCount: 3, page: 2, limit: 25, nextPage: null,
  }); });
  assert.match(text(tree.toJSON()), /newsletter\.example100Showing 3 of 3 referrers/);

  await act(async () => { tree.root.findByType('FlatList').props.onRefresh(); });
  assert.equal(tree.root.findByType('FlatList').props.refreshing, true);
  assert.match(text(tree.toJSON()), /a-very-long-referrer-domain\.example/);
  await act(async () => { pending[2].resolve({
    items: [{ value: 'fresh.example', count: 40, percentage: 100 }], totalCount: 1, page: 1, limit: 25, nextPage: null,
  }); });
  assert.doesNotMatch(text(tree.toJSON()), /search\.example/);
  assert.match(text(tree.toJSON()), /fresh\.example40Showing 1 of 1 referrers/);

  await act(async () => { datePicker(tree).props.onValueChange('last-7-days'); });
  assert.deepEqual(requests[3].query.context.dateRange, { preset: 'last-7-days' });
  assert.equal(tree.root.findByProps({ accessibilityLabel: 'Loading referrers…' }).props.accessibilityRole, 'progressbar');
  await act(async () => { pending[3].resolve({ items: [], totalCount: 0, page: 1, limit: 25, nextPage: null }); });
  assert.match(text(tree.toJSON()), /No attributed referrers were recorded.*Direct-only sessions are not included/);
  await act(async () => tree.unmount());
});

test('Referrers detail retries failures and cancels work when leaving the screen', async () => {
  const load = createLoader({ ...baseMocks,
    'expo-router': { Link, Redirect: 'Redirect' },
    '@/stores/session': dashboardSession({ id: 'site-1', name: 'Site', domain: 'site.test' }),
  });
  const Referrers = load('src/features/referrers/referrers-screen.tsx').default;
  const pending = []; const signals = [];
  const loader = (_query, signal) => { const next = deferred(); pending.push(next); signals.push(signal); return next.promise; };
  let tree;
  await act(async () => { tree = create(React.createElement(Referrers, { loadBreakdown: loader })); });
  await act(async () => { pending[0].reject(new Error('Referrers unavailable')); });
  assert.match(text(tree.toJSON()), /Unable to load dataReferrers unavailableTry again/);
  await act(async () => { button(tree, 'Try again').props.onPress(); });
  assert.equal(tree.root.findByType('FlatList').props.refreshing, true);
  await act(async () => tree.unmount());
  assert.equal(signals[1].aborted, true);
});

test('tab screens do not double-apply navigator safe areas or automatic scroll insets', async () => {
  const load = createLoader(baseMocks);
  const { Screen } = load('src/components/screen.tsx');
  let tree;
  await act(async () => { tree = create(React.createElement(Screen, { title: 'Dashboard', description: 'Site', navigationHeader: true, tabScreen: true })); });
  assert.equal(tree.root.findByType('SafeAreaView').props.edges.top, 'off');
  assert.equal(tree.root.findByType('SafeAreaView').props.edges.bottom, 'off');
  assert.equal(tree.root.findByType('ScrollView').props.contentInsetAdjustmentBehavior, 'never');
  assert.equal(tree.root.findByType('ScrollView').props.automaticallyAdjustContentInsets, false);
  await act(async () => { tree.update(React.createElement(Screen, { title: 'Connect', description: 'Connection' })); });
  assert.equal(tree.root.findByType('SafeAreaView').props.edges.top, 'additive');
  assert.equal(tree.root.findByType('SafeAreaView').props.edges.bottom, 'additive');
  await act(async () => tree.unmount());
});

test('switching tabs keeps parent header visibility unchanged and only updates its title', async () => {
  let segments = ['(tabs)', 'overview'];
  const Tabs = Object.assign(({ children }) => React.createElement('Tabs', null, children), { Screen: 'TabScreen' });
  const Stack = Object.assign(() => null, { Screen: 'StackScreen' });
  const load = createLoader({ ...baseMocks,
    'expo-router': { Tabs, Redirect: 'Redirect', useSegments: () => segments },
    'expo-router/stack': { Stack },
    '@/stores/session': { useSession: () => ({ ready: true, serverUrl: 'https://example.test', site: { id: '1' } }) },
  });
  const Layout = load('src/app/(tabs)/_layout.tsx').default;
  let tree;
  await act(async () => { tree = create(React.createElement(Layout)); });
  assert.deepEqual(tree.root.findAllByType('TabScreen').map(screen => screen.props.name), ['overview', 'realtime', 'explore', 'settings']);
  for (const [route, title] of [['overview', 'Dashboard'], ['settings', 'Settings'], ['realtime', 'Realtime'], ['explore', 'Explore'], ['overview', 'Dashboard']]) {
    segments = ['(tabs)', route];
    await act(async () => { tree.update(React.createElement(Layout)); });
    assert.deepEqual(tree.root.findByType('StackScreen').props.options, { title });
  }
  await act(async () => tree.unmount());
});


test('chart inspection exposes exact values and supports bounded accessibility navigation', async t => {
  const { TrendChart, trafficSeries } = createLoader(baseMocks)('src/features/overview/traffic-chart.tsx');
  const points = [7, 13, 21].map((users, hour) => ({ time: `2000-01-01 0${hour}:00:00`, users, pageviews: users * 2 }));
  let tree;
  await act(async () => { tree = create(React.createElement(TrendChart, {
    points, bucket: 'hour', series: trafficSeries, interactive: true, accessibilityLabel: 'Inspect traffic',
    comparisonValues: [20, 40, 60], comparisonLabel: 'Yesterday',
  })); });
  t.after(async () => { await act(async () => tree.unmount()); });
  const control = () => tree.root.findByProps({ accessibilityRole: 'adjustable' });
  await act(async () => control().props.onPress({ nativeEvent: { locationX: 160 } }));
  assert.match(control().props.accessibilityValue.text, /01:00:00.*Pageviews: 26.*Visitors: 13/);
  assert.match(text(tree.toJSON()), /Yesterday: 40/);
  await act(async () => control().props.onPress({ nativeEvent: {} }));
  assert.equal(control().props.accessibilityValue.now, 1, 'accessibility activation without coordinates retains a valid bucket');
  await act(async () => control().props.onPress({ nativeEvent: { offsetX: 160 } }));
  assert.equal(control().props.accessibilityValue.now, 1, 'web pointer offset selects the same bucket');
  await act(async () => control().props.onAccessibilityAction({ nativeEvent: { actionName: 'increment' } }));
  assert.equal(control().props.accessibilityValue.now, 2);
  await act(async () => control().props.onAccessibilityAction({ nativeEvent: { actionName: 'increment' } }));
  assert.equal(control().props.accessibilityValue.now, 2);
  await act(async () => control().props.onPress({ nativeEvent: { locationX: -100 } }));
  assert.equal(control().props.accessibilityValue.now, 0);
  await act(async () => control().props.onAccessibilityAction({ nativeEvent: { actionName: 'decrement' } }));
  assert.equal(control().props.accessibilityValue.now, 0);
});

test('Today inspection uses bucket intervals and prevents selecting future or artificial midnight values', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-18T13:30:00Z') });
  const { TrendChart, visitorsSeries } = createLoader(baseMocks)('src/features/overview/traffic-chart.tsx');
  const points = Array.from({ length: 22 }, (_, hour) => ({ time: `2026-10-18 ${String(hour).padStart(2, '0')}:00:00`, users: hour + 1, pageviews: 2 }));
  let tree;
  await act(async () => { tree = create(React.createElement(TrendChart, {
    points, bucket: 'hour', series: visitorsSeries, fullDay: true, timeZone: 'Asia/Hong_Kong', interactive: true,
    accessibilityLabel: 'Today visitors',
  })); });
  t.after(async () => { await act(async () => tree.unmount()); });
  const control = () => tree.root.findByProps({ accessibilityRole: 'adjustable' });
  await act(async () => control().props.onPress({ nativeEvent: { locationX: 9999 } }));
  assert.equal(control().props.accessibilityValue.now, 22);
  assert.match(control().props.accessibilityValue.text, /21:00–22:00.*In progress.*Visitors: 22/);
  await act(async () => control().props.onPress({ nativeEvent: { locationX: 0 } }));
  assert.equal(control().props.accessibilityValue.now, 1);
  assert.match(control().props.accessibilityValue.text, /00:00–01:00.*Visitors: 1/);
  assert.doesNotMatch(control().props.accessibilityValue.text, /In progress/);
});

test('empty charts have no inspection control and large text stacks all six dashboard metrics', async t => {
  const load = createLoader({ ...baseMocks,
    'react-native': { ...native, useWindowDimensions: () => ({ width: 320, height: 568, fontScale: 1.8 }) },
    '@/stores/session': dashboardSession({ id: '1', name: 'Site', domain: 'site.test' }),
  });
  const { TrendChart, visitorsSeries } = load('src/features/overview/traffic-chart.tsx');
  const { Dashboard } = load('src/features/overview/overview-screen.tsx');
  const { MetricCard } = load('src/components/analytics-ui.tsx');
  let chart, dashboard;
  await act(async () => {
    chart = create(React.createElement(TrendChart, { points: [], bucket: 'day', series: visitorsSeries, interactive: true, accessibilityLabel: 'Empty traffic' }));
    dashboard = create(React.createElement(Dashboard, { loadOverview: async () => ({ users: 1234, sessions: 1500 }) }));
  });
  t.after(async () => { await act(async () => { chart.unmount(); dashboard.unmount(); }); });
  assert.equal(chart.root.findAllByProps({ accessibilityRole: 'adjustable' }).length, 0);
  assert.equal(dashboard.root.findAllByType(MetricCard).length, 6);
  assert.ok(dashboard.root.findAllByType(MetricCard).every(card => card.props.singleColumn));
});
