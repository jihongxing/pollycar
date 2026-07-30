$ErrorActionPreference = "Stop"

$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$contractPath = Join-Path $repo "packages\contracts\src\configuration-governance.ts"
$testPath = Join-Path $repo "packages\contracts\src\configuration-governance.test.ts"
$specPath = Join-Path $repo "spec\platform\configuration-governance.yaml"
$decisionPath = Join-Path $repo "docs\decisions\0034-统一配置治理与迁移规划.md"
$amapProviderPath = Join-Path $repo "apps\server\src\adapters\amap-web-service-provider.ts"
$vehicleOcrProviderPath = Join-Path $repo "apps\server\src\adapters\tencent-cloud-vehicle-material-recognition.ts"
$deprecatedRuntimePath = Join-Path $repo "packages\configuration\src\deprecated-environment.js"

foreach ($path in @(
  $contractPath,
  $testPath,
  $specPath,
  $decisionPath,
  $amapProviderPath,
  $vehicleOcrProviderPath,
  $deprecatedRuntimePath
)) {
  if (-not (Test-Path -LiteralPath $path)) {
    throw "统一配置治理缺少文件: $path"
  }
}

$contract = Get-Content -LiteralPath $contractPath -Raw
$tests = Get-Content -LiteralPath $testPath -Raw
$spec = Get-Content -LiteralPath $specPath -Raw
$decision = Get-Content -LiteralPath $decisionPath -Raw
$amapProvider = Get-Content -LiteralPath $amapProviderPath -Raw
$vehicleOcrProvider = Get-Content -LiteralPath $vehicleOcrProviderPath -Raw
$deprecatedRuntime = Get-Content -LiteralPath $deprecatedRuntimePath -Raw

$contractKeys = [regex]::Matches($contract, '(?m)^\s+key:\s+"([^"]+)"') |
  ForEach-Object { $_.Groups[1].Value } |
  Sort-Object -Unique
$syntheticAdminKeys = [regex]::Matches(
  $contract,
  '(?m)^\s+\["([a-zA-Z]+)",\s+"[A-Z_]+"\],?$'
) | ForEach-Object {
  "capabilities.syntheticAdmin.$($_.Groups[1].Value)"
}
$contractKeys = @($contractKeys) + @($syntheticAdminKeys) | Sort-Object -Unique
$specKeys = [regex]::Matches($spec, '(?m)^\s+-\s+"([^"]+)"$') |
  ForEach-Object { $_.Groups[1].Value } |
  Sort-Object -Unique

$missingFromSpec = $contractKeys | Where-Object { $specKeys -notcontains $_ }
$missingFromContract = $specKeys | Where-Object { $contractKeys -notcontains $_ }
if ($missingFromSpec.Count -gt 0 -or $missingFromContract.Count -gt 0) {
  throw "统一配置键未对齐。规范缺少: $($missingFromSpec -join ', ')；契约缺少: $($missingFromContract -join ', ')"
}

