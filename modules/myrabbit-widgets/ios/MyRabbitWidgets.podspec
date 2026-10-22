Pod::Spec.new do |s|
  s.name = 'MyRabbitWidgets'
  s.version = '0.1.0'
  s.summary = 'Share credential-free dashboard snapshots with MyRabbit widgets.'
  s.description = s.summary
  s.license = { :type => 'MIT' }
  s.author = 'MyRabbit'
  s.homepage = 'https://github.com/edison7500/myrabbit'
  s.source = { :git => 'https://github.com/edison7500/myrabbit.git' }
  s.platforms = { :ios => '16.4' }
  s.swift_version = '5.9'
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '*.swift'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
end
