const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildEnvironment } = require('../scripts/android-build.cjs');
const { configureReleaseSigning } = require('../plugins/with-android-release-signing');
const createLoader = require('./load-source.cjs');

const signing = {
  MYRABBIT_KEYSTORE_FILE: '/tmp/synthetic-release.jks',
  MYRABBIT_KEYSTORE_PASSWORD: 'synthetic-store-password',
  MYRABBIT_KEY_ALIAS: 'myrabbit',
  MYRABBIT_KEY_PASSWORD: 'synthetic-key-password',
};

test('unsigned/debug builds exclude signing secrets without mutating the parent environment', () => {
  for (const mode of ['unsigned', 'debug']) {
    const source = { ...signing, PATH: '/bin' };
    const result = buildEnvironment(mode, source);
    for (const key of Object.keys(signing)) assert.equal(result[key], undefined);
    assert.equal(result.PATH, '/bin');
    assert.equal(result.EXPO_NO_DOTENV, '1');
    assert.equal(result.EXPO_NO_TELEMETRY, '1');
    assert.deepEqual(source, { ...signing, PATH: '/bin' });
  }
});

test('signed releases reject missing credentials, relative keystores and debug keys without exposing passwords', () => {
  for (const key of Object.keys(signing)) {
    const incomplete = { ...signing };
    delete incomplete[key];
    assert.throws(() => buildEnvironment('release', incomplete), error => {
      assert.doesNotMatch(error.message, /synthetic-store-password|synthetic-key-password/);
      return /Set all release signing variables/.test(error.message);
    });
  }
  assert.throws(() => buildEnvironment('release', { ...signing, MYRABBIT_KEYSTORE_FILE: 'release.jks' }), /absolute path/);
  assert.throws(() => buildEnvironment('release', { ...signing, MYRABBIT_KEY_ALIAS: 'androiddebugkey' }), /debug key/);
  assert.equal(buildEnvironment('release', signing).MYRABBIT_KEY_ALIAS, 'myrabbit');
  assert.throws(() => buildEnvironment('other', signing), /Choose/);
});

test('Expo signing customization is idempotent and overrides the template after it is evaluated', () => {
  const template = 'android { buildTypes { debug { signingConfig signingConfigs.debug }; release { signingConfig signingConfigs.debug } } }\n';
  const once = configureReleaseSigning(template);
  assert.equal(configureReleaseSigning(once), once);
  assert.ok(once.startsWith(template));
  assert.ok(once.indexOf('android.buildTypes.release.signingConfig = null') > once.indexOf(template));
  assert.match(once, /android\.buildTypes\.release\.signingConfig = android\.signingConfigs\.myrabbitRelease/);
  assert.throws(() => configureReleaseSigning('// @generated begin myrabbit-release-signing\n'), /Incomplete/);
});

// Exercise the real build orchestration while replacing SDK/process/filesystem
// boundaries. These checks do not substitute for Gradle or device validation.
function simulateBuild(mode, { fail, install = false } = {}) {
  const calls = [], copies = [], writes = new Map();
  const names = ['ANDROID_HOME', ...Object.keys(signing)];
  const original = Object.fromEntries(names.map(name => [name, process.env[name]]));
  const originalLog = console.log;
  console.log = () => {};
  Object.assign(process.env, signing, { ANDROID_HOME: '/synthetic/android-sdk' });
  try {
    const { main } = createLoader({
      'node:child_process': { spawnSync(command, args, options) {
        calls.push({ command, args, env: { ...options.env } });
        if (command === 'git') return { status: 0, stdout: args[0] === 'rev-parse' ? `${'a'.repeat(40)}\n` : ' M app.json\n' };
        return { status: command.endsWith(fail ?? '__no_failure__') ? 1 : 0 };
      } },
      'node:fs': {
        existsSync: () => true,
        mkdirSync: () => {},
        copyFileSync: (source, destination) => copies.push({ source, destination }),
        readFileSync: file => file.endsWith('app.json') ? JSON.stringify({ expo: { version: '0.1.0', android: { versionCode: 1, package: 'im.jiaxin.myrabbit' } } }) : Buffer.from('synthetic APK'),
        writeFileSync: (file, content) => writes.set(file, content),
      },
    })('scripts/android-build.cjs');
    let error;
    try { main([mode, ...(install ? ['--install'] : [])]); } catch (caught) { error = caught; }
    return { calls, copies, writes, error };
  } finally {
    console.log = originalLog;
    for (const name of names) {
      if (original[name] === undefined) delete process.env[name];
      else process.env[name] = original[name];
    }
  }
}

test('packaging builds stay unsigned in a signing shell and record artifact provenance', () => {
  const result = simulateBuild('unsigned');
  assert.equal(result.error, undefined);
  assert.ok(result.calls[0].args.includes('--no-clean'), 'local builds must preserve the native directory and its build cache');
  const gradle = result.calls.find(call => call.command === './gradlew');
  assert.ok(gradle.args.includes(':app:assembleRelease'));
  for (const call of result.calls.filter(call => call.command !== 'git')) {
    for (const name of Object.keys(signing)) assert.equal(call.env[name], undefined);
  }
  assert.equal(result.calls.some(call => call.command.endsWith('apksigner') || call.command.endsWith('/adb')), false);
  assert.match(result.copies[0].source, /app-release-unsigned\.apk$/);
  const info = JSON.parse([...result.writes].find(([file]) => file.endsWith('.build-info.json'))[1]);
  assert.equal(info.workingTreeDirty, true);
  assert.equal(info.sourceCommit, 'a'.repeat(40));
  assert.equal(info.mode, 'unsigned');
  assert.match(info.sha256, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(info), /synthetic-store-password|synthetic-key-password/);
});

test('a signing verification failure prevents release artifact publication and installation', () => {
  const result = simulateBuild('release', { fail: 'apksigner', install: true });
  assert.match(result.error.message, /apksigner failed/);
  assert.equal(result.copies.length, 0);
  assert.equal(result.writes.size, 0);
  assert.equal(result.calls.some(call => call.command.endsWith('/adb')), false);
  const prebuild = result.calls[0];
  for (const name of Object.keys(signing)) assert.equal(prebuild.env[name], undefined);
  assert.equal(result.calls.find(call => call.command === './gradlew').env.MYRABBIT_KEY_ALIAS, 'myrabbit');
});

test('a failed Gradle build cannot publish a stale APK left by an earlier build', () => {
  const result = simulateBuild('release', { fail: 'gradlew' });
  assert.match(result.error.message, /gradlew failed/);
  assert.equal(result.copies.length, 0);
  assert.equal(result.writes.size, 0);
});
