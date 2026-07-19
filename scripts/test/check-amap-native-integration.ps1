$ErrorActionPreference = "Stop"

$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$policyPath = Join-Path $repo "apps\app\plugins\amap-build-policy.cjs"
$pluginPath = Join-Path $repo "apps\app\plugins\with-pollycar-map-module.cjs"
$nativeModulePath = Join-Path $repo "apps\app\src\native\map-native-module.ts"
$signingEvidencePath = Join-Path $repo "scripts\mobile\get-android-signing-evidence.ps1"

foreach ($path in @($policyPath, $pluginPath, $nativeModulePath, $signingEvidencePath)) {
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

foreach ($required in @(
  "noticeContainsAmapPolicy",
  "noticeShown",
  "consentGranted"
)) {
  if ($nativeModule -notmatch [regex]::Escape($required)) {
    throw "高德隐私初始化契约缺少: $required"
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
$publicKeyReference = Get-ChildItem -LiteralPath $publicKeyScanRoots -Recurse -File |
  Select-String -Pattern "EXPO_PUBLIC_.*AMAP.*KEY" -CaseSensitive:$false
if ($publicKeyReference) {
  throw "App 源码出现公开高德 Key 环境变量: $($publicKeyReference.Path)"
}

Write-Host "高德原生 SDK 关闭态、批准、标识、依赖、Key 和隐私初始化门禁检查通过。"
