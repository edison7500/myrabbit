const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const createLoader = require('./load-source.cjs');
global.IS_REACT_ACT_ENVIRONMENT = true;
const session = { session_id: 's1', user_id: 'visitor1', country: 'US', device_type: 'desktop', referrer: '', entry_page: '/', exit_page: '/pricing', pageviews: 3, events: 1, session_duration: 65, session_start: '2026-10-10T12:00:00Z', session_end: '2026-10-10T12:01:05Z' };
const api = createLoader({ '@/storage/connection': { loadConnection: async () => null } })('src/api/rybbit/realtime.ts');
test('sessions validate optional fields, reject malformed values and sort newest activity first', () => {
  const rows = api.parseRealtimeSessions({ data: [session, { ...session, session_id: 's2', session_end: '2026-10-10T12:02:00Z', events: null }] });
  assert.equal(rows[0].session_id, 's2'); assert.equal(rows[0].events, null); assert.equal(rows[1].browser, '');
  for (const bad of [{ data: null }, { data: [session, session] }, { data: [{ ...session, pageviews: '3' }] }, { data: [{ ...session, session_end: 'bad' }] }, { data: [{ ...session, events: -1 }] }]) assert.throws(() => api.parseRealtimeSessions(bad));
});
test('SQL session timestamps are UTC in every device timezone, preserving recent activity', () => {
  const { sessionIsActive } = createLoader()('src/features/realtime/session-presentation.ts');
  const originalTZ = process.env.TZ;
  try {
    for (const zone of ['Asia/Hong_Kong', 'America/Los_Angeles', 'UTC']) {
      process.env.TZ = zone;
      const [row] = api.parseRealtimeSessions({ data: [{ ...session,
        session_start: '2026-10-10 14:20:00', session_end: '2026-10-10 14:24:00.123456' }] });
      assert.equal(row.session_start, '2026-10-10T14:20:00.000Z');
      assert.equal(row.session_end, '2026-10-10T14:24:00.123Z');
      const now = Date.parse('2026-10-10T14:25:00Z');
      assert.equal(sessionIsActive(row.session_end, now), true);
      assert.equal(sessionIsActive(row.session_end, now + 5 * 60_000), false);
      assert.match(new Date(row.session_start).toLocaleTimeString('en-GB', { timeZone: 'Asia/Hong_Kong', hour12: false }), /^22:20/);
    }
  } finally {
    if (originalTZ === undefined) delete process.env.TZ;
    else process.env.TZ = originalTZ;
  }
});
test('session timestamps preserve explicit offsets and reject invalid calendar dates', () => {
  const { normalizeSessionTimestamp } = createLoader()('src/api/rybbit/session-timestamp.ts');
  assert.equal(normalizeSessionTimestamp('2026-10-10T22:24:00+08:00'), '2026-10-10T14:24:00.000Z');
  assert.equal(normalizeSessionTimestamp('2026-10-10T07:24:00-07:00'), '2026-10-10T14:24:00.000Z');
  assert.equal(normalizeSessionTimestamp('2026-10-10T14:24:00Z'), '2026-10-10T14:24:00.000Z');
  assert.equal(normalizeSessionTimestamp('2024-02-29 14:24:00'), '2024-02-29T14:24:00.000Z');
  for (const bad of ['2026-02-29 12:00:00', '2026-04-31 12:00:00', '2026-10-10 24:00:00', '2026-10-10', 'bad', null]) assert.throws(() => normalizeSessionTimestamp(bad));
});
test('sessions request uses the selected server and relative time independently of Dashboard range', async () => {
  let captured;
  const load = createLoader({ '@/storage/connection': { loadConnection: async () => ({ baseUrl: 'https://example.test', apiKey: 'synthetic' }) }, './request': { request: async (...args) => { captured = args; return { data: [session] }; } } });
  const { getRealtimeSessions } = load('src/api/rybbit/realtime.ts');
  const signal = new AbortController().signal;
  await getRealtimeSessions('https://example.test', 'site/1', signal);
  assert.match(captured[1], /^\/sites\/site%2F1\/sessions\?/);
  const query = new URLSearchParams(captured[1].split('?')[1]);
  assert.equal(query.get('past_minutes_start'), '30'); assert.equal(query.get('past_minutes_end'), '0'); assert.equal(query.get('limit'), '100'); assert.equal(captured[2], signal);
  await assert.rejects(getRealtimeSessions('https://changed.test', '1', signal), /connection changed/);
});
test('visitor formatting is stable, marks recent activity, and preserves unknown metrics', () => {
  const { visitorIdentity, sessionDuration, referrerLabel, sessionIsActive } = createLoader()('src/features/realtime/session-presentation.ts');
  assert.deepEqual(visitorIdentity('abc'), visitorIdentity('abc'));
  assert.equal(sessionDuration(null), '—'); assert.equal(sessionDuration(65), '1m 5s');
  assert.equal(referrerLabel(''), 'Direct'); assert.equal(referrerLabel('https://www.google.com/search'), 'google.com');
  assert.equal(sessionIsActive(session.session_end, Date.parse(session.session_end) + 299000), true);
  assert.equal(sessionIsActive(session.session_end, Date.parse(session.session_end) + 301000), false);
});
test('table loads, expands details, preserves stale results, cancels in background and on blur', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let appChange; let signal; let fail = false; let calls = 0; let headerOptions = {}; let pending = null;
  const navigation = { setOptions: options => { headerOptions = { ...headerOptions, ...options }; } };
  const native = Object.fromEntries(['Text', 'View', 'Pressable', 'RefreshControl', 'ActivityIndicator'].map(n => [n, n]));
  native.StyleSheet = { create: s => s, hairlineWidth: 1 };
  native.useWindowDimensions = () => ({ width: 390 });
  native.AppState = { currentState: 'active', addEventListener: (_, callback) => { appChange = callback; return { remove() {} }; } };
  native.FlatList = ({ data, renderItem, ListHeaderComponent, ListEmptyComponent, ListFooterComponent, ...props }) => React.createElement('FlatList', props, ListHeaderComponent, data.length ? data.map(item => React.createElement(React.Fragment, { key: item.session_id }, renderItem({ item }))) : ListEmptyComponent, ListFooterComponent);
  const icons = Object.fromEntries(['ArrowRight', 'ChevronDown', 'ChevronRight', 'Eye', 'Globe', 'Laptop', 'Link2', 'MousePointerClick', 'Rabbit', 'RefreshCw', 'Smartphone', 'Tablet'].map(n => [n, n]));
  const site = { id: '1', name: 'Test site' };
  const load = createLoader({ 'react-native': native, 'lucide-react-native': icons,
    'react-native-reanimated': { __esModule: true, default: { View: 'AnimatedView' }, useReducedMotion: () => false },
    'expo-router': { useNavigation: path => { assert.equal(path, '/'); return navigation; }, useFocusEffect: callback => React.useEffect(callback, [callback]) },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0 }) },
    '@/stores/session': { useSession: () => ({ serverUrl: 'https://example.test', site, timeZone: 'UTC' }) },
    '@/api/rybbit/realtime': { getRealtimeSessions: async () => [] },
  });
  const Table = load('src/features/realtime/realtime-screen.tsx').RealtimeTable;
  const loader = async (_, __, next) => { signal = next; calls++; if (pending) return pending; if (fail) throw new Error('Server unavailable'); return api.parseRealtimeSessions({ data: [{ ...session, session_end: new Date().toISOString().replace('T', ' ').replace('Z', '') }] }); };
  let tree; await act(async () => { tree = create(React.createElement(Table, { loadSessions: loader })); });
  t.after(async () => { await act(async () => tree.unmount()); });
  const text = node => Array.isArray(node) ? node.map(text).join('') : typeof node === 'string' ? node : node?.children?.map(text).join('') ?? '';
  const read = () => text(tree.toJSON());
  assert.equal(tree.root.findAllByProps({ accessibilityLabel: 'Refresh realtime visits' }).length, 0);
  assert.equal(headerOptions.headerRight().props.accessibilityLabel, 'Refresh realtime visits');
  assert.equal(headerOptions.headerRight().props.disabled, false);
  assert.equal(tree.root.findAllByType('Pressable').some(node => node.props.accessibilityLabel?.includes('recently active')), true);
  assert.match(read(), /1 recent sessions/); assert.match(read(), /\/pricing/);
  await act(async () => tree.root.findAllByType('Pressable').find(n => n.props.accessibilityState).props.onPress());
  assert.match(read(), /Visitor ID/); assert.match(read(), /visitor1/);
  fail = true;
  await act(async () => headerOptions.headerRight().props.onPress());
  assert.match(read(), /Showing the last successful update/); assert.match(read(), /\/pricing/);
  await act(async () => appChange('background'));
  assert.equal(signal.aborted, true);
  fail = false;
  await act(async () => appChange('active'));
  assert.equal(calls, 3); assert.doesNotMatch(read(), /Server unavailable/);
  const refreshProps = () => tree.root.findByType('FlatList').props.refreshControl.props;
  let finish;
  for (const trigger of ['automatic', 'navbar', 'pull']) {
    pending = new Promise(resolve => { finish = resolve; });
    await act(async () => {
      if (trigger === 'automatic') t.mock.timers.tick(30_000);
      else if (trigger === 'navbar') headerOptions.headerRight().props.onPress();
      else refreshProps().onRefresh();
    });
    assert.equal(headerOptions.headerRight().props.disabled, true, `${trigger} refresh rotates the navbar icon`);
    assert.equal(refreshProps().refreshing, trigger === 'pull', `${trigger} refresh only shows the pull indicator for a gesture`);
    await act(async () => finish(api.parseRealtimeSessions({ data: [session] })));
    pending = null;
    assert.equal(refreshProps().refreshing, false);
    assert.equal(headerOptions.headerRight().props.disabled, false);
  }
  await act(async () => tree.unmount()); assert.equal(signal.aborted, true);
  assert.equal(headerOptions.headerRight, undefined);
});
