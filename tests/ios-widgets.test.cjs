const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const pluginPath = path.join(root, 'plugins/with-ios-widgets.js');
const appGroup = 'group.im.test.myrabbit.widgets';
const plain = (value) => JSON.parse(JSON.stringify(value));

function fixture() {
  const hooks = {};
  const capture = (name) => (config, callback) => { hooks[name] = callback; return config; };
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(pluginPath, 'utf8'), {
    module,
    exports: module.exports,
    require(id) {
      if (id === 'expo/config-plugins') return {
        withEntitlementsPlist: capture('entitlements'),
        withInfoPlist: capture('info'),
        withXcodeProject: capture('project'),
        withDangerousMod: (config, [platform, callback]) => {
          assert.equal(platform, 'ios');
          hooks.files = callback;
          return config;
        },
      };
      return require(id);
    },
  }, { filename: pluginPath });

  // Represent an already generated project so these tests need neither Xcode nor ios/.
  const appSettings = {
    IPHONEOS_DEPLOYMENT_TARGET: '17.6', DEVELOPMENT_TEAM: 'APPTEAM',
    CODE_SIGN_STYLE: 'Manual', CODE_SIGN_IDENTITY: 'Existing Identity',
    CODE_SIGN_ENTITLEMENTS: 'MyRabbit/MyRabbit.entitlements', PRODUCT_MODULE_NAME: 'MyRabbit',
  };
  const objects = {
    PBXNativeTarget: {
      APP: { name: '"MyRabbit"', productType: '"com.apple.product-type.application"', buildConfigurationList: 'APP_LIST' },
      WIDGET: {
        name: '"MyRabbitWidgets"', productType: '"com.apple.product-type.app-extension"',
        productReference: 'WIDGET_PRODUCT', buildConfigurationList: 'WIDGET_LIST',
        buildPhases: [{ value: 'SOURCES' }, { value: 'FRAMEWORKS' }, { value: 'RESOURCES' }],
      },
    },
    PBXGroup: { WIDGET_GROUP: { name: 'MyRabbitWidgets', children: [] } },
    PBXSourcesBuildPhase: { SOURCES: { files: [] } },
    PBXFrameworksBuildPhase: { FRAMEWORKS: { files: [] } },
    PBXResourcesBuildPhase: { RESOURCES: { files: [] } },
    XCConfigurationList: {
      APP_LIST: { buildConfigurations: [{ value: 'APP_DEBUG' }, { value: 'APP_RELEASE' }] },
      WIDGET_LIST: { buildConfigurations: [{ value: 'WIDGET_DEBUG' }, { value: 'WIDGET_RELEASE' }] },
    },
    XCBuildConfiguration: {
      APP_DEBUG: { buildSettings: { ...appSettings } },
      APP_RELEASE: { buildSettings: { ...appSettings } },
      // Reproduce the previous collision with the app's MyRabbitWidgets pod.
      WIDGET_DEBUG: { buildSettings: { PRODUCT_MODULE_NAME: 'MyRabbitWidgets', IPHONEOS_DEPLOYMENT_TARGET: '17.6' } },
      WIDGET_RELEASE: { buildSettings: { PRODUCT_MODULE_NAME: 'MyRabbitWidgets', IPHONEOS_DEPLOYMENT_TARGET: '17.6' } },
    },
    PBXBuildFile: {
      WIDGET_COPY: { fileRef: 'WIDGET_PRODUCT' },
      UNRELATED_COPY: { fileRef: 'SHARE_PRODUCT', settings: { ATTRIBUTES: ['CodeSignOnCopy'] } },
    },
  };
  const projectInfo = {
    mainGroup: 'ROOT',
    attributes: { TargetAttributes: { APP: {
      ProvisioningStyle: 'Manual',
      SystemCapabilities: { 'com.apple.Push': { enabled: 1 } },
    } } },
  };
  const project = {
    hash: { project: { objects } },
    pbxNativeTargetSection: () => objects.PBXNativeTarget,
    pbxXCConfigurationList: () => objects.XCConfigurationList,
    pbxXCBuildConfigurationSection: () => objects.XCBuildConfiguration,
    pbxBuildFileSection: () => objects.PBXBuildFile,
    getFirstProject: () => ({ firstProject: projectInfo }),
    addTarget() { assert.fail('Reapplying the plugin must reuse the existing extension target.'); },
    addPbxGroup() { assert.fail('Reapplying the plugin must reuse the existing source group.'); },
    addBuildPhase() { assert.fail('Reapplying the plugin must reuse existing extension build phases.'); },
  };
  const shareExtension = {
    targetName: 'ShareExtension', bundleIdentifier: 'im.test.myrabbit.share',
    entitlements: { 'keychain-access-groups': ['existing-group'] },
  };
  const config = {
    name: 'MyRabbit', slug: 'myrabbit', version: '0.2.0',
    ios: { bundleIdentifier: 'im.test.myrabbit', appleTeamId: 'WIDGETTEAM', buildNumber: '7' },
    extra: { retained: true, eas: { projectId: 'existing-project', build: { experimental: { ios: {
      retained: 'signing-option', appExtensions: [
        shareExtension,
        { targetName: 'MyRabbitWidgets', bundleIdentifier: 'im.old.myrabbit.widgets' },
      ],
    } } } } },
  };
  const state = {
    entitlements: { 'aps-environment': 'development', 'com.apple.security.application-groups': ['group.existing'] },
    info: { CFBundleDisplayName: 'Existing app name' },
  };
  function apply() {
    module.exports(config);
    state.entitlements = hooks.entitlements({ ...config, modResults: state.entitlements }).modResults;
    state.info = hooks.info({ ...config, modResults: state.info }).modResults;
    hooks.project({ ...config, modResults: project });
  }
  return { apply, config, state, objects, projectInfo, shareExtension };
}

