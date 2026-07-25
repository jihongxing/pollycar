require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name = 'PollyCarMap'
  s.version = package['version']
  s.summary = package['description']
  s.description = package['description']
  s.license = 'UNLICENSED'
  s.author = 'PollyCar'
  s.platforms = { :ios => '16.4' }
  s.swift_version = '5.9'
  s.source = { :git => 'https://example.invalid/pollycar-map.git' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  if ENV['POLLYCAR_AMAP_NATIVE_SDK_ENABLED'] == 'true' && ENV['POLLYCAR_AMAP_IOS_SDK_ENABLED'] == 'true'
    s.dependency 'AMap3DMap-NO-IDFA'
    s.dependency 'AMapSearch-NO-IDFA'
  end
  s.source_files = '**/*.{h,m,swift}'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
