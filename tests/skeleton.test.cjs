const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const createLoader = require('./load-source.cjs');

global.IS_REACT_ACT_ENVIRONMENT = true;

function renderSkeleton(reducedMotion, variant) {
  const native = { View: 'View', StyleSheet: { create: styles => styles } };
  const load = createLoader({
    'react-native': native,
    'react-native-reanimated': { __esModule: true, default: { View: 'AnimatedView' }, useReducedMotion: () => reducedMotion },
  });
  const Skeleton = load('src/components/loading-skeleton.tsx').LoadingSkeleton;
  let tree;
  act(() => { tree = create(React.createElement(Skeleton, { variant, label: 'Loading analytics' })); });
  return tree;
}

test('card skeleton matches six dashboard metrics and announces one loading state', () => {
  const tree = renderSkeleton(false, 'cards');
  assert.equal(tree.root.findByProps({ accessibilityLabel: 'Loading analytics' }).props.accessibilityRole, 'progressbar');
  assert.equal(tree.root.findAll(node => node.props.style?.minHeight === 142).length, 6);
  const animated = tree.root.findByType('AnimatedView');
  assert.equal(animated.props.style[1].animationIterationCount, 'infinite');
  assert.equal(animated.props.style[1].animationName.from.opacity, 1);
  act(() => tree.unmount());
});

test('reduced motion renders the same placeholders without a looping animation', () => {
  const tree = renderSkeleton(true, 'list');
  assert.equal(tree.root.findAll(node => node.props.style?.minHeight === 68).length, 5);
  assert.equal(tree.root.findByType('AnimatedView').props.style[1], false);
  act(() => tree.unmount());
});
