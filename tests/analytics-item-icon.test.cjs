const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const createLoader = require('./load-source.cjs');
global.IS_REACT_ACT_ENVIRONMENT = true;

const iconNames = ['AppWindow', 'ArrowUpRight', 'Bot', 'Circle', 'CircleDot', 'Code2', 'Compass', 'Cpu', 'Flame', 'Gamepad2', 'Globe', 'Grid2X2', 'Laptop', 'Mail', 'MessagesSquare', 'Monitor', 'MonitorSmartphone', 'Orbit', 'Play', 'Rss', 'ScanLine', 'Search', 'Shield', 'Smartphone', 'Tablet', 'Terminal', 'Tv', 'Watch'];
const native = { View: 'View', Text: 'Text', Pressable: 'Pressable', StyleSheet: { create: value => value } };
native.FlatList = ({ data, renderItem, ...props }) => React.createElement('FlatList', props, data.map((item, index) => React.createElement(React.Fragment, { key: item.value }, renderItem({ item, index }))));
const load = createLoader({
  'react-native': native,
  'lucide-react-native': Object.fromEntries(iconNames.map(name => [name, name])),
  '@/stores/theme': { useTheme: () => ({ scheme: 'light', colors: { accent: '#6941c6' } }) },
  '@/components/analytics-ui': { SectionHeading: 'SectionHeading' },
  '@/components/loading-skeleton': { LoadingSkeleton: 'LoadingSkeleton' },
});
const { getAnalyticsItemIcon, AnalyticsItemIcon } = load('src/components/analytics-item-icon.tsx');

test('technology icons normalize browser aliases and versioned names with stable fallbacks', () => {
  for (const [value, expected] of [
    [' Chrome ', 'CircleDot'], ['Mobile_Chrome', 'CircleDot'], ['Chromium', 'CircleDot'], ['CriOS', 'CircleDot'],
    ['Mobile Safari', 'Compass'], ['WebKit', 'Compass'], ['FxiOS', 'Flame'],
    ['IE', 'Orbit'], ['IE11', 'Orbit'], ['MSIE', 'Orbit'], ['Internet Explorer', 'Orbit'], ['IEMobile', 'Orbit'],
    ['Edge', 'Globe'], ['Opera', 'Circle'], ['Brave', 'Shield'], ['', 'AppWindow'], ['Unknown browser', 'AppWindow'],
  ]) assert.equal(getAnalyticsItemIcon('browser', value), expected, value);
  for (const [value, expected] of [
    ['DESKTOP', 'Monitor'], ['mobile', 'Smartphone'], ['iPad', 'Tablet'], ['smart-tv', 'Tv'], ['', 'MonitorSmartphone'],
  ]) assert.equal(getAnalyticsItemIcon('device_type', value), expected, value);
  for (const [value, expected] of [
    ['Windows11', 'Grid2X2'], ['Mac OS X', 'Laptop'], ['iOS', 'Smartphone'], ['Android', 'Bot'],
    ['Ubuntu', 'Terminal'], ['Chrome_OS', 'AppWindow'], ['', 'Cpu'], ['Unknown OS', 'Cpu'],
  ]) assert.equal(getAnalyticsItemIcon('operating_system', value), expected, value);
  assert.equal(getAnalyticsItemIcon('dimensions', '1920x1080'), 'ScanLine');
});

test('referrer icons match real hosts and subdomains without matching lookalike domains', () => {
  for (const [value, expected] of [
    ['https://www.google.com/search?q=analytics', 'Search'], ['google.co.uk', 'Search'], ['BING.COM', 'Search'],
    ['https://news.ycombinator.com/item?id=1', 'MessagesSquare'], ['github.com', 'Code2'], ['youtu.be/video', 'Play'],
    ['https://mail.google.com/mail/u/0', 'Mail'], ['mailto:team@example.test', 'Mail'], ['feedly.com', 'Rss'],
    ['', 'ArrowUpRight'], ['(direct)', 'ArrowUpRight'], ['-', 'ArrowUpRight'],
    ['fakegoogle.com', 'Globe'], ['google.com.example.test', 'Globe'], ['notgithub.com', 'Globe'],
    ['https://example.test/?next=https://google.com', 'Globe'], ['unknown.example', 'Globe'], ['not a URL', 'Globe'],
  ]) assert.equal(getAnalyticsItemIcon('referrer', value), expected, value);
});

test('referrer preview and full list render the same decorative icons and preserve row labels', async () => {
  const { ReferrersPreview } = load('src/features/referrers/referrers-preview.tsx');
  const { RankedList } = load('src/features/referrers/ranked-list.tsx');
  const items = [{ value: 'google.com', count: 12, percentage: 75 }, { value: 'unknown.example', count: 4, percentage: 25 }];
  let preview; let list;
  await act(async () => {
    preview = create(React.createElement(ReferrersPreview, { page: { items }, loading: false, error: '', onRetry() {}, onOpen() {} }));
    list = create(React.createElement(RankedList, { items, getLabel: item => item.value, header: null, empty: null, footer: null, refreshing: false, onRefresh() {}, onEndReached() {} }));
  });
  for (const tree of [preview, list]) {
    assert.equal(tree.root.findAllByType(AnalyticsItemIcon).length, 2);
    assert.equal(tree.root.findByType('Search').props.accessible, false);
    assert.equal(tree.root.findByType('Globe').props.accessible, false);
    assert.ok(tree.root.findByProps({ accessibilityLabel: 'google.com, 12 sessions' }));
    assert.ok(tree.root.findByProps({ accessibilityLabel: 'unknown.example, 4 sessions' }));
  }
  await act(async () => { preview.unmount(); list.unmount(); });
});
