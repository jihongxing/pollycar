$ErrorActionPreference = "Stop"

$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$policyPath = Join-Path $repo "apps\app\plugins\amap-build-policy.cjs"
$pluginPath = Join-Path $repo "apps\app\plugins\with-pollycar-map-module.cjs"
$nativeModulePath = Join-Path $repo "apps\app\src\native\map-native-module.ts"
$webLoaderPath = Join-Path $repo "apps\app\src\native\web-amap-loader.ts"
$publicConfigPath = Join-Path $repo "apps\app\src\infrastructure\public-config.ts"
$amapPublicConfigPath = Join-Path $repo "apps\app\scripts\amap-client-environment.mjs"
$mapPickerPath = Join-Path $repo "apps\app\src\components\mobility\map-point-picker.tsx"
$androidModulePath = Join-Path $repo "apps\app\modules\pollycar-map\android\src\main\java\expo\modules\pollycarmap\PollyCarMapModule.kt"
$iosModulePath = Join-Path $repo "apps\app\modules\pollycar-map\ios\PollyCarMapModule.swift"
$signingEvidencePath = Join-Path $repo "scripts\mobile\get-android-signing-evidence.ps1"

foreach ($path in @(
  $policyPath,
  $pluginPath,
  $nativeModulePath,
  $webLoaderPath,
  $publicConfigPath,
  $amapPublicConfigPath,
  $mapPickerPath,
  $androidModulePath,
  $iosModulePath,
  $signingEvidencePath
)) {
  if (-not (Test-Path -LiteralPath $path)) {
    throw "高德原生接入检查缺少文件: $path"
  }
}

$policyScript = @'
const assert = require("node:assert/strict");
const { resolveAmapBuildPolicy } = require(process.argv[2]);
const sandboxConfig = {
  android: { package: "com.pollycar.internal.sandbox" },
  ios: { bundleIdentifier: "com.pollycar.internal.sandbox" },
};
const productionConfig = {
  android: { package: "com.rego.mobility" },
  ios: { bundleIdentifier: "com.rego.mobility" },
};

assert.deepEqual(
  resolveAmapBuildPolicy(sandboxConfig, {}),
  { enabled: false, androidEnabled: false, iosEnabled: false },
);

assert.throws(
  () => resolveAmapBuildPolicy(sandboxConfig, {
    POLLYCAR_AMAP_NATIVE_SDK_ENABLED: "true",
  }),
  /AMAP_SDK_PRODUCTION_APPROVAL_REQUIRED/,
);

assert.throws(
  () => resolveAmapBuildPolicy(sandboxConfig, {
    POLLYCAR_AMAP_NATIVE_SDK_ENABLED: "true",
    POLLYCAR_AMAP_EXTERNAL_APPROVAL_GRANTED: "true",
    POLLYCAR_AMAP_APPROVAL_REFERENCE: "approval-1",
  }),
  /AMAP_PRODUCTION_IDENTIFIER_REQUIRED/,
);

assert.throws(
  () => resolveAmapBuildPolicy(productionConfig, {
    EXPO_PUBLIC_AMAP_ANDROID_KEY: "forbidden",
  }),
  /AMAP_KEY_PUBLIC_ENV_FORBIDDEN/,
);

assert.throws(
  () => resolveAmapBuildPolicy(productionConfig, {
    EXPO_PUBLIC_POLLYCAR_AMAP_WEB_JS_API_KEY: "browser-key",
  }),
  /AMAP_KEY_PUBLIC_ENV_FORBIDDEN/,
);

