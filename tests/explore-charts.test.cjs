const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const createLoader = require('./load-source.cjs');
global.IS_REACT_ACT_ENVIRONMENT = true;
const context = { serverUrl: 'https://example.test/base', siteId: 'site/1', dateRange: { preset: 'last-7-days' }, timeZone: 'Asia/Hong_Kong', filters: [{ parameter: 'country', type: 'equals', value: ['US'] }] };
const config = { baseUrl: context.serverUrl, apiKey: 'synthetic-key' };
const api = createLoader({ '@/storage/connection': { loadConnection: async () => null } })('src/api/rybbit/explore-charts.ts');

test('four chart endpoints share the selected context, use hourly buckets and validate event counts', async () => {
  const calls = [];
  let payload = [{ eventName: 'purchase', count: 3 }, { eventName: 'signup', count: 9 }];
  const loader = createLoader({
    '@/storage/connection': { loadConnection: async () => config },
    './request': { request: async (...args) => { calls.push(args); return { data: payload }; } },
    './breakdown': { getBreakdown: async (query, signal) => { calls.push([query, signal]); return { items: [{ value: 'Chrome', count: 12, percentage: 100 }], totalCount: 1, nextPage: null }; } },
  })('src/api/rybbit/explore-charts.ts');
  const signal = new AbortController().signal;
  assert.equal((await loader.getExploreRanking(context, 'browser', signal)).items[0].value, 'Chrome');
  assert.deepEqual(calls.pop(), [{ context, dimension: 'browser', page: 1, limit: 100 }, signal]);
  assert.deepEqual((await loader.getExploreRanking(context, 'custom', signal)).items, [{ value: 'signup', count: 9 }, { value: 'purchase', count: 3 }]);
  payload = [{ url: 'https://destination.test', count: 4 }];
  await loader.getExploreRanking(context, 'outbound', signal);
  payload = [{ value: 'Subscribe', count: 7 }];
  for (const kind of ['button_click', 'form_submit', 'copy']) await loader.getExploreRanking(context, kind, signal);
  payload = [{ time: '2026-10-15 08:00:00', users: 5, pageviews: 10 }];
  await loader.getWeeklyTrend(context, signal);
  assert.deepEqual(calls.map(call => new URL(call[1], 'https://example.test').pathname), [
    '/sites/site%2F1/events/names', '/sites/site%2F1/events/outbound',
    '/sites/site%2F1/events/autocapture', '/sites/site%2F1/events/autocapture', '/sites/site%2F1/events/autocapture',
    '/sites/site%2F1/overview/time-series',
  ]);
  for (const [connection, path, passedSignal] of calls) {
    assert.equal(connection, config); assert.equal(passedSignal, signal);
    const query = new URL(path, context.serverUrl).searchParams;
    assert.equal(query.get('time_zone'), context.timeZone);
    assert.deepEqual(JSON.parse(query.get('filters')), context.filters);
    assert.ok(query.has('start_date')); assert.ok(query.has('end_date'));
  }
  assert.equal(new URL(calls.at(-1)[1], context.serverUrl).searchParams.get('bucket'), 'hour');
  assert.equal(new URL(calls[2][1], context.serverUrl).searchParams.get('type'), 'button_click');
  for (const bad of [null, {}, [{ eventName: 'x', count: '2' }], [{ eventName: 'x', count: -1 }], [{ eventName: 'x', count: 2.5 }], [{ eventName: 'x', count: 1 }, { eventName: 'x', count: 2 }]]) {
    payload = bad;
    await assert.rejects(loader.getExploreRanking(context, 'custom', signal), /Unexpected/);
  }
  await assert.rejects(loader.getWeeklyTrend({ ...context, serverUrl: 'https://other.test' }, signal), /connection changed/);
});

