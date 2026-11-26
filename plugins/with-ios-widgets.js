const fs = require('node:fs/promises');
const path = require('node:path');
const plist = require('@expo/plist').default;
const { withDangerousMod, withEntitlementsPlist, withInfoPlist, withXcodeProject } = require('expo/config-plugins');

const TARGET_NAME = 'MyRabbitWidgets';
const SOURCE_FILES = ['MyRabbitWidget.swift', 'WidgetSnapshot.swift', 'WidgetRefresh.swift'];
const PROJECT_FILES = [...SOURCE_FILES, 'Info.plist', `${TARGET_NAME}.entitlements`];
const unquote = (value) => typeof value === 'string' ? value.replace(/^"|"$/g, '') : value;

function identifiers(config) {
  if (!config.ios?.bundleIdentifier) {
    throw new Error('MyRabbit widgets require ios.bundleIdentifier.');
  }
  return {
    bundleIdentifier: `${config.ios.bundleIdentifier}.widgets`,
    appGroup: `group.${config.ios.bundleIdentifier}.widgets`,
    keychainGroup: `$(AppIdentifierPrefix)${config.ios.bundleIdentifier}.widget-refresh`,
  };
}

function extensionEntitlements(appGroup, keychainGroup) {
  return {
    'com.apple.security.application-groups': [appGroup],
    'keychain-access-groups': [keychainGroup],
  };
}

function withExtensionSigningMetadata(config, bundleIdentifier, appGroup, keychainGroup) {
  config.extra ??= {};
  config.extra.eas ??= {};
  config.extra.eas.build ??= {};
  config.extra.eas.build.experimental ??= {};
  config.extra.eas.build.experimental.ios ??= {};
  const iosBuild = config.extra.eas.build.experimental.ios;
  const extensions = iosBuild.appExtensions ?? [];
  iosBuild.appExtensions = [
    ...extensions.filter((extension) => extension.targetName !== TARGET_NAME),
    {
      targetName: TARGET_NAME,
      bundleIdentifier,
      entitlements: extensionEntitlements(appGroup, keychainGroup),
    },
  ];
  return config;
}

function withWidgetFiles(config, appGroup, keychainGroup) {
  return withDangerousMod(config, ['ios', async (mod) => {
    const sourceRoot = path.join(mod.modRequest.projectRoot, 'modules/myrabbit-widgets');
    const outputRoot = path.join(mod.modRequest.platformProjectRoot, TARGET_NAME);
    await fs.mkdir(outputRoot, { recursive: true });
    await fs.copyFile(path.join(sourceRoot, 'extension/MyRabbitWidget.swift'), path.join(outputRoot, 'MyRabbitWidget.swift'));
    await fs.copyFile(path.join(sourceRoot, 'extension/WidgetRefresh.swift'), path.join(outputRoot, 'WidgetRefresh.swift'));
    await fs.copyFile(path.join(sourceRoot, 'ios/WidgetSnapshot.swift'), path.join(outputRoot, 'WidgetSnapshot.swift'));
    const info = plist.parse(await fs.readFile(path.join(sourceRoot, 'extension/Info.plist'), 'utf8'));
    info.MyRabbitWidgetsAppGroup = appGroup;
    info.MyRabbitWidgetsKeychainGroup = keychainGroup;
    info.NSAppTransportSecurity = { NSAllowsLocalNetworking: true, ...mod.ios?.infoPlist?.NSAppTransportSecurity };
    if (mod.ios?.infoPlist?.NSLocalNetworkUsageDescription) {
      info.NSLocalNetworkUsageDescription = mod.ios.infoPlist.NSLocalNetworkUsageDescription;
    }
    await fs.writeFile(path.join(outputRoot, 'Info.plist'), plist.build(info));
    await fs.writeFile(path.join(outputRoot, `${TARGET_NAME}.entitlements`), plist.build(extensionEntitlements(appGroup, keychainGroup)));
    return mod;
  }]);
}

