const { withXcodeProject } = require('expo/config-plugins');

module.exports = function withIosScriptSandboxing(config) {
  return withXcodeProject(config, (config) => {
    // Metro reads the project graph and writes the embedded Release bundle.
    // Xcode's script sandbox blocks these paths with the generated build phases.
    const configurations = config.modResults.pbxXCBuildConfigurationSection();
    for (const configuration of Object.values(configurations)) {
      if (configuration && typeof configuration === 'object' && configuration.buildSettings) {
        configuration.buildSettings.ENABLE_USER_SCRIPT_SANDBOXING = 'NO';
      }
    }
    return config;
  });
};