test('weekly heatmap averages weekday/hour buckets in the analytics timezone and preserves missing data', () => {
  const points = api.parseHourlyPoints([
    { time: '2026-10-12 01:00:00', users: 4, pageviews: 10, bounce_rate: 50 },
    { time: '2026-10-19 01:00:00', users: 8, pageviews: 20, bounce_rate: 30 },
    { time: '2026-10-12 02:00:00', users: 0, pageviews: 0, bounce_rate: null },
    { time: '2026-10-11T17:00:00Z', users: 6, pageviews: 15 },
  ], context.timeZone);
  assert.deepEqual(points.map(point => [point.day, point.hour]), [[0, 1], [0, 1], [0, 2], [0, 1]]);
  const heatmap = api.weeklyHeatmap(points, 'users');
  assert.equal(heatmap.length, 7); assert.equal(heatmap[0].length, 24);
  assert.equal(heatmap[0][1], 6); assert.equal(heatmap[0][2], 0); assert.equal(heatmap[1][1], null);
  assert.equal(api.weeklyHeatmap(points, 'bounce_rate')[0][1], 40);
  assert.equal(api.weeklyHeatmap(points, 'bounce_rate')[0][2], null);
  assert.equal(api.weeklyHeatmap(points, 'sessions')[0][1], null);
  for (const row of [
    { time: '2026-02-30 00:00:00', users: 0, pageviews: 0 },
    { time: 'bad', users: 0, pageviews: 0 },
    { time: '2026-10-12 01:00:00', users: -1, pageviews: 0 },
    { time: '2026-10-12 01:00:00', users: 1, pageviews: 0, bounce_rate: 101 },
    { time: '2026-10-12 01:00:00', users: '1', pageviews: 0 },
  ]) assert.throws(() => api.parseHourlyPoints([row], context.timeZone));
});

const native = Object.fromEntries(['Text', 'View', 'Pressable', 'ScrollView'].map(name => [name, name]));
native.StyleSheet = { create: s => s, absoluteFill: {}, hairlineWidth: 1 };
const Picker = Object.assign(({ children, ...props }) => React.createElement('Picker', props, children), { Item: 'PickerItem' });
const routes = [];
const mocks = {
  'react-native': native,
  'expo-router': { useRouter: () => ({ push: route => routes.push(route) }), Redirect: 'Redirect' },
  'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
  '@/components/analytics-controls': { AnalyticsControls: props => React.createElement('AnalyticsControls', props) },
  '@/components/screen': { Screen: ({ description, sections = [] }) => React.createElement('Screen', null, description, sections.map(section => React.createElement('Section', { key: section.key }, section.header, section.content))) },
  '@/stores/session': { useSession: () => ({ analyticsContext: context, site: { id: context.siteId, name: 'Site', domain: 'site.test' }, dateRange: context.dateRange, timeZone: context.timeZone, selectDateRange: () => {} }) },
  '@expo/ui': { Host: 'Host', Picker },
  'lucide-react-native': Object.fromEntries(['ChartNoAxesColumn', 'Globe', 'Laptop', 'FileText', 'ChevronRight', 'MousePointerClick'].map(name => [name, name])),
  '@/components/loading-skeleton': { LoadingSkeleton: props => React.createElement('Skeleton', props) },
  '@/storage/connection': { loadConnection: async () => null },
};
const text = node => Array.isArray(node) ? node.map(text).join('') : typeof node === 'string' ? node : node?.children?.map(text).join('') ?? '';
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }

test('chart categories cancel stale requests, refresh independently and keep last successful data', async t => {
  const { ExploreCharts } = createLoader(mocks)('src/features/explore/explore-charts.tsx');
  const requests = []; let fail = false; let pending = null;
  const loadRanking = async (query, kind, signal) => {
    requests.push({ query, kind, signal });
    if (pending && kind === 'device_type') return pending.promise;
    if (fail && kind === 'country') throw new Error('Locations unavailable');
    return { items: [{ value: kind === 'country' ? 'US' : kind, count: 12 }], totalCount: 1, nextPage: null };
  };
  const loadWeekly = async (query, signal) => {
    requests.push({ query, kind: 'weekly', signal });
    return [{ day: 0, hour: 1, metrics: { users: 4, pageviews: 10 } }];
  };
  const ref = React.createRef(); let tree;
  await act(async () => { tree = create(React.createElement(ExploreCharts, { context, loadRanking, loadWeekly, ref })); });
  t.after(async () => { await act(async () => tree.unmount()); });
  assert.deepEqual(requests.map(request => request.kind), ['pathname', 'browser', 'country', 'custom', 'weekly']);
  for (const request of requests) assert.equal(request.query, context);
  assert.match(text(tree.toJSON()), /United States/);
  assert.match(text(tree.toJSON()), /Weekly Trends/);
  await act(async () => { tree.root.findByProps({ accessibilityLabel: 'Mon 01:00, 4 Unique Visitors' }).props.onPress(); });
  assert.match(text(tree.toJSON()), /Mon 01:00 · 4 Unique Visitors/);
  await act(async () => { tree.root.findByType('Picker').props.onValueChange('sessions'); });
  assert.match(text(tree.toJSON()), /server did not return sessions/);
  assert.equal(requests.length, 5, 'changing the heatmap metric reuses hourly data');
  pending = deferred();
  await act(async () => { tree.root.findByProps({ accessibilityLabel: 'Technology: Devices' }).props.onPress(); });
  assert.equal(requests[1].signal.aborted, true);
  assert.equal(tree.root.findAllByProps({ accessibilityLabel: 'browser, 12 sessions' }).length, 0);
  const oldDevice = requests.at(-1);
  await act(async () => { tree.root.findByProps({ accessibilityLabel: 'Technology: Operating Systems' }).props.onPress(); });
  assert.equal(oldDevice.signal.aborted, true);
  await act(async () => pending.resolve({ items: [{ value: 'stale-device', count: 99 }], totalCount: 1, nextPage: null }));
  assert.doesNotMatch(text(tree.toJSON()), /stale-device/);
  fail = true;
  await act(async () => { await ref.current.refresh(); });
  assert.match(text(tree.toJSON()), /Locations unavailable/);
  assert.match(text(tree.toJSON()), /Showing the last successful update/);
  assert.match(text(tree.toJSON()), /United States/);
  fail = false;
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Retry Countries' }).props.onPress());
  assert.doesNotMatch(text(tree.toJSON()), /Locations unavailable/);
  await act(async () => tree.unmount());
  for (const request of requests) assert.equal(request.signal.aborted, true);
});

