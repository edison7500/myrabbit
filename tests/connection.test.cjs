const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-source.cjs')();
const { testConnection, ConnectionTestGate } = load('src/features/onboarding/connection-test.ts');
const { request } = load('src/api/rybbit/request.ts');
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });
const draft = { mode: 'self-host', baseUrl: ' https://example.test/analytics/// ', apiKey: ' test-credential ' };
const signal = () => new AbortController().signal;
function response(body, status = 200) { return { ok: status >= 200 && status < 300, status, json: async () => body }; }
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }

test('normalizes draft URL/key and tests credentials without cookies or persistence', async () => {
  let call;
  global.fetch = async (url, options) => { call = { url, options }; return response([{ id: 'org-1' }]); };
  const result = await testConnection(draft, signal());
  assert.equal(call.url, 'https://example.test/analytics/api/organizations');
  assert.equal(call.options.headers.Authorization, 'Bearer test-credential');
  assert.equal(call.options.credentials, 'omit');
  assert.equal(result.config.baseUrl, 'https://example.test/analytics');
  assert.equal(result.organizationCount, 1);
});
for (const url of ['bad', 'ftp://example.test', 'https://user:password@example.test', 'https://example.test?key=x', 'https://example.test/#x']) {
  test(`rejects invalid URL before network: ${url}`, async () => {
    global.fetch = () => assert.fail('must not request');
    await assert.rejects(testConnection({ ...draft, baseUrl: url }, signal()), { code: 'invalid-url' });
  });
}
test('empty key is rejected locally', async () => {
  global.fetch = () => assert.fail('must not request');
  await assert.rejects(testConnection({ ...draft, apiKey: ' ' }, signal()), { code: 'unauthorized' });
});
for (const [status, code] of [[401, 'unauthorized'], [403, 'forbidden'], [404, 'unexpected'], [500, 'server'], [429, 'server']]) {
  test(`HTTP ${status} is classified as ${code}`, async () => {
    global.fetch = async () => response(null, status);
    await assert.rejects(testConnection(draft, signal()), { code });
  });
}
for (const body of [{}, null, [{ name: 'Missing ID' }], ['wrong'], [{ id: '' }]]) {
  test(`rejects unexpected organization payload ${JSON.stringify(body)}`, async () => {
    global.fetch = async () => response(body);
    await assert.rejects(testConnection(draft, signal()), { code: 'unexpected' });
  });
}
test('HTML or malformed JSON is an unexpected response', async () => {
  global.fetch = async () => ({ ...response(null), json: async () => { throw new SyntaxError('<html>'); } });
  await assert.rejects(testConnection(draft, signal()), { code: 'unexpected' });
});
test('empty organization array is still a valid connection', async () => {
  global.fetch = async () => response([]);
  assert.equal((await testConnection(draft, signal())).organizationCount, 0);
});
for (const [issue, code] of [[new TypeError('Failed to fetch'), 'unreachable'], [new Error('sensitive backend detail'), 'unknown']]) {
  test(`distinguishes ${code} without exposing underlying messages`, async () => {
    global.fetch = async () => { throw issue; };
    await assert.rejects(testConnection(draft, signal()), error => error.code === code && !error.message.includes(issue.message));
  });
}
test('timeout aborts fetch and classifies the failure', async () => {
  global.fetch = (_, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))));
  await assert.rejects(request(draft, '/organizations', signal(), 5), { code: 'timeout' });
});
test('timeout during body reading remains a timeout', async () => {
  global.fetch = async (_, { signal }) => ({ ...response(null), json: () => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')))) });
  await assert.rejects(request(draft, '/organizations', signal(), 5), { code: 'timeout' });
});
test('caller cancellation is distinct from timeout; pre-cancelled requests never fetch', async () => {
  const controller = new AbortController(); controller.abort();
  global.fetch = () => assert.fail('must not request');
  await assert.rejects(testConnection(draft, controller.signal), { name: 'AbortError' });
});
test('save is blocked until a successful test and stores the normalized credentials', async () => {
  const gate = new ConnectionTestGate(); let stored = 'old';
  const persist = async config => { stored = config; };
  await assert.rejects(gate.save(draft, persist), /Test this connection/);
  assert.equal(stored, 'old');
  global.fetch = async () => response([]);
  await gate.test(draft); await gate.save(draft, persist);
  assert.equal(stored.apiKey, 'test-credential');
  assert.equal(stored.baseUrl, 'https://example.test/analytics');
});
test('each credential/hosting edit blocks saving a previously tested config', async () => {
  global.fetch = async () => response([]);
  for (const edit of [{ apiKey: 'new-key' }, { baseUrl: 'https://another.test' }, { mode: 'cloud' }]) {
    const gate = new ConnectionTestGate(); await gate.test(draft);
    await assert.rejects(gate.save({ ...draft, ...edit }, () => assert.fail('must not persist')), /Test this connection/);
  }
});
test('invalidating even an unchanged draft requires a new test', async () => {
  global.fetch = async () => response([]);
  const gate = new ConnectionTestGate(); await gate.test(draft); gate.invalidate();
  await assert.rejects(gate.save(draft, () => assert.fail('must not persist')), /Test this connection/);
});
test('failed retest revokes success and preserves the saved connection', async () => {
  const gate = new ConnectionTestGate(); let saved = 'original';
  global.fetch = async () => response([]); await gate.test(draft);
  global.fetch = async () => response(null, 401);
  await assert.rejects(gate.test(draft), { code: 'unauthorized' });
  await assert.rejects(gate.save(draft, async config => { saved = config; }));
  assert.equal(saved, 'original');
});
test('an old delayed success cannot authorize a newer draft', async () => {
  const old = deferred(); global.fetch = () => old.promise;
  const gate = new ConnectionTestGate(); const pending = gate.test(draft);
  gate.invalidate(); old.resolve(response([]));
  assert.equal(await pending, null);
  await assert.rejects(gate.save(draft, () => assert.fail('must not persist')));
});
test('secure storage failure is surfaced and can be retried without retesting', async () => {
  const gate = new ConnectionTestGate(); global.fetch = async () => response([]); await gate.test(draft);
  await assert.rejects(gate.save(draft, async () => { throw new Error('storage unavailable'); }), /storage unavailable/);
  let saved; await gate.save(draft, async config => { saved = config; }); assert.equal(saved.apiKey, 'test-credential');
});
test('native persistence uses SecureStore and Web persistence stays in memory', async () => {
  const values = new Map();
  const storageLoad = require('./load-source.cjs')({ 'expo-secure-store': { setItemAsync: async (k, v) => values.set(k, v), getItemAsync: async k => values.get(k) } });
  const native = storageLoad('src/storage/connection.ts');
  await native.saveConnection({ ...draft, baseUrl: 'https://example.test' });
  assert.equal(values.size, 1); assert.equal((await native.loadConnection()).apiKey, draft.apiKey);
  const web = storageLoad('src/storage/connection.web.ts'); await web.saveConnection(draft);
  assert.equal((await web.loadConnection()).apiKey, draft.apiKey);
  const freshWeb = require('./load-source.cjs')()('src/storage/connection.web.ts'); assert.equal(await freshWeb.loadConnection(), null);
});