function withWidgetTarget(config, bundleIdentifier) {
  return withXcodeProject(config, (mod) => {
    const project = mod.modResults;
    const nativeTargets = project.pbxNativeTargetSection();
    const appEntry = Object.entries(nativeTargets).find(([id, target]) => !id.endsWith('_comment')
      && unquote(target.productType) === 'com.apple.product-type.application');
    if (!appEntry) throw new Error('Could not find the iOS app target for MyRabbit widgets.');
    const [appId, appTarget] = appEntry;
    let widgetEntry = Object.entries(nativeTargets).find(([id, target]) => !id.endsWith('_comment')
      && unquote(target.name) === TARGET_NAME);

    if (!widgetEntry) {
      const added = project.addTarget(TARGET_NAME, 'app_extension', TARGET_NAME, bundleIdentifier);
      widgetEntry = [added.uuid, added.pbxNativeTarget];
    }
    const [widgetId, widgetTarget] = widgetEntry;
    const groups = project.hash.project.objects.PBXGroup;
    const rootGroup = project.getFirstProject().firstProject.mainGroup;
    const widgetGroups = groups[rootGroup].children.filter(({ value }) => {
      const group = groups[value];
      return group && unquote(group.path ?? group.name) === TARGET_NAME;
    });
    if (!widgetGroups.length) {
      const added = project.addPbxGroup(PROJECT_FILES, TARGET_NAME, TARGET_NAME);
      project.addToPbxGroup(added.uuid, rootGroup);
    } else if (widgetGroups.length > 1) {
      // CocoaPods may omit the redundant group name. Merge duplicate groups
      // created by earlier plugin runs before Xcode loads the generated project.
      const [first, ...duplicates] = widgetGroups;
      const group = groups[first.value];
      const children = new Map(group.children.map(child => [child.value, child]));
      for (const { value } of duplicates) {
        for (const child of groups[value].children) children.set(child.value, child);
        delete groups[value];
        delete groups[`${value}_comment`];
      }
      group.children = [...children.values()];
      const duplicateIds = new Set(duplicates.map(child => child.value));
      groups[rootGroup].children = groups[rootGroup].children.filter(child => !duplicateIds.has(child.value));
    }

    for (const [phaseType, title, files] of [
      ['PBXSourcesBuildPhase', 'Sources', SOURCE_FILES],
      ['PBXFrameworksBuildPhase', 'Frameworks', []],
      ['PBXResourcesBuildPhase', 'Resources', []],
    ]) {
      const exists = widgetTarget.buildPhases.some(({ value }) => project.hash.project.objects[phaseType]?.[value]);
      if (!exists) project.addBuildPhase(files, phaseType, title, widgetId);
    }
    if (widgetGroups.length) {
      const groupId = widgetGroups[0].value;
      const references = project.hash.project.objects.PBXFileReference;
      if (!groups[groupId].children.some(({ value }) => unquote(references?.[value]?.path) === 'WidgetRefresh.swift')) {
        project.addSourceFile('WidgetRefresh.swift', { target: widgetId }, groupId);
      }
    }

    const configurationLists = project.pbxXCConfigurationList();
    const configurations = project.pbxXCBuildConfigurationSection();
    const appConfigList = configurationLists[appTarget.buildConfigurationList];
    const appSettings = configurations[appConfigList.buildConfigurations[0].value].buildSettings;
    const widgetConfigs = configurationLists[widgetTarget.buildConfigurationList].buildConfigurations;
    for (const { value } of widgetConfigs) {
      Object.assign(configurations[value].buildSettings, {
        APPLICATION_EXTENSION_API_ONLY: 'YES',
        CLANG_ENABLE_MODULES: 'YES',
        CODE_SIGN_ENTITLEMENTS: `"${TARGET_NAME}/${TARGET_NAME}.entitlements"`,
        CODE_SIGN_STYLE: 'Automatic',
        CURRENT_PROJECT_VERSION: mod.ios?.buildNumber ?? '1',
        GENERATE_INFOPLIST_FILE: 'NO',
        INFOPLIST_FILE: `"${TARGET_NAME}/Info.plist"`,
        IPHONEOS_DEPLOYMENT_TARGET: appSettings.IPHONEOS_DEPLOYMENT_TARGET ?? '16.4',
        LD_RUNPATH_SEARCH_PATHS: '"$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks"',
        MARKETING_VERSION: mod.version ?? '1.0',
        PRODUCT_BUNDLE_IDENTIFIER: `"${bundleIdentifier}"`,
        // Keep the extension module distinct from the app's MyRabbitWidgets pod.
        PRODUCT_MODULE_NAME: 'MyRabbitWidgetsExtension',
        PRODUCT_NAME: `"${TARGET_NAME}"`,
        SDKROOT: 'iphoneos',
        SKIP_INSTALL: 'YES',
        SUPPORTED_PLATFORMS: '"iphoneos iphonesimulator"',
        SWIFT_VERSION: '5.9',
        TARGETED_DEVICE_FAMILY: '"1,2"',
      });
      const teamId = mod.ios?.appleTeamId ?? appSettings.DEVELOPMENT_TEAM;
      if (teamId) configurations[value].buildSettings.DEVELOPMENT_TEAM = teamId;
    }

    const projectInfo = project.getFirstProject().firstProject;
    projectInfo.attributes ??= {};
    projectInfo.attributes.TargetAttributes ??= {};
    for (const targetId of [appId, widgetId]) {
      const attributes = projectInfo.attributes.TargetAttributes[targetId] ??= {};
      attributes.SystemCapabilities ??= {};
      attributes.SystemCapabilities['com.apple.ApplicationGroups.iOS'] = { enabled: 1 };
    }
    // App extensions are signed by their own target and embedded in the containing app.
    for (const buildFile of Object.values(project.pbxBuildFileSection())) {
      if (buildFile && typeof buildFile === 'object' && buildFile.fileRef === widgetTarget.productReference) {
        buildFile.settings = { ATTRIBUTES: ['RemoveHeadersOnCopy'] };
      }
    }
    return mod;
  });
}

module.exports = function withIosWidgets(config) {
  const { bundleIdentifier, appGroup, keychainGroup } = identifiers(config);
  const privateGroup = `$(AppIdentifierPrefix)${config.ios.bundleIdentifier}`;
  config = withExtensionSigningMetadata(config, bundleIdentifier, appGroup, keychainGroup);
  config = withEntitlementsPlist(config, (mod) => {
    const groups = mod.modResults['com.apple.security.application-groups'] ?? [];
    mod.modResults['com.apple.security.application-groups'] = [...new Set([...groups, appGroup])];
    // The first access group stays the default for existing SecureStore items.
    const keychain = mod.modResults['keychain-access-groups'];
    mod.modResults['keychain-access-groups'] = [...new Set([...(keychain?.length ? keychain : [privateGroup]), keychainGroup])];
    return mod;
  });
  config = withInfoPlist(config, (mod) => {
    mod.modResults.MyRabbitWidgetsAppGroup = appGroup;
    mod.modResults.MyRabbitWidgetsKeychainGroup = keychainGroup;
    return mod;
  });
  config = withWidgetFiles(config, appGroup, keychainGroup);
  return withWidgetTarget(config, bundleIdentifier);
};