test('all ranking previews cap at five and chevrons open the selected category', async t => {
  routes.length = 0;
  const { ExploreCharts } = createLoader(mocks)('src/features/explore/explore-charts.tsx');
  const calls = [];
  const loadRanking = async (query, kind, signal, page = 1) => {
    calls.push({ query, kind, signal, page });
    return { items: Array.from({ length: 12 }, (_, i) => ({ value: `${kind}-${i}`, count: 20 - i })), totalCount: 120, nextPage: 2 };
  };
  let tree;
  await act(async () => { tree = create(React.createElement(ExploreCharts, { context, loadRanking, loadWeekly: async () => [{ day: 0, hour: 1, metrics: { users: 4, pageviews: 10 } }] })); });
  t.after(async () => { await act(async () => tree.unmount()); });
  const rows = kind => tree.root.findAllByType('View').filter(node => (node.props.accessibilityLabel || '').startsWith(`${kind}-`));
  for (const [title, kind, section] of [['Content', 'pathname', 'content'], ['Technology', 'browser', 'technology'], ['Locations', 'country', 'locations'], ['Events', 'custom', 'events']]) {
    assert.equal(rows(kind).length, 5);
    const heading = tree.root.findByProps({ accessibilityLabel: `See all ${title}` });
    assert.equal(heading.findAllByType('ChevronRight').length, 1);
    await act(async () => heading.props.onPress());
    assert.deepEqual(routes.at(-1), { pathname: '/explore/[section]', params: { section, kind } });
  }
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Locations: Regions' }).props.onPress());
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'See all Locations' }).props.onPress());
  assert.equal(routes.at(-1).params.kind, 'region');
  assert.equal(calls.length, 5, 'opening details does not fetch extra pages in the preview');
  assert.equal(tree.root.findAllByType('Pressable').filter(node => /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d{2}:00,/.test(node.props.accessibilityLabel || '')).length, 168);
  await act(async () => tree.root.findByType('Picker').props.onValueChange('pageviews'));
  assert.equal(tree.root.findAllByProps({ accessibilityLabel: 'See all Weekly Trends' }).length, 0);
  assert.equal(routes.length, 5);
});

native.FlatList = ({ data, renderItem, ListHeaderComponent, ListFooterComponent, ...props }) => React.createElement('FlatList', props,
  ListHeaderComponent, data.map((item, index) => React.createElement(React.Fragment, { key: item.value }, renderItem({ item, index }))), ListFooterComponent);

