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

test('favicon data URLs preserve binary bytes and padding without a browser Base64 global', async () => {
  const originalBtoa = global.btoa;
  global.btoa = undefined;
  try {
    const { getFavicon } = createLoader()('src/api/rybbit/favicon.ts');
    for (const bytes of [[255], [255, 16], [255, 16, 128], [255, 16, 128, 42]]) {
      global.fetch = async () => ({
        ok: true, headers: new Headers({ 'content-type': 'image/x-icon' }),
        arrayBuffer: async () => Uint8Array.from(bytes).buffer,
      });
      const uri = await getFavicon('https://analytics.test', 'site.test', new AbortController().signal);
      assert.equal(uri, 'data:image/x-icon;base64,' + Buffer.from(bytes).toString('base64'));
    }
  } finally {
    global.btoa = originalBtoa;
  }
});

test('website favicon fallback uses only the selected hostname and omits credentials', async () => {
  const { getWebsiteFavicon } = createLoader()('src/api/rybbit/favicon.ts');
  let requests = 0;
  global.fetch = async (url, options) => {
    requests++;
    assert.equal(url, 'https://example.test/favicon.ico');
    assert.equal(options.credentials, 'omit');
    assert.deepEqual(options.headers, { Accept: 'image/*' });
    return {
      ok: true, headers: new Headers({ 'content-type': 'image/x-icon' }),
      arrayBuffer: async () => Uint8Array.from([1]).buffer,
    };
  };
  const signal = new AbortController().signal;
  assert.equal(await getWebsiteFavicon('example.test', signal), 'data:image/x-icon;base64,AQ==');
  for (const domain of ['https://example.test', 'example.test/page', 'example.test@other.test']) {
    await assert.rejects(getWebsiteFavicon(domain, signal));
  }
  assert.equal(requests, 1);
});

test('site icon falls back, resets on site switch, ignores stale results and cancels on unmount', async () => {
  const pending = [];
  const websiteRequests = [];
  const { SiteIcon } = createLoader({
    'expo-image': { Image: 'Image' },
    'lucide-react-native': { Globe: 'Globe' },
    'react-native': { View: 'View' },
    '@/api/rybbit/favicon': {
      getFavicon: (server, domain, signal) => new Promise((resolve, reject) => pending.push({ server, domain, signal, resolve, reject })),
      getWebsiteFavicon: (domain, signal) => new Promise((resolve, reject) => websiteRequests.push({ domain, signal, resolve, reject })),
    },
  })('src/components/site-icon.tsx');
  let tree;
  const render = domain => React.createElement(SiteIcon, { serverUrl: 'https://analytics.test', domain, size: 17 });
  await act(async () => { tree = create(render('first.test')); });
  assert.equal(tree.root.findAllByType('Globe').length, 1);
  await act(async () => pending[0].resolve('data:image/png;base64,AQID'));
  assert.equal(tree.root.findByType('Image').props.source.uri, 'data:image/png;base64,AQID');
  assert.equal(tree.root.findAllByType('Globe').length, 1);
  await act(async () => tree.root.findByType('Image').props.onLoad());
  assert.equal(tree.root.findAllByType('Globe').length, 0);
  assert.equal(websiteRequests.length, 0);
  await act(async () => tree.update(render('second.test')));
  assert.equal(pending[0].signal.aborted, true);
  assert.equal(tree.root.findAllByType('Image').length, 0);
  await act(async () => pending[1].reject(new Error('Not found')));
  assert.equal(websiteRequests[0].domain, 'second.test');
  await act(async () => tree.update(render(' third.test ')));
  assert.equal(websiteRequests[0].signal.aborted, true);
  await act(async () => websiteRequests[0].resolve('stale-image'));
  assert.equal(tree.root.findAllByType('Image').length, 0);
  assert.equal(pending[2].domain, 'third.test');
  await act(async () => pending[2].resolve('image'));
  await act(async () => tree.root.findByType('Image').props.onError());
  assert.equal(websiteRequests[1].domain, 'third.test');
  await act(async () => websiteRequests[1].resolve('data:image/x-icon;base64,AQID'));
  assert.equal(tree.root.findByType('Image').props.source.uri, 'data:image/x-icon;base64,AQID');
  await act(async () => tree.root.findByType('Image').props.onLoad());
  assert.equal(tree.root.findAllByType('Globe').length, 0);
  await act(async () => tree.update(render('missing.test')));
  await act(async () => pending[3].reject(new Error('Not found')));
  await act(async () => websiteRequests[2].reject(new Error('Not found')));
  assert.equal(tree.root.findAllByType('Image').length, 0);
  assert.equal(tree.root.findAllByType('Globe').length, 1);
  await act(async () => tree.unmount());
  assert.equal(websiteRequests[2].signal.aborted, true);
});

test('analytics site switcher uses the selected hostname independently of the displayed site label', async () => {
  const { SiteSwitcher } = createLoader({
    'expo-router': { Link: 'Link' },
    'lucide-react-native': { ChevronDown: 'ChevronDown' },
    'react-native': { Pressable: 'Pressable', Text: 'Text', StyleSheet: { create: value => value } },
    '@/stores/session': { useSession: () => ({ serverUrl: 'https://analytics.test', site: { domain: 'my-site.test' } }) },
    './analytics-filter-bar': {},
    './date-range-selector': {},
    './site-icon': { SiteIcon: 'SiteIcon' },
  })('src/components/analytics-controls.tsx');
  let tree;
  await act(async () => { tree = create(React.createElement(SiteSwitcher, { siteLabel: 'My Site · my-site.test' })); });
  assert.deepEqual(tree.root.findByType('SiteIcon').props, { serverUrl: 'https://analytics.test', domain: 'my-site.test', size: 17 });
  assert.equal(tree.root.findByType('Link').props.href, '/sites');
  await act(async () => tree.unmount());
});
