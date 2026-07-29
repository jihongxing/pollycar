$ErrorActionPreference = "Stop"
$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$specPath = Join-Path $repo "spec\platform\operational-readiness.yaml"
$runbookPath = Join-Path $repo "docs\runbooks\共享预生产运行准备.md"
foreach ($path in @($specPath, $runbookPath)) {
  if (-not (Test-Path -LiteralPath $path)) { throw "运行准备缺少文件: $path" }
}
$spec = Get-Content -LiteralPath $specPath -Raw
foreach ($required in @(
  "external_alert_delivery_enabled: false",
  "monitoring_provider_selected: false",
  "on_call_owner_selected: false",
  "runbook_execution_enabled: false",
  "api_availability_percent: 99.9",
  "backup_restore_rto_minutes: 60",
  "backup_restore_rpo_minutes: 5",
  "raw_request_body_collection_allowed: false",
  "credential_collection_allowed: false"
)) {
  if ($spec -notmatch [regex]::Escape($required)) { throw "运行准备契约缺少: $required" }
}
Write-Host "共享预生产 SLO、告警和演练失败关闭检查通过。"
