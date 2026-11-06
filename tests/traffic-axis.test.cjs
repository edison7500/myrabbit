const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const createLoader = require('./load-source.cjs');

global.IS_REACT_ACT_ENVIRONMENT = true;
const { lightColors: colors } = createLoader()('src/constants/theme.ts');
const native = {
  View: 'View', Text: 'Text', Pressable: 'Pressable',
  StyleSheet: { create: value => value },
};
const chart = createLoader({
  'react-native': native,
  '@/stores/theme': { useTheme: () => ({ colors, scheme: 'light' }) },
  'react-native-svg': {
    __esModule: true, default: 'Svg', Circle: 'Circle', Defs: 'Defs',
    LinearGradient: 'LinearGradient', Line: 'Line', Path: 'Path', Stop: 'Stop',
  },
})('src/features/overview/traffic-chart.tsx');

const point = (time, users = 0, pageviews = 0) => ({ time, users, pageviews });
const dates = points => points.map(item => item.time.slice(0, 10));
function text(node) {
  if (Array.isArray(node)) return node.map(text).join('');
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  return node?.children?.map(text).join('') ?? '';
}
function positions(path) {
  return [...path.matchAll(/[ML] (-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)]
    .map(match => ({ x: Number(match[1]), y: Number(match[2]) }));
}
async function renderChart(t, props) {
  let tree;
  await act(async () => {
    tree = create(React.createElement(chart.TrendChart, {
      bucket: 'day', series: chart.trafficSeries, timeZone: 'UTC',
      accessibilityLabel: 'Traffic trend', ...props,
    }));
  });
  t.after(async () => { await act(async () => tree.unmount()); });
  return tree;
}

test('This Week fills every calendar day without compressing omitted historical buckets', () => {
  const original = [point('2025-12-31 00:00:00', 7, 12), point('2025-12-29 00:00:00', 3, 5)];
  const snapshot = structuredClone(original);
  const padded = chart.calendarChartPoints(original, { preset: 'this-week' }, 'UTC', new Date('2026-01-01T12:00:00Z'));
  assert.deepEqual(dates(padded), [
    '2025-12-29', '2025-12-30', '2025-12-31', '2026-01-01',
    '2026-01-02', '2026-01-03', '2026-01-04',
  ]);
  assert.deepEqual(padded.map(item => [item.users, item.pageviews]), [[3, 5], [0, 0], [7, 12], [0, 0], [0, 0], [0, 0], [0, 0]]);
  assert.deepEqual(original, snapshot);
});

test('This Month reserves the real last day in 28, 29, 30 and 31 day months', () => {
  for (const [month, length] of [['2026-02', 28], ['2024-02', 29], ['2026-04', 30], ['2026-12', 31]]) {
    const padded = chart.calendarChartPoints([], { preset: 'this-month' }, 'UTC', new Date(`${month}-15T12:00:00Z`));
    assert.equal(padded.length, length);
    assert.equal(padded[0].time.slice(0, 10), `${month}-01`);
    assert.equal(padded.at(-1).time.slice(0, 10), `${month}-${length}`);
    assert.equal(padded.every(item => item.users === 0 && item.pageviews === 0), true);
    assert.equal(new Set(dates(padded)).size, length);
  }
});

test('calendar bounds and zoned ISO buckets both follow the analytics timezone', () => {
  const now = new Date('2026-10-31T16:30:00Z');
  const padded = chart.calendarChartPoints([
    point('2026-10-31T16:00:00Z', 7, 12),
    point('2026-11-02 00:00:00', 2, 3),
    point('2026-11-03T00:00:00+08:00', 4, 8),
    point('2026-10-31 00:00:00', 500, 900),
  ], { preset: 'this-month' }, 'Asia/Hong_Kong', now);
  assert.equal(padded.length, 30);
  assert.equal(padded[0].time.slice(0, 10), '2026-11-01');
  assert.deepEqual(padded.slice(0, 3).map(item => [item.users, item.pageviews]), [[7, 12], [2, 3], [4, 8]]);
  assert.equal(padded.some(item => item.users === 500), false);

  const week = chart.calendarChartPoints([point('2026-10-25T16:00:00Z', 6, 9)],
    { preset: 'this-week' }, 'Asia/Hong_Kong', new Date('2026-10-25T16:30:00Z'));
  assert.equal(week[0].time.slice(0, 10), '2026-10-26');
  assert.equal(week.at(-1).time.slice(0, 10), '2026-11-01');
  assert.equal(week[0].users, 6);
});

test('calendar padding leaves other presets and custom ranges to their existing chart behavior', () => {
  for (const range of [
    { preset: 'today' }, { preset: 'yesterday' }, { preset: 'last-30-minutes' },
    { preset: 'last-24-hours' }, { preset: 'last-7-days' }, { preset: 'last-30-days' },
    { preset: 'this-year' }, { preset: 'all-time' },
    { preset: 'custom', startDate: '2026-10-01', endDate: '2026-10-31' },
  ]) {
    assert.equal(chart.calendarChartPoints([], range, 'UTC', new Date('2026-10-28T12:00:00Z')), null);
  }
});

test('Today traffic keeps 00–24 on the axis and only draws through the current hourly bucket', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-28T05:58:00Z') });
  const tree = await renderChart(t, {
    points: [point('2026-10-28 00:00:00', 2, 4), point('2026-10-28 13:00:00', 6, 9)],
    dateRange: { preset: 'today' }, bucket: 'hour', timeZone: 'Asia/Hong_Kong', interactive: true,
  });
  assert.match(text(tree.toJSON()), /00:00.*06:00.*12:00.*18:00.*24:00/);
  const dashed = tree.root.findAllByType('Path').filter(node => node.props.strokeDasharray);
  assert.equal(dashed.length, 2);
  for (const path of dashed) assert.deepEqual(positions(path.props.d).map(value => value.x), [173.33, 186.67]);
  const control = tree.root.findByType('Pressable');
  await act(async () => control.props.onPress({ nativeEvent: { locationX: 320 } }));
  assert.match(control.props.accessibilityValue.text, /13:00–14:00.*In progress.*Visitors: 6/);
});

