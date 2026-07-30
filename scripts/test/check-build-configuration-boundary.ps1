$ErrorActionPreference = "Stop"

$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$configurationPath = Join-Path $repo "packages\configuration\src\build-configuration.js"
$configurationTestPath = Join-Path $repo "packages\configuration\src\build-configuration.test.js"
$appGatePath = Join-Path $repo "apps\app\scripts\production-release-readiness.mjs"
$easPath = Join-Path $repo "apps\app\eas.json"
$qualityPath = Join-Path $repo ".github\workflows\quality.yml"
$integrationPath = Join-Path $repo ".github\workflows\integration.yml"
$supplyChainPath = Join-Path $repo ".github\workflows\supply-chain.yml"
$commandPath = Join-Path $repo "scripts\build\check-build-configuration.mjs"

foreach ($path in @(
  $configurationPath,
  $configurationTestPath,
  $appGatePath,
  $easPath,
  $qualityPath,
  $integrationPath,
  $supplyChainPath,
  $commandPath
)) {
  if (-not (Test-Path -LiteralPath $path)) {
    throw "统一构建配置缺少文件: $path"
  }
}

$configuration = Get-Content -LiteralPath $configurationPath -Raw
$configurationTests = Get-Content -LiteralPath $configurationTestPath -Raw
$appGate = Get-Content -LiteralPath $appGatePath -Raw
$eas = Get-Content -LiteralPath $easPath -Raw
$quality = Get-Content -LiteralPath $qualityPath -Raw
$integration = Get-Content -LiteralPath $integrationPath -Raw
$supplyChain = Get-Content -LiteralPath $supplyChainPath -Raw
$command = Get-Content -LiteralPath $commandPath -Raw

foreach ($target in @(
  "native-ci",
  "postgres-ci",
  "production-release",
  "container-evidence",
  "container-publication"
)) {
  if (
    $configuration -notmatch [regex]::Escape($target) -or
    $configurationTests -notmatch [regex]::Escape($target)
  ) {
    throw "统一构建配置缺少目标或专项测试: $target"
  }
}

foreach ($required in @(
  "assertBuildConfiguration",
  "collectBuildConfigurationFailures",
  "BUILD_TOOLCHAIN"
)) {
  if ($configuration -notmatch [regex]::Escape($required)) {
    throw "统一构建配置缺少能力: $required"
  }
}

if (
  $appGate -notmatch [regex]::Escape("collectBuildConfigurationFailures") -or
  $appGate -notmatch [regex]::Escape('target: "production-release"')
) {
  throw "App 生产发布门禁未接入统一构建校验器"
}

foreach ($required in @(
  "POLLYCAR_BUILD_NODE_VERSION",
  "POLLYCAR_BUILD_PNPM_VERSION",
  "POLLYCAR_BUILD_JAVA_VERSION",
  "POLLYCAR_BUILD_EAS_CLI_VERSION"
)) {
  if ($eas -notmatch [regex]::Escape($required)) {
    throw "EAS 生产 Profile 缺少统一工具链配置: $required"
  }
}

if ($quality -notmatch [regex]::Escape("pnpm check:build-config container-evidence")) {
  throw "质量工作流未接入统一构建校验器"
}
foreach ($required in @(
  "pnpm check:build-config postgres-ci",
  "pnpm check:build-config native-ci",
  "POLLYCAR_NATIVE_RELEASE_UNSIGNED"
)) {
  if ($integration -notmatch [regex]::Escape($required)) {
    throw "原生与数据库工作流缺少统一构建门禁: $required"
  }
}
foreach ($required in @(
  "pnpm check:build-config container-evidence",
  "pnpm check:build-config container-publication",
  "steps.build.outputs.digest",
  "cosign sign --yes"
)) {
  if ($supplyChain -notmatch [regex]::Escape($required)) {
    throw "供应链工作流缺少统一配置、digest 或签名门禁: $required"
  }
}

if ($command -notmatch [regex]::Escape("assertBuildConfiguration")) {
  throw "统一构建配置 CLI 未调用共享校验器"
}

Write-Host "统一原生构建、EAS、CI 与供应链配置门禁检查通过。"
