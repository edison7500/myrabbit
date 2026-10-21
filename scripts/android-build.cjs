const { spawnSync } = require('node:child_process');
const { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync } = require('node:fs');
const { resolve, join, isAbsolute } = require('node:path');
const { createHash } = require('node:crypto');

const signingNames = ['MYRABBIT_KEYSTORE_FILE', 'MYRABBIT_KEYSTORE_PASSWORD', 'MYRABBIT_KEY_ALIAS', 'MYRABBIT_KEY_PASSWORD'];

function buildEnvironment(mode, source) {
  if (!['debug', 'unsigned', 'release'].includes(mode)) throw new Error('Choose debug, unsigned, or release.');
  const env = { ...source, EXPO_NO_TELEMETRY: '1', EXPO_NO_DOTENV: '1' };
  if (mode !== 'release') {
    // In particular, a packaging build must stay unsigned even in a signing shell.
    for (const name of signingNames) delete env[name];
  } else {
    if (signingNames.some(name => !env[name])) throw new Error(`Set all release signing variables: ${signingNames.join(', ')}. See docs/ANDROID_RELEASE.md.`);
    if (!isAbsolute(env.MYRABBIT_KEYSTORE_FILE)) throw new Error('MYRABBIT_KEYSTORE_FILE must be an absolute path.');
    if (env.MYRABBIT_KEY_ALIAS === 'androiddebugkey') throw new Error('Do not use the Android debug key for releases.');
  }
  return env;
}

function main(args = process.argv.slice(2)) {
  const [mode, option, ...extra] = args;
  const env = buildEnvironment(mode, process.env);
  if (extra.length || (option && option !== '--install') || (option && mode !== 'release')) throw new Error('Usage: android-build.cjs debug|unsigned|release [--install (release only)]');
  if (Number(process.versions.node.split('.')[0]) !== 24) throw new Error('Use Node.js 24 LTS (see .nvmrc).');
  if (process.platform === 'win32') throw new Error('Run this build workflow in Linux/WSL or macOS.');
  const root = resolve(__dirname, '..');
  const sdk = env.ANDROID_HOME || env.ANDROID_SDK_ROOT;
  if (!sdk || !existsSync(join(sdk, 'platform-tools'))) throw new Error('Set ANDROID_HOME to an Android SDK with platform-tools. See docs/ANDROID_RELEASE.md.');
  if (mode === 'release' && !existsSync(env.MYRABBIT_KEYSTORE_FILE)) throw new Error('The configured release keystore does not exist.');
  const run = (command, commandArgs, cwd = root, commandEnv = env) => {
    const result = spawnSync(command, commandArgs, { cwd, env: commandEnv, stdio: 'inherit' });
    if (result.error) throw new Error(`Could not start ${command}: ${result.error.message}`);
    if (result.status !== 0) throw new Error(`${command} failed (${result.status ?? result.signal}).`);
  };
  // Prebuild does not need access to release signing credentials.
  const prebuildEnv = buildEnvironment('unsigned', env);
  run(process.execPath, [require.resolve('expo/bin/cli'), 'prebuild', '--platform', 'android', '--no-install', '--no-clean'], root, prebuildEnv);
  const variant = mode === 'debug' ? 'debug' : 'release';
  run('./gradlew', [mode === 'debug' ? ':app:assembleDebug' : ':app:assembleRelease', '--no-daemon', '--console=plain'], join(root, 'android'));
  const apkName = mode === 'unsigned' ? 'app-release-unsigned.apk' : `app-${variant}.apk`;
  const apk = join(root, 'android', 'app', 'build', 'outputs', 'apk', variant, apkName);
  if (!existsSync(apk)) throw new Error(`Gradle did not produce ${apkName}.`);
  if (mode === 'release') {
    run(join(sdk, 'build-tools', '36.0.0', 'apksigner'), ['verify', '--verbose', '--print-certs', apk]);
  }
  const { expo } = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8'));
  const destination = join(root, 'artifacts', 'android');
  mkdirSync(destination, { recursive: true });
  const filename = `MyRabbit-${expo.version}-${expo.android.versionCode}-${mode}.apk`;
  const output = join(destination, filename);
  copyFileSync(apk, output);
  const sha256 = createHash('sha256').update(readFileSync(output)).digest('hex');
  writeFileSync(`${output}.sha256`, `${sha256}  ${filename}\n`);
  const commit = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
  const status = spawnSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' });
  writeFileSync(`${output}.build-info.json`, `${JSON.stringify({
    applicationId: expo.android.package,
    versionName: expo.version,
    versionCode: expo.android.versionCode,
    mode,
    sha256,
    sourceCommit: commit.status === 0 ? commit.stdout.trim() : null,
    workingTreeDirty: status.status === 0 ? Boolean(status.stdout.trim()) : null,
    node: process.versions.node,
    platform: process.platform,
  }, null, 2)}\n`);
  console.log(`APK: ${output}`);
  if (mode === 'unsigned') console.log('Unsigned packaging artifact; sign it before installing.');
  if (mode === 'debug') console.log('Debug APK requires Metro. Use a signed release for standalone device testing.');
  if (option === '--install') run(join(sdk, 'platform-tools', 'adb'), ['install', '-r', output]);
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { buildEnvironment, main };
