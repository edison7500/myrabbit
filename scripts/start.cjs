const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { createRequire } = require('node:module');
const { join } = require('node:path');
const { parseEnv } = require('node:util');

const defaultSimulator = 'iPhone 18 Pro';
const iosFlags = ['--ios', '-i'];
const expoBin = require.resolve('expo/bin/cli');

function readSimulatorPreference() {
  if (process.env.IOS_SIMULATOR !== undefined) {
    return process.env.IOS_SIMULATOR.trim() || defaultSimulator;
  }

  try {
    const env = parseEnv(readFileSync(join(__dirname, '..', '.env'), 'utf8'));
    return env.IOS_SIMULATOR?.trim() || defaultSimulator;
  } catch (error) {
    if (error.code === 'ENOENT') return defaultSimulator;
    throw error;
  }
}

function findSimulator(target) {
  const { devices } = JSON.parse(execFileSync(
    'xcrun',
    ['simctl', 'list', 'devices', 'available', '--json'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 10_000 },
  ));
  const matches = Object.entries(devices)
    .filter(([runtime]) => runtime.startsWith('com.apple.CoreSimulator.SimRuntime.iOS-'))
    .flatMap(([, simulators]) => simulators)
    .filter((simulator) => simulator.name === target || simulator.udid.toLowerCase() === target.toLowerCase());

  if (matches.length !== 1) {
    const reason = matches.length ? 'matches multiple iOS simulators' : 'matches no available iOS simulator';
    throw new Error(`IOS_SIMULATOR "${target}" ${reason}. Use a UDID from xcrun simctl list devices available.`);
  }
  return matches[0];
}

function setExpoSimulator(udid) {
  // Expo SDK 57 exposes --ios as a boolean. Its iOS resolver accepts an explicit
  // UDID, so supply it in this CLI process while keeping Expo's normal launch flow.
  const expoRequire = createRequire(expoBin);
  const { AppleDeviceManager } = expoRequire(
    '@expo/cli/build/src/start/platforms/ios/AppleDeviceManager.js',
  );
  const resolveDevice = AppleDeviceManager.resolveAsync.bind(AppleDeviceManager);
  AppleDeviceManager.resolveAsync = (settings = {}) => {
    if (settings.shouldPrompt || settings.device?.udid) return resolveDevice(settings);
    return resolveDevice({ ...settings, device: { ...settings.device, udid } });
  };
}

const requestedArgs = process.argv.slice(2);
let args = requestedArgs.filter((arg) => arg !== '--metro-only');
const hasIos = args.some((arg) => iosFlags.includes(arg));
const hasOtherPlatform = args.some((arg) => ['--android', '-a', '--web', '-w'].includes(arg));
const isHelp = args.some((arg) => ['--help', '-h', '--version', '-v'].includes(arg));

if (
  process.platform === 'darwin' &&
  !requestedArgs.includes('--metro-only') &&
  !isHelp &&
  (hasIos || !hasOtherPlatform)
) {
  try {
    const simulator = findSimulator(readSimulatorPreference());
    setExpoSimulator(simulator.udid);
    if (!hasIos) args.push('--ios');
  } catch (error) {
    const [reason] = error.message.split('\n');
    console.warn(`Could not select an iOS simulator. Starting Expo without opening iOS. ${reason}`);
    args = args.filter((arg) => !iosFlags.includes(arg));
  }
}

process.argv.splice(1, process.argv.length - 1, expoBin, 'start', ...args);
require(expoBin);