$profileIds = @(
  "local-sandbox",
  "test",
  "demo",
  "shared-preproduction",
  "production-readiness",
  "production"
)
foreach ($profile in $profileIds) {
  if ($contract -notmatch [regex]::Escape("id: `"$profile`"") -or
      $spec -notmatch [regex]::Escape("id: `"$profile`"")) {
    throw "统一配置 Profile 未对齐: $profile"
  }
}

foreach ($required in @(
  "public_configuration_maximum_sensitivity: `"L0`"",
  "raw_authentication_secrets_forbidden: true",
  "unknown_pollycar_environment_variables_rejected: true",
  "deprecated_environment_variables_rejected: true",
  "legacy_compatibility_removed_after_batch_seven: true",
  "business_invariants_environment_configurable: false",
  "capability_dependencies_environment_configurable: false"
)) {
  if ($spec -notmatch [regex]::Escape($required)) {
    throw "统一配置规范缺少治理规则: $required"
  }
}

foreach ($required in @(
  "validateConfigurationCatalog",
  "validateConfigurationProfiles",
  "findDeprecatedConfigurationEnvironmentVariables",
  "findUnknownPollyCarEnvironmentVariables",
  "isForbiddenRawSecretEnvironmentVariable",
  "createRedactedConfigurationSummary"
)) {
  if ($tests -notmatch [regex]::Escape($required)) {
    throw "统一配置契约缺少专项测试: $required"
  }
}

$registeredNames = [regex]::Matches(
  $contract,
  '"((?:POLLYCAR|EXPO_PUBLIC_POLLYCAR|EXPO_PUBLIC_BRAND|VITE_POLLYCAR|VITE_ADMIN|VITE_SYNTHETIC_ADMIN)_[A-Z0-9_]+)"'
) | ForEach-Object { $_.Groups[1].Value }
$syntheticAdminSuffixes = [regex]::Matches(
  $contract,
  '(?m)^\s+\["[a-zA-Z]+",\s+"([A-Z_]+)"\],?$'
) | ForEach-Object { $_.Groups[1].Value }
foreach ($suffix in $syntheticAdminSuffixes) {
  $registeredNames += "POLLYCAR_SYNTHETIC_ADMIN_$suffix"
  $registeredNames += "VITE_SYNTHETIC_ADMIN_$suffix"
}
$registeredNames = $registeredNames | Sort-Object -Unique

$runtimeDeprecatedNames = [regex]::Matches(
  $deprecatedRuntime,
  '"((?:POLLYCAR|EXPO_PUBLIC_POLLYCAR|EXPO_PUBLIC_BRAND|VITE_POLLYCAR|VITE_ADMIN)_[A-Z0-9_]+)"'
) | ForEach-Object { $_.Groups[1].Value }
foreach ($suffix in $syntheticAdminSuffixes) {
  $runtimeDeprecatedNames += "POLLYCAR_SYNTHETIC_ADMIN_$suffix"
  $runtimeDeprecatedNames += "VITE_SYNTHETIC_ADMIN_$suffix"
}
$runtimeDeprecatedNames = $runtimeDeprecatedNames | Sort-Object -Unique
$missingRuntimeDeprecatedNames = $runtimeDeprecatedNames |
  Where-Object { $registeredNames -notcontains $_ }
if ($missingRuntimeDeprecatedNames.Count -gt 0) {
  throw "运行时废弃变量未登记到治理契约: $($missingRuntimeDeprecatedNames -join ', ')"
}

$sourceConfigurationNames = & rg `
  -o `
  --no-filename `
  --glob "!**/node_modules/**" `
  --glob "!**/dist*/**" `
  --glob "!**/output/**" `
  --glob "!**/*.test.*" `
  --glob "!**/*.spec.*" `
  "\b(?:POLLYCAR|EXPO_PUBLIC_POLLYCAR|EXPO_PUBLIC_BRAND|VITE_POLLYCAR|VITE_ADMIN|VITE_SYNTHETIC_ADMIN)_[A-Z0-9_]+\b" `
  (Join-Path $repo "apps") `
  (Join-Path $repo "packages\configuration") `
  (Join-Path $repo "scripts") `
  (Join-Path $repo ".github") `
  (Join-Path $repo "infrastructure")
if ($LASTEXITCODE -gt 1) {
  throw "无法扫描当前源码配置变量"
}
$sourceConfigurationNames = $sourceConfigurationNames |
  Where-Object {
    $_ -notmatch "_REQUIRED$" -and
    $_ -notin @(
      "POLLYCAR_AUTH_",
      "POLLYCAR_SYNTHETIC_ADMIN_",
      "VITE_SYNTHETIC_ADMIN_",
      "EXPO_PUBLIC_POLLYCAR_AMAP_"
    )
  } |
  Sort-Object -Unique
$unregisteredSourceNames = $sourceConfigurationNames |
  Where-Object { $registeredNames -notcontains $_ }
if ($unregisteredSourceNames.Count -gt 0) {
  throw "源码中存在未登记配置变量: $($unregisteredSourceNames -join ', ')"
}

$serverDirectEnvironmentReads = & rg `
  -n `
  --glob "*.ts" `
  --glob "!**/*.test.ts" `
  --glob "!**/*.integration.test.ts" `
  "process\.env" `
  (Join-Path $repo "apps\server\src")
if ($LASTEXITCODE -gt 1) {
  throw "无法扫描 Server 直接环境读取"
}
if ($serverDirectEnvironmentReads) {
  throw "Server 非测试源码不得直接读取 process.env: $($serverDirectEnvironmentReads -join '; ')"
}

foreach ($forbidden in @(
  "POLLYCAR_AMAP_WEB_SERVICE_KEY",
  "keySecretName"
)) {
  if ($amapProvider -match [regex]::Escape($forbidden)) {
    throw "高德 Server Adapter 不得读取原始密钥名: $forbidden"
  }
}
foreach ($required in @(
  "keyReference",
  "this.secrets.read(this.config.keyReference)"
)) {
  if ($amapProvider -notmatch [regex]::Escape($required)) {
    throw "高德 Server Adapter 缺少 Secret Reference 边界: $required"
  }
}
foreach ($forbidden in @(
  "this.config.secretId",
  "this.config.secretKey",
  "TENCENT_CLOUD_OCR_CREDENTIALS_REQUIRED"
)) {
  if ($vehicleOcrProvider -match [regex]::Escape($forbidden)) {
    throw "车辆 OCR Adapter 不得在运行时配置接收原始凭据: $forbidden"
  }
}
foreach ($required in @(
  "secretReference: string;",
  "secrets: SecretProvider;",
  "this.config.secrets.read"
)) {
  if ($vehicleOcrProvider -notmatch [regex]::Escape($required)) {
    throw "车辆 OCR Adapter 缺少 Secret Reference 边界: $required"
  }
}

& "$PSScriptRoot\check-public-config-boundary.ps1"

foreach ($required in @(
  "26 个配置族",
  "55 个统一配置键",
  "批次一：统一配置契约",
  "批次七：删除旧入口",
  "不应配置化的内容"
)) {
  if ($decision -notmatch [regex]::Escape($required)) {
    throw "统一配置审计文档缺少内容: $required"
  }
}

Write-Host "统一配置治理检查通过：55 项统一配置键、6 类 Profile、$($sourceConfigurationNames.Count) 项现有配置名、$($runtimeDeprecatedNames.Count) 项废弃入口与七批迁移计划已对齐。"
