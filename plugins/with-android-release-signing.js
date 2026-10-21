const { withAppBuildGradle } = require('expo/config-plugins');

const begin = '// @generated begin myrabbit-release-signing';
const end = '// @generated end myrabbit-release-signing';

// Apply after Expo's template, which otherwise signs release with the debug key.
// F-Droid gets an unsigned APK; upstream signing is opt-in through build memory.
const signing = `${begin}
def myRabbitSigningNames = [
    'MYRABBIT_KEYSTORE_FILE', 'MYRABBIT_KEYSTORE_PASSWORD',
    'MYRABBIT_KEY_ALIAS', 'MYRABBIT_KEY_PASSWORD'
]
def myRabbitSigning = myRabbitSigningNames.collect { System.getenv(it) }
android.buildTypes.release.signingConfig = null
if (myRabbitSigning.any { it }) {
    if (!myRabbitSigning.every { it }) {
        throw new GradleException('MyRabbit release signing requires all four MYRABBIT signing environment variables.')
    }
    if (myRabbitSigning[2] == 'androiddebugkey') {
        throw new GradleException('The Android debug key cannot be used for a MyRabbit release.')
    }
    android.signingConfigs.create('myrabbitRelease') {
        storeFile rootProject.file(myRabbitSigning[0])
        storePassword myRabbitSigning[1]
        keyAlias myRabbitSigning[2]
        keyPassword myRabbitSigning[3]
    }
    android.buildTypes.release.signingConfig = android.signingConfigs.myrabbitRelease
}
${end}`;

function configureReleaseSigning(contents) {
  const start = contents.indexOf(begin);
  if (start !== -1) {
    const finish = contents.indexOf(end, start);
    if (finish === -1) throw new Error('Incomplete MyRabbit signing block in app/build.gradle.');
    contents = contents.slice(0, start) + contents.slice(finish + end.length);
  }
  return `${contents.trimEnd()}\n\n${signing}\n`;
}

module.exports = function withAndroidReleaseSigning(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') {
      throw new Error('MyRabbit release signing requires a Groovy app/build.gradle.');
    }
    config.modResults.contents = configureReleaseSigning(config.modResults.contents);
    return config;
  });
};

module.exports.configureReleaseSigning = configureReleaseSigning;
