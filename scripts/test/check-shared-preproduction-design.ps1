$ErrorActionPreference = "Stop"

$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$specPath = Join-Path $repo "spec\platform\shared-preproduction.yaml"
$decisionPath = Join-Path $repo "docs\decisions\0029-共享预生产基础设施设计与审批.md"
$implementationPath = Join-Path $repo "infrastructure\shared-preproduction\README.md"

foreach ($path in @($specPath, $decisionPath, $implementationPath)) {
  if (-not (Test-Path -LiteralPath $path)) {
    throw "共享预生产设计缺少文件: $path"
  }
}

$spec = Get-Content -LiteralPath $specPath -Raw

foreach ($required in @(
  "production_enabled: false",
  "resource_creation_enabled: false",
  "deployment_enabled: false",
  "business_routes_enabled: false",
  "real_data_allowed: false",
  "provider_selected: false",
  "account_selected: false",
  "region_selected: false",
  "target_rpo_minutes: 5",
  "target_rto_minutes: 60",
  "cross_region_replication_enabled: false",
  "cross_region_backup_enabled: false",
  "plan_generation_enabled: true",
  "apply_enabled: false",
  "provider_adapter_enabled: false",
  "plan_requires_zero_resource_changes_while_blocked: true",
  "raw_secrets_in_input_forbidden: true",
  "plan_digest_confirmation_required_for_apply: true"
)) {
  if ($spec -notmatch [regex]::Escape($required)) {
    throw "共享预生产设计缺少失败关闭条件: $required"
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

if ($approvalCount -ne 5) {
  throw "共享预生产设计必须包含五类默认未批准状态，当前数量: $approvalCount"
}
if ($evidenceCount -ne 5) {
  throw "共享预生产设计必须包含五类空证据引用，当前数量: $evidenceCount"
}

foreach ($forbidden in @(
  "production_enabled: true",
  "resource_creation_enabled: true",
  "deployment_enabled: true",
  "business_routes_enabled: true",
  "real_data_allowed: true",
  "self_signed_allowed: true",
  "database_public_ip_allowed: true",
  "long_lived_cloud_access_keys_allowed: true"
)) {
  if ($spec -match [regex]::Escape($forbidden)) {
    throw "共享预生产设计出现禁止配置: $forbidden"
  }
}

Write-Host "共享预生产架构与审批门禁检查通过。"
Write-Host "审批角色: $approvalCount"
Write-Host "目标 RPO/RTO: 5 分钟 / 60 分钟"