test('Content previews all five tabs with five rows and opens the active tab in a complete detail list', async t => {
  const load = createLoader(mocks);
  const { ExploreCharts, rankingLabel } = load('src/features/explore/explore-charts.tsx');
  const Detail = load('src/features/explore/chart-detail-screen.tsx').default;
  const calls = [];
  const choices = [['Pages', 'pathname'], ['Titles', 'page_title'], ['Entries', 'entry_page'], ['Exits', 'exit_page'], ['Hostnames', 'hostname']];
  const loadRanking = async (query, kind, signal, page = 1) => {
    calls.push({ query, kind, signal, page });
    if (!choices.some(([, value]) => value === kind)) return { items: [], totalCount: 0, nextPage: null };
    const start = page === 1 ? 0 : 100;
    return { items: Array.from({ length: page === 1 ? 100 : 5 }, (_, index) => ({ value: `${kind}-${start + index}`, count: 200 - start - index })), totalCount: 105, nextPage: page === 1 ? 2 : null };
  };
  let preview; let detail;
  await act(async () => { preview = create(React.createElement(ExploreCharts, { context, loadRanking, loadWeekly: async () => [] })); });
  t.after(async () => { await act(async () => { preview.unmount(); detail?.unmount(); }); });
  for (const [label, kind] of choices) {
    await act(async () => preview.root.findByProps({ accessibilityLabel: `Content: ${label}` }).props.onPress());
    const rows = preview.root.findAllByType('View').filter(node => (node.props.accessibilityLabel || '').startsWith(`${kind}-`));
    assert.equal(rows.length, 5);
    assert.equal(rows[0].props.accessibilityLabel, `${kind}-0, 200 sessions`);
    await act(async () => preview.root.findByProps({ accessibilityLabel: 'See all Content' }).props.onPress());
    assert.deepEqual(routes.at(-1), { pathname: '/explore/[section]', params: { section: 'content', kind } });
  }
  await act(async () => { detail = create(React.createElement(Detail, { section: 'content', kind: 'page_title', loadRanking })); });
  const rows = () => detail.root.findAllByType('View').filter(node => (node.props.accessibilityLabel || '').startsWith('page_title-'));
  assert.equal(rows().length, 105);
  assert.equal(rows().at(-1).props.accessibilityLabel, 'page_title-104, 96 sessions');
  assert.equal(detail.root.findByProps({ accessibilityLabel: 'Content: Titles' }).props.accessibilityState.selected, true);
  assert.deepEqual(calls.filter(call => call.kind === 'page_title').map(call => call.page), [1, 1, 2]);
  await act(async () => detail.root.findByProps({ accessibilityLabel: 'Content: Entries' }).props.onPress());
  assert.equal(detail.root.findAllByType('View').filter(node => (node.props.accessibilityLabel || '').startsWith('entry_page-')).length, 105);
  for (const [, kind] of choices.slice(0, 4)) {
    assert.equal(rankingLabel('', kind), 'Other');
    assert.equal(rankingLabel('-', kind), '-');
  }
});

test('ranking bars preserve rounded API percentages including a zero first percentage', async () => {
  const { RankingBar } = createLoader(mocks)('src/features/explore/explore-charts.tsx');
  let tree;
  await act(async () => { tree = create(React.createElement(RankingBar, { item: { value: '/long/path', count: 1, percentage: 33.33 }, kind: 'pathname', maximum: 3, firstPercentage: 100, eventCounts: false })); });
  const width = () => tree.root.findAllByType('View').find(node => node.props.accessible === false).props.style[1].width;
  assert.equal(width(), '33.33%');
  await act(async () => tree.update(React.createElement(RankingBar, { item: { value: '/', count: 1, percentage: 0 }, kind: 'pathname', maximum: 1, firstPercentage: 0, eventCounts: false })));
  assert.equal(width(), '0%');
  await act(async () => tree.unmount());
});