const androidPolicy = resolveAmapBuildPolicy(productionConfig, {
  POLLYCAR_AMAP_NATIVE_SDK_ENABLED: "true",
  POLLYCAR_AMAP_EXTERNAL_APPROVAL_GRANTED: "true",
  POLLYCAR_AMAP_APPROVAL_REFERENCE: "approval-1",
  POLLYCAR_AMAP_APPROVED_ANDROID_PACKAGE: "com.rego.mobility",
  POLLYCAR_AMAP_APPROVED_IOS_BUNDLE_IDENTIFIER: "com.rego.mobility",
  POLLYCAR_AMAP_ANDROID_SDK_ENABLED: "true",
  POLLYCAR_AMAP_ANDROID_API_KEY: "secret-from-build-system",
  POLLYCAR_AMAP_ANDROID_MAVEN_COORDINATES: "com.amap.api:3dmap:11.2.0,com.amap.api:search:9.8.0",
});
assert.equal(androidPolicy.androidEnabled, true);
assert.equal(androidPolicy.iosEnabled, false);
assert.equal(androidPolicy.androidCoordinates.length, 2);

assert.throws(
  () => resolveAmapBuildPolicy(productionConfig, {
    POLLYCAR_AMAP_NATIVE_SDK_ENABLED: "true",
    POLLYCAR_AMAP_EXTERNAL_APPROVAL_GRANTED: "true",
    POLLYCAR_AMAP_APPROVAL_REFERENCE: "approval-1",
    POLLYCAR_AMAP_APPROVED_ANDROID_PACKAGE: "com.other.app",
    POLLYCAR_AMAP_APPROVED_IOS_BUNDLE_IDENTIFIER: "com.rego.mobility",
    POLLYCAR_AMAP_ANDROID_SDK_ENABLED: "true",
  }),
  /AMAP_ANDROID_PACKAGE_APPROVAL_MISMATCH/,
);
'@

$temporaryScript = Join-Path ([System.IO.Path]::GetTempPath()) "pollycar-check-amap-native.cjs"
Set-Content -LiteralPath $temporaryScript -Value $policyScript -Encoding utf8
try {
  & node $temporaryScript $policyPath
  if ($LASTEXITCODE -ne 0) { throw "高德构建策略测试失败" }
}
finally {
  Remove-Item -LiteralPath $temporaryScript -Force -ErrorAction SilentlyContinue
}

$plugin = Get-Content -LiteralPath $pluginPath -Raw
$nativeModule = Get-Content -LiteralPath $nativeModulePath -Raw
$webLoader = Get-Content -LiteralPath $webLoaderPath -Raw
$publicConfig = Get-Content -LiteralPath $publicConfigPath -Raw
$amapPublicConfig = Get-Content -LiteralPath $amapPublicConfigPath -Raw
$mapPicker = Get-Content -LiteralPath $mapPickerPath -Raw
$androidModule = Get-Content -LiteralPath $androidModulePath -Raw
$iosModule = Get-Content -LiteralPath $iosModulePath -Raw
$androidManifest = Get-Content -LiteralPath (Join-Path $repo "apps\app\android\app\src\main\AndroidManifest.xml") -Raw

foreach ($required in @(
  "resolveAmapBuildPolicy",
  "withAndroidManifest",
  "withAppBuildGradle",
  "com.amap.api.v2.apikey",
  "PollyCarAmapApiKey"
)) {
  if ($plugin -notmatch [regex]::Escape($required)) {
    throw "高德 Expo 配置插件缺少: $required"
  }
}

if ($plugin -notmatch [regex]::Escape('android:value": "${POLLYCAR_AMAP_ANDROID_API_KEY}"')) {
  throw "高德 Android Key 必须通过构建占位符注入"
}
if ($androidManifest -notmatch [regex]::Escape('${POLLYCAR_AMAP_ANDROID_API_KEY}')) {
  throw "Android Manifest 未使用高德 Key 构建占位符"
}
if ($androidManifest -match 'android:value="[0-9a-fA-F]{32}"') {
  throw "Android Manifest 禁止提交高德明文 Key"
}

foreach ($required in @(
  "noticeContainsAmapPolicy",
  "noticeShown",
  "consentGranted"
)) {
  if ($nativeModule -notmatch [regex]::Escape($required)) {
    throw "高德隐私初始化契约缺少: $required"
  }
}

foreach ($required in @(
  "AppPublicConfig",
  "config.maps.web.enabled",
  "config.maps.web.apiKey",
  "config.maps.web.securityCode",
  "_AMapSecurityConfig",
  "https://webapi.amap.com/maps?v=2.0"
)) {
  if ($webLoader -notmatch [regex]::Escape($required)) {
    throw "高德 Web JS API 受控加载缺少: $required"
  }
}