test('This Week keeps Sunday on the axis while future data and zero slots stay undrawn and unselectable', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-28T12:00:00Z') });
  const tree = await renderChart(t, {
    points: [point('2026-10-26 00:00:00', 2, 4), point('2026-10-28 00:00:00', 6, 9), point('2026-11-01 00:00:00', 999, 999)],
    dateRange: { preset: 'this-week' }, interactive: true,
  });
  assert.match(text(tree.toJSON()), /10-26.*11-01/);
  const paths = tree.root.findAllByType('Path');
  const dashed = paths.filter(node => node.props.strokeDasharray);
  assert.equal(dashed.length, 2);
  for (const path of dashed) assert.deepEqual(positions(path.props.d).map(value => value.x), [53.33, 106.67]);
  // The current pageview value sets the scale; a future response value must not.
  assert.equal(positions(dashed.find(node => node.props.stroke === colors.chartSecondary).props.d).at(-1).y, 8);
  for (const path of paths) assert.equal(positions(path.props.d).every(value => value.x <= 106.67), true);
  const fill = paths.find(node => node.props.fill?.startsWith('url('));
  assert.ok(fill);
  assert.equal(positions(fill.props.d).every(value => value.x <= 53.33), true);
  const control = tree.root.findByType('Pressable');
  assert.equal(control.props.accessibilityValue.max, 2);
  await act(async () => control.props.onPress({ nativeEvent: { locationX: 320 } }));
  assert.equal(control.props.accessibilityValue.now, 2);
  assert.match(control.props.accessibilityValue.text, /2026-10-28.*In progress.*Visitors: 6/);
  assert.doesNotMatch(control.props.accessibilityValue.text, /999|2026-11-01/);
});

test('This Month places the current day within the full month axis', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-02-03T12:00:00Z') });
  const tree = await renderChart(t, {
    points: [point('2026-02-03 00:00:00', 3, 8)], dateRange: { preset: 'this-month' },
  });
  assert.match(text(tree.toJSON()), /02-01.*02-28/);
  const dashed = tree.root.findAllByType('Path').filter(node => node.props.strokeDasharray);
  assert.equal(dashed.length, 2);
  for (const path of dashed) assert.deepEqual(positions(path.props.d).map(value => value.x), [11.85, 23.7]);
});

test('Monday and the first day of a month keep their in-progress point visible and inspectable', async t => {
  for (const [preset, date] of [['this-week', '2026-10-26'], ['this-month', '2026-11-01']]) {
    await t.test(preset, async child => {
      child.mock.timers.enable({ apis: ['Date'], now: new Date(`${date}T12:00:00Z`) });
      const tree = await renderChart(child, {
        points: [point(`${date} 00:00:00`, 7, 12)], dateRange: { preset }, interactive: true,
      });
      const markers = tree.root.findAllByType('Circle').filter(node => node.props.cx === 0);
      assert.ok(markers.some(node => node.props.fill === colors.accent));
      assert.ok(markers.some(node => node.props.fill === colors.chartSecondary && node.props.cy === 8));
      for (const path of tree.root.findAllByType('Path')) assert.equal(positions(path.props.d).every(value => value.x === 0), true);
      const control = tree.root.findByType('Pressable');
      assert.equal(control.props.accessibilityValue.max, 0);
      await act(async () => control.props.onPress({ nativeEvent: { locationX: 320 } }));
      assert.match(control.props.accessibilityValue.text, new RegExp(`${date}.*In progress.*Visitors: 7`));
    });
  }
});

test('rolling and custom traffic charts retain their returned bucket spacing', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-28T12:00:00Z') });
  for (const [dateRange, bucket, points, labels] of [
    [{ preset: 'last-24-hours' }, 'hour', [point('2026-10-27 20:00:00', 2, 3), point('2026-10-28 01:00:00', 4, 8)], /20:00.*01:00/],
    [{ preset: 'custom', startDate: '2026-10-01', endDate: '2026-10-03' }, 'day', [point('2026-10-01', 2, 3), point('2026-10-03', 4, 8)], /10-01.*10-03/],
  ]) {
    const tree = await renderChart(t, { dateRange, bucket, points });
    assert.match(text(tree.toJSON()), labels);
    const solid = tree.root.findAllByType('Path').filter(node => node.props.stroke && !node.props.strokeDasharray);
    assert.equal(solid.length, 2);
    for (const path of solid) assert.equal(positions(path.props.d).at(-1).x, 320);
    assert.equal(tree.root.findAllByType('Path').some(node => node.props.strokeDasharray), false);
  }
});
