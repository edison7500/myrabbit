const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const createLoader = require('./load-source.cjs');
global.IS_REACT_ACT_ENVIRONMENT = true;
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

test('favicon uses configured server path and encoded site domain without credentials', async () => {
  global.fetch = async (url, options) => {
    assert.equal(url, 'https://analytics.test/rybbit/api/favicon?domain=site.test%26other%3Dvalue');
    assert.equal(options.credentials, 'omit');
    assert.deepEqual(options.headers, { Accept: 'image/*' });
    return { ok: true, headers: new Headers({ 'content-type': 'image/png' }), arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer };
  };
  const { getFavicon } = createLoader()('src/api/rybbit/favicon.ts');
  assert.equal(await getFavicon('https://analytics.test/rybbit/', 'site.test&other=value', new AbortController().signal), 'data:image/png;base64,AQID');
});

test('favicon rejects old-server errors and non-image responses', async () => {
  const { getFavicon } = createLoader()('src/api/rybbit/favicon.ts');
  for (const [ok, type] of [[false, 'image/png'], [true, 'text/html']]) {
    global.fetch = async () => ({ ok, headers: new Headers({ 'content-type': type }) });
    await assert.rejects(getFavicon('https://analytics.test', 'site.test', new AbortController().signal));
  }
});

test('site icon falls back, resets on site switch, ignores stale results and cancels on unmount', async () => {
  const pending = [];
  const { SiteIcon } = createLoader({
    'expo-image': { Image: 'Image' },
    'lucide-react-native': { Globe: 'Globe' },
    '@/api/rybbit/favicon': { getFavicon: (server, domain, signal) => new Promise((resolve, reject) => pending.push({ server, domain, signal, resolve, reject })) },
  })('src/features/settings/site-icon.tsx');
  let tree;
  const render = domain => React.createElement(SiteIcon, { serverUrl: 'https://analytics.test', domain });
  await act(async () => { tree = create(render('first.test')); });
  assert.equal(tree.root.findAllByType('Globe').length, 1);
  await act(async () => pending[0].resolve('data:image/png;base64,AQID'));
  assert.equal(tree.root.findByType('Image').props.source.uri, 'data:image/png;base64,AQID');
  await act(async () => tree.update(render('second.test')));
  assert.equal(pending[0].signal.aborted, true);
  assert.equal(tree.root.findAllByType('Image').length, 0);
  await act(async () => tree.update(render('third.test')));
  await act(async () => pending[1].resolve('stale-image'));
  assert.equal(tree.root.findAllByType('Image').length, 0);
  await act(async () => pending[2].resolve('image'));
  await act(async () => tree.root.findByType('Image').props.onError());
  assert.equal(tree.root.findAllByType('Globe').length, 1);
  await act(async () => tree.unmount());
  assert.equal(pending[2].signal.aborted, true);
});