test('ranking detail reads all pages, preserves raw order, retries and cancels stale categories', async t => {
  const Detail = createLoader(mocks)('src/features/explore/chart-detail-screen.tsx').default;
  const calls = []; let fail = false; const stale = deferred();
  const first = Array.from({ length: 100 }, (_, i) => ({ value: `loc-${i}`, count: 200 - i }));
  const loadRanking = async (query, kind, signal, page = 1) => {
    calls.push({ query, kind, signal, page });
    if (kind === 'region') return stale.promise;
    if (fail) throw new Error('Detail unavailable');
    return page === 1 ? { items: first, totalCount: 105, nextPage: 2 }
      : { items: [first[99], ...Array.from({ length: 5 }, (_, i) => ({ value: `loc-${100 + i}`, count: 5 - i }))], totalCount: 105, nextPage: null };
  };
  let tree;
  await act(async () => { tree = create(React.createElement(Detail, { section: 'locations', kind: 'city', loadRanking })); });
  t.after(async () => { await act(async () => tree.unmount()); });
  const rows = () => tree.root.findAllByType('View').filter(node => /^loc-\d+,/.test(node.props.accessibilityLabel || ''));
  assert.equal(rows().length, 105);
  assert.deepEqual(calls.map(call => [call.kind, call.page]), [['city', 1], ['city', 2]]);
  for (const call of calls) assert.equal(call.query, context);
  assert.equal(rows()[100].props.accessibilityLabel, 'loc-100, 5 sessions');
  assert.deepEqual(tree.root.findByType('AnalyticsControls').props.range, context.dateRange);
  fail = true;
  await act(async () => tree.root.findByType('FlatList').props.onRefresh());
  assert.match(text(tree.toJSON()), /Detail unavailable/); assert.equal(rows().length, 105);
  fail = false;
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Retry Cities' }).props.onPress());
  assert.doesNotMatch(text(tree.toJSON()), /Detail unavailable/);
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Locations: Regions' }).props.onPress());
  assert.equal(rows().length, 0);
  const old = calls.at(-1);
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Locations: Countries' }).props.onPress());
  assert.equal(old.signal.aborted, true);
  await act(async () => stale.resolve({ items: [{ value: 'stale', count: 99 }], totalCount: 1, nextPage: null }));
  assert.doesNotMatch(text(tree.toJSON()), /stale/);
  await act(async () => tree.unmount());
  for (const call of calls) assert.equal(call.signal.aborted, true);
});

test('Weekly Trends shows all 24 hours directly in Explore and switches metrics without navigation', async () => {
  const { ExploreCharts } = createLoader(mocks)('src/features/explore/explore-charts.tsx');
  let calls = 0; let tree;
  await act(async () => { tree = create(React.createElement(ExploreCharts, { context,
    loadRanking: async () => ({ items: [], totalCount: 0, nextPage: null }),
    loadWeekly: async query => { calls++; assert.equal(query, context); return [{ day: 0, hour: 23, metrics: { users: 4, pageviews: 10 } }]; },
  })); });
  assert.equal(tree.root.findAllByType('Pressable').filter(node => /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d{2}:00,/.test(node.props.accessibilityLabel || '')).length, 168);
  assert.ok(tree.root.findByProps({ accessibilityLabel: 'Mon 23:00, 4 Unique Visitors' }));
  assert.equal(tree.root.findAllByProps({ accessibilityLabel: 'See all Weekly Trends' }).length, 0);
  await act(async () => tree.root.findByType('Picker').props.onValueChange('pageviews'));
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Mon 23:00, 10 Pageviews' }).props.onPress());
  assert.match(text(tree.toJSON()), /Mon 23:00 · 10 Pageviews/);
  assert.equal(calls, 1);
  await act(async () => tree.unmount());
});

test('fetching complete rankings stops immediately on cancellation', async () => {
  const controller = new AbortController(); let calls = 0;
  await assert.rejects(api.getCompleteRanking(context, 'city', controller.signal, async () => {
    calls++; controller.abort();
    return { items: [{ value: 'city', count: 1 }], totalCount: 200, nextPage: 2 };
  }), /Cancelled/);
  assert.equal(calls, 1);
});

test('detail route validates section and category parameters before rendering', async () => {
  let params = { section: 'technology', kind: 'operating_system', metric: 'invalid' };
  const Stack = { Screen: 'StackScreen' };
  const Route = createLoader({ ...mocks,
    'expo-router': { Redirect: 'Redirect', useLocalSearchParams: () => params },
    'expo-router/stack': { Stack },
    '@/features/explore/chart-detail-screen': 'ChartDetailScreen',
  })('src/app/explore/[section].tsx').default;
  let tree;
  await act(async () => { tree = create(React.createElement(Route)); });
  assert.equal(tree.root.findByType('StackScreen').props.options.title, 'Technology');
  assert.equal(tree.root.findByType('ChartDetailScreen').props.kind, 'operating_system');
  assert.equal(tree.root.findByType('ChartDetailScreen').props.metric, undefined);
  params = { section: 'events', kind: 'country' };
  await act(async () => tree.update(React.createElement(Route)));
  assert.equal(tree.root.findByType('ChartDetailScreen').props.kind, undefined);
  params = { section: 'weekly', metric: 'sessions' };
  await act(async () => tree.update(React.createElement(Route)));
  assert.equal(tree.root.findByType('Redirect').props.href, '/(tabs)/explore');
  params = { section: 'unrecognized' };
  await act(async () => tree.update(React.createElement(Route)));
  assert.equal(tree.root.findByType('Redirect').props.href, '/(tabs)/explore');
  await act(async () => tree.unmount());
});