foreach ($required in @(
  "@pollycar/configuration/public",
  "EXPO_PUBLIC_POLLYCAR_PUBLIC_CONFIG"
)) {
  if ($publicConfig -notmatch [regex]::Escape($required)) {
    throw "App 公开地图配置入口缺少: $required"
  }
}

foreach ($required in @(
  "createAmapPublicConfig",
  "POLLYCAR_AMAP_EXTERNAL_APPROVAL_GRANTED",
  "POLLYCAR_AMAP_APPROVAL_REFERENCE",
  "POLLYCAR_AMAP_WEB_JS_API_KEY",
  "POLLYCAR_AMAP_WEB_JS_SECURITY_CODE"
)) {
  if ($amapPublicConfig -notmatch [regex]::Escape($required)) {
    throw "高德 Web 公开快照生成器缺少: $required"
  }
}

foreach ($required in @(
  "isWebAmapViewConfigured",
  "amapRequested",
  "nativeMapModule.gates.realDeviceLocationEnabled",
  "地图服务由高德地图提供"
)) {
  if ($mapPicker -notmatch [regex]::Escape($required)) {
    throw "前台地图产品化门禁缺少: $required"
  }
}

foreach ($module in @($androidModule, $iosModule)) {
  if ($module -notmatch '"realDeviceLocationEnabled"\s*(to|:)\s*false') {
    throw "原生地图模块不得把 SDK 可用误报为设备定位已启用"
  }
  foreach ($required in @(
    '"backgroundLocationEnabled"',
    '"realVehicleLocationStreamEnabled"'
  )) {
    if ($module -notmatch ([regex]::Escape($required) + '\s*(to|:)\s*false')) {
      throw "原生地图模块缺少关闭态门禁: $required"
    }
  }
}

foreach ($required in @(
  "PollyCarAmapApiKey",
  "AMapServices.shared().apiKey",
  "MAMapView.updatePrivacyShow",
  "MAMapView.updatePrivacyAgree",
  "AMAP_PRIVACY_CONSENT_REQUIRED"
)) {
  if ($iosModule -notmatch [regex]::Escape($required)) {
    throw "iOS 高德 Key 或隐私初始化缺少: $required"
  }
}

$policy = Get-Content -LiteralPath $policyPath -Raw
foreach ($required in @(
  "AMap3DMap-NO-IDFA",
  "AMapSearch-NO-IDFA",
  "AMAP_KEY_PUBLIC_ENV_FORBIDDEN",
  "AMAP_PRODUCTION_IDENTIFIER_REQUIRED"
)) {
  if ($policy -notmatch [regex]::Escape($required)) {
    throw "高德构建策略缺少: $required"
  }
}

$signingEvidence = Get-Content -LiteralPath $signingEvidencePath -Raw
foreach ($required in @(
  "internal-development-build-only",
  "production_evidence",
  "SHA1"
)) {
  if ($signingEvidence -notmatch [regex]::Escape($required)) {
    throw "Android 签名证据脚本缺少: $required"
  }
}

$publicKeyScanRoots = @(
  (Join-Path $repo "apps\app\app"),
  (Join-Path $repo "apps\app\src"),
  (Join-Path $repo "apps\app\app.json")
)
$forbiddenServerKeyReference = Get-ChildItem -LiteralPath $publicKeyScanRoots -Recurse -File |
  Select-String -Pattern "(EXPO_PUBLIC_.*AMAP.*WEB_SERVICE.*KEY|POLLYCAR_AMAP_WEB_SERVICE_KEY)" -CaseSensitive:$false
if ($forbiddenServerKeyReference) {
  throw "App 源码出现禁止进入客户端的高德 Web Service Key: $($forbiddenServerKeyReference.Path)"
}

Write-Host "高德前台地图的关闭态、批准、标识、Key 隔离、隐私初始化和定位边界检查通过。"
