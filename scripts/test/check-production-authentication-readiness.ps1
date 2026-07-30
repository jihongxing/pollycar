$ErrorActionPreference = "Stop"

$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$specPath = Join-Path $repo "spec\platform\production-authentication.yaml"
$decisionPath = Join-Path $repo "docs\decisions\0030-真实账号与认证生产接入准备.md"
$configPath = Join-Path $repo "apps\server\src\authentication\production-authentication-readiness.ts"
$unifiedConfigPath = Join-Path $repo "packages\configuration\src\server-runtime-config.js"
$adapterPath = Join-Path $repo "apps\server\src\adapters\disabled-production-authentication.ts"
$testPath = Join-Path $repo "apps\server\src\authentication\production-authentication-readiness.test.ts"
$unifiedConfigTestPath = Join-Path $repo "packages\configuration\src\server-runtime-config.test.js"

foreach ($path in @(
  $specPath,
  $decisionPath,
  $configPath,
  $unifiedConfigPath,
  $adapterPath,
  $testPath,
  $unifiedConfigTestPath
)) {
  if (-not (Test-Path -LiteralPath $path)) {
    throw "生产认证准备缺少文件: $path"
  }
}

$spec = Get-Content -LiteralPath $specPath -Raw
foreach ($required in @(
  "production_enabled: false",
  "production_authentication_enabled: false",
  "authentication_routes_enabled: false",
  "production_migrations_enabled: false",
  "real_phone_data_enabled: false",
  "real_sms_delivery_enabled: false",
  "real_identity_verification_enabled: false",
  "real_biometric_verification_enabled: false",
  "real_driver_liveness_verification_enabled: false",
  "real_admin_accounts_enabled: false",
  "phone_authentication_grants_business_access: false",
  "app_account_reuse_for_admin_forbidden: true",
  "recommended_strategy: `"managed_oidc`"",
  "sms_mfa_forbidden: true",
  "raw_secrets_allowed: false",
  "production_database_schema_created: false",
  "production_http_routes_mounted: false",
  "supplier_sdk_integrated: false"
)) {
  if ($spec -notmatch [regex]::Escape($required)) {
    throw "生产认证准备契约缺少: $required"
  }
}

$approvalCount = [regex]::Matches(
  $spec,
  "(?m)^\s{4}approved: false\s*$"
).Count
$evidenceCount = [regex]::Matches(
  $spec,
  "(?m)^\s{4}evidence_reference: null\s*$"
).Count
if ($approvalCount -ne 6 -or $evidenceCount -ne 6) {
  throw "生产认证准备必须包含六类默认未批准状态和证据引用"
}

$configProxy = Get-Content -LiteralPath $configPath -Raw
foreach ($required in @(
  '@pollycar/configuration',
  "getProductionAuthenticationReadinessConfig"
)) {
  if ($configProxy -notmatch [regex]::Escape($required)) {
    throw "生产认证准备 Server 入口未接入统一配置: $required"
  }
}

$config = Get-Content -LiteralPath $unifiedConfigPath -Raw
foreach ($required in @(
  'mode: "disabled"',
  "PRODUCTION_AUTHENTICATION_NOT_APPROVED",
  "PRODUCTION_AUTHENTICATION_RAW_SECRET_FORBIDDEN",
  "PRODUCTION_AUTHENTICATION_CONFIGURATION_INCOMPLETE",
  "PRODUCTION_AUTHENTICATION_SECRET_REFERENCE_INVALID"
)) {
  if ($config -notmatch [regex]::Escape($required)) {
    throw "生产认证准备配置缺少: $required"
  }
}

$adapter = Get-Content -LiteralPath $adapterPath -Raw
foreach ($required in @(
  "PRODUCTION_SMS_DELIVERY_DISABLED",
  "PRODUCTION_IDENTITY_PROVIDER_DISABLED",
  "realDataEnabled = false"
)) {
  if ($adapter -notmatch [regex]::Escape($required)) {
    throw "生产认证失败关闭适配器缺少: $required"
  }
}

Write-Host "真实账号与认证生产接入准备检查通过。"
Write-Host "审批角色: $approvalCount"
Write-Host "生产认证、真实手机号、真实短信、真实身份与真实管理员账号保持关闭。"