test('the widget extension has a distinct Swift module name from the app bridge pod in every configuration', () => {
  const subject = fixture();
  const podspec = fs.readFileSync(path.join(root, 'modules/myrabbit-widgets/ios/MyRabbitWidgets.podspec'), 'utf8');
  const podName = /s\.name\s*=\s*'([^']+)'/.exec(podspec)[1];
  subject.apply();
  for (const name of ['WIDGET_DEBUG', 'WIDGET_RELEASE']) {
    const settings = subject.objects.XCBuildConfiguration[name].buildSettings;
    assert.equal(settings.PRODUCT_MODULE_NAME, 'MyRabbitWidgetsExtension');
    assert.notEqual(settings.PRODUCT_MODULE_NAME, podName);
    assert.equal(settings.PRODUCT_BUNDLE_IDENTIFIER, '"im.test.myrabbit.widgets"');
  }
});

test('widget entitlements and EAS signing metadata remain idempotent while retaining unrelated configuration', () => {
  const subject = fixture();
  subject.apply();
  const afterFirst = JSON.stringify({ config: subject.config, state: subject.state, objects: subject.objects, projectInfo: subject.projectInfo });
  subject.apply();
  assert.equal(JSON.stringify({ config: subject.config, state: subject.state, objects: subject.objects, projectInfo: subject.projectInfo }), afterFirst);
  assert.deepEqual(plain(subject.state.entitlements), {
    'aps-environment': 'development',
    'com.apple.security.application-groups': ['group.existing', appGroup],
  });
  assert.equal(subject.state.info.MyRabbitWidgetsAppGroup, appGroup);
  assert.equal(subject.state.info.CFBundleDisplayName, 'Existing app name');
  const eas = subject.config.extra.eas;
  const ios = eas.build.experimental.ios;
  assert.equal(eas.projectId, 'existing-project');
  assert.equal(ios.retained, 'signing-option');
  assert.equal(subject.config.extra.retained, true);
  assert.deepEqual(plain(ios.appExtensions), [subject.shareExtension, {
    targetName: 'MyRabbitWidgets', bundleIdentifier: 'im.test.myrabbit.widgets',
    entitlements: { 'com.apple.security.application-groups': [appGroup] },
  }]);
});

test('adding widget capabilities preserves app deployment targets, signing settings and other target capabilities', () => {
  const subject = fixture();
  const originalAppSettings = plain({
    debug: subject.objects.XCBuildConfiguration.APP_DEBUG.buildSettings,
    release: subject.objects.XCBuildConfiguration.APP_RELEASE.buildSettings,
  });
  subject.apply();
  assert.deepEqual(plain({
    debug: subject.objects.XCBuildConfiguration.APP_DEBUG.buildSettings,
    release: subject.objects.XCBuildConfiguration.APP_RELEASE.buildSettings,
  }), originalAppSettings);
  for (const name of ['WIDGET_DEBUG', 'WIDGET_RELEASE']) {
    const settings = subject.objects.XCBuildConfiguration[name].buildSettings;
    assert.equal(settings.IPHONEOS_DEPLOYMENT_TARGET, '17.6');
    assert.equal(settings.DEVELOPMENT_TEAM, 'WIDGETTEAM');
    assert.equal(settings.CODE_SIGN_ENTITLEMENTS, '"MyRabbitWidgets/MyRabbitWidgets.entitlements"');
  }
  const attributes = subject.projectInfo.attributes.TargetAttributes;
  assert.equal(attributes.APP.ProvisioningStyle, 'Manual');
  assert.deepEqual(plain(attributes.APP.SystemCapabilities), {
    'com.apple.Push': { enabled: 1 }, 'com.apple.ApplicationGroups.iOS': { enabled: 1 },
  });
  assert.deepEqual(plain(attributes.WIDGET.SystemCapabilities), { 'com.apple.ApplicationGroups.iOS': { enabled: 1 } });
  assert.deepEqual(subject.objects.PBXBuildFile.UNRELATED_COPY.settings, { ATTRIBUTES: ['CodeSignOnCopy'] });
});
