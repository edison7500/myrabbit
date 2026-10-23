const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const createLoader = require('./load-source.cjs');
global.IS_REACT_ACT_ENVIRONMENT = true;

test('iOS keeps filters in content without replacing the native title and preserves custom-date presentation', async t => {
  const originalOS = process.env.EXPO_OS;
  process.env.EXPO_OS = 'ios';
  t.after(() => { if (originalOS === undefined) delete process.env.EXPO_OS; else process.env.EXPO_OS = originalOS; });
  const changes = [];
  const load = createLoader({
    'react-native': { View: 'View', ScrollView: 'ScrollView', Text: 'Text', Pressable: 'Pressable', useWindowDimensions: () => ({ width: 390 }) },
    'expo-router': {
      useNavigation: () => ({ setOptions: () => assert.fail('iOS must retain its native large title') }),
      useFocusEffect: callback => React.useEffect(callback, [callback]),
    },
    '@expo/ui': { Host: 'Host', RNHostView: 'RNHostView', BottomSheet: ({ isPresented, children }) => isPresented ? React.createElement('Sheet', null, children) : null },
    '@/components/analytics-controls': { SiteSwitcher: 'SiteSwitcher' },
    '@/components/date-range-selector': { DateRangeSelector: 'DateRangeSelector', CustomDateRangeForm: 'CustomDateRangeForm' },
    '@/stores/session': { useSession: () => ({ site: { name: 'example.test', domain: 'example.test' }, dateRange: { preset: 'today' }, timeZone: 'UTC' }) },
  });
  const { ExploreNavigation } = load('src/features/explore/explore-navigation.tsx');
  let tree;
  await act(async () => { tree = create(React.createElement(ExploreNavigation, { disabled: false, onRangeChange: value => changes.push(value) })); });
  t.after(async () => { await act(async () => tree.unmount()); });
  const selector = tree.root.findByType('DateRangeSelector');
  assert.equal(selector.props.leadingControl.props.siteLabel, 'example.test');
  assert.equal(selector.props.navbar, undefined);
  await act(async () => selector.props.onCustomRequest());
  assert.equal(tree.root.findAllByType('Sheet').length, 1);
  const range = { preset: 'custom', startDate: '2026-10-01', endDate: '2026-10-02' };
  await act(async () => tree.root.findByType('CustomDateRangeForm').props.onChange(range));
  assert.deepEqual(changes, [range]);
  assert.equal(tree.root.findAllByType('Sheet').length, 0);
});

test('Explore navbar hosts the site switcher and date picker, validates custom dates, and clears on blur', async t => {
  let options = {}; let range = { preset: 'today' }; const changes = [];
  const navigation = { setOptions: next => { options = { ...options, ...next }; } };
  const native = Object.fromEntries(['View', 'Text', 'Pressable', 'TextInput', 'ScrollView'].map(name => [name, name]));
  native.StyleSheet = { create: value => value };
  native.useWindowDimensions = () => ({ width: 390, height: 844 });
  const Picker = Object.assign(({ children, ...props }) => React.createElement('Picker', props, children), { Item: 'PickerItem' });
  const load = createLoader({
    'react-native': native,
    'lucide-react-native': { CalendarDays: 'CalendarDays', Globe: 'Globe', ChevronDown: 'ChevronDown' },
    'expo-router': { Link: 'Link', useNavigation: path => { assert.equal(path, '/'); return navigation; }, useFocusEffect: callback => React.useEffect(callback, [callback]) },
    '@expo/ui': { Host: 'Host', Picker, RNHostView: 'RNHostView', BottomSheet: ({ isPresented, children }) => isPresented ? React.createElement('Sheet', null, children) : null },
    '@/stores/session': { useSession: () => ({ site: { name: 'example.test', domain: 'example.test' }, dateRange: range, timeZone: 'Asia/Hong_Kong' }) },
  });
  const { ExploreNavigation } = load('src/features/explore/explore-navigation.tsx');
  const onRangeChange = value => { range = value; changes.push(value); };
  let tree; let title; let date;
  await act(async () => { tree = create(React.createElement(ExploreNavigation, { disabled: false, onRangeChange })); });
  t.after(async () => { await act(async () => { tree.unmount(); title?.unmount(); date?.unmount(); }); });
  await act(async () => { title = create(options.headerTitle()); date = create(options.headerRight()); });
  assert.equal(title.root.findByType('Link').props.href, '/sites');
  assert.equal(title.root.findByType('Pressable').props.accessibilityLabel, 'Switch site. Current site: example.test');
  assert.equal(Array.isArray(title.root.findByType('Pressable').props.style), false, 'SDK 57 native Link Slot requires a flattened child style');
  assert.equal(options.unstable_headerRightItems()[0].hidesSharedBackground, true);
  assert.equal(date.root.findAllByType('TextInput').length, 0, 'navbar never includes inline date fields');
  await act(async () => date.root.findByType('Picker').props.onValueChange('last-7-days'));
  assert.deepEqual(changes, [{ preset: 'last-7-days' }]);
  await act(async () => tree.update(React.createElement(ExploreNavigation, { disabled: false, onRangeChange })));
  await act(async () => date.update(options.headerRight()));
  assert.equal(date.root.findByType('Picker').props.selectedValue, 'last-7-days');
  await act(async () => date.root.findByType('Picker').props.onValueChange('custom'));
  assert.equal(tree.root.findAllByType('Sheet').length, 1);
  await act(async () => {
    tree.root.findByProps({ accessibilityLabel: 'Start date' }).props.onChangeText('2026-10-15');
    tree.root.findByProps({ accessibilityLabel: 'End date' }).props.onChangeText('2026-10-01');
  });
  const apply = () => tree.root.findAllByType('Pressable').find(node => node.props.children?.props?.children === 'Apply range');
  assert.equal(apply().props.disabled, true);
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'End date' }).props.onChangeText('2026-10-16'));
  assert.equal(apply().props.disabled, false);
  await act(async () => apply().props.onPress());
  assert.deepEqual(changes.at(-1), { preset: 'custom', startDate: '2026-10-15', endDate: '2026-10-16' });
  assert.equal(tree.root.findAllByType('Sheet').length, 0);
  await act(async () => tree.unmount());
  assert.equal(options.headerTitle, undefined); assert.equal(options.headerRight, undefined);
  assert.equal(options.unstable_headerRightItems, undefined);
});
