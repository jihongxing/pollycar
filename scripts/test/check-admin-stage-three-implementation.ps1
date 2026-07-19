$ErrorActionPreference = "Stop"
$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$required = @(
  "packages\contracts\src\admin-trip-case-management.ts",
  "apps\server\src\application\admin-access-service.ts",
  "apps\server\src\application\admin-trip-case-management-service.ts",
  "apps\server\src\http\admin-trip-case-management-routes.ts",
  "apps\admin\src\features\admin-stage-three\stage-three-workspace.tsx"
)
foreach ($path in $required) {
  if (-not (Test-Path -LiteralPath (Join-Path $repo $path))) { throw "缺少阶段三实现文件: $path" }
}
$all = ($required | ForEach-Object { Get-Content -LiteralPath (Join-Path $repo $_) -Raw }) -join "`n"
foreach ($rule in @("ADMIN_TRIP_SCOPE_FORBIDDEN", "ADMIN_SAFETY_RESTORATION_BLOCKED", "ADMIN_EVIDENCE_DUAL_APPROVAL_REQUIRED", "duplicateCommandAllowed", "Idempotency-Key", "字段级证据访问", "禁止重复业务命令")) {
  if ($all -notmatch [regex]::Escape($rule)) { throw "阶段三实现缺少: $rule" }
}
$openApi = Get-Content -LiteralPath (Join-Path $repo "spec\api\openapi.yaml") -Raw
$count = [regex]::Matches($openApi, '(?m)^\s{6}operationId:\s+(getAdminTripOperationsCenter|getAdminTrip360|getAdminSupportCase|getAdminSafetyInvestigation|getAdminEvidenceGrant|readAdminEvidenceField|getAdminCommandRecoveryTask|executeAdminTripCaseManagementCommand)\s*$').Count
if ($count -ne 8) { throw "阶段三 OpenAPI 操作数应为 8，实际为 $count" }
Write-Host "运营控制台阶段三行程客服安全合成内核实施检查通过。"
