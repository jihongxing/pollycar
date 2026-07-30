$ErrorActionPreference = "Stop"
$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")

$required = @(
  "docs\decisions\0033-运营后台三级授权模型迁移.md",
  "spec\admin\role-access-matrix.yaml",
  "spec\tests\admin-role-access-matrix-scenarios.yaml",
  "spec\meta\role-access-matrix.schema.json",
  "spec\meta\admin-role-access-matrix-scenarios.schema.json"
)
foreach ($path in $required) {
  if (-not (Test-Path -LiteralPath (Join-Path $repo $path))) { throw "缺少角色权限矩阵设计文件: $path" }
}

$contract = Get-Content -LiteralPath (Join-Path $repo "spec\admin\role-access-matrix.yaml") -Raw
foreach ($rule in @(
  'status: "design_frozen"',
  "implementation_approved: true",
  'id: "synthetic_admin_role_access_matrix"',
  "default_enabled: false",
  "platform_identity_implies_all_permissions: false",
  "universal_administrator_forbidden: true",
  "global_scope_forbidden: true",
  "operator_id_fixed: true",
  "wildcard_operator_scope_forbidden: true",
  "runtime_compatibility: false",
  "authorization_by_legacy_role_forbidden: true",
  "navigation_api_forbidden_before_approval: false"
)) {
  if ($contract -notmatch [regex]::Escape($rule)) { throw "角色权限矩阵缺少: $rule" }
}

$levelCount = ([regex]::Matches($contract, '(?m)^\s{2}- id: "level_[123]"\s*$')).Count
$capabilityCount = ([regex]::Matches($contract, '(?m)^\s{2}- id: "(operations_task|operator_governance|fleet_operation|fleet_review|trip_operation|support_case|safety_investigation|safety_restoration_review|finance_operation|finance_review|privacy_governance|analytics_read|audit_read|technical_recovery|executive_read|membership_governance)"\s*$')).Count
$menuCount = ([regex]::Matches($contract, '(?m)^\s{2}- id: "(workbench|organization_accounts|operator_management|driver_vehicle|trip_operations|support_safety|finance_operations|data_reports|executive_dashboard|audit_system)"\s*$')).Count
if ($levelCount -ne 3) { throw "授权层级应为 3 项，实际为 $levelCount" }
if ($capabilityCount -ne 16) { throw "业务能力应为 16 项，实际为 $capabilityCount" }
if ($menuCount -ne 10) { throw "一级菜单应为 10 项，实际为 $menuCount" }

$scenarios = Get-Content -LiteralPath (Join-Path $repo "spec\tests\admin-role-access-matrix-scenarios.yaml") -Raw
$scenarioCount = ([regex]::Matches($scenarios, '(?m)^\s{2}- id: "ADMIN-RBAC-[0-9]{3}"\s*$')).Count
if ($scenarioCount -ne 32) { throw "角色权限矩阵场景应为 32 项，实际为 $scenarioCount" }
foreach ($category in @("feature_gate", "implementation_gate", "authorization_level", "capability", "separation", "navigation", "route", "organization_scope", "operation", "field", "export", "bulk_action")) {
  if ($scenarios -notmatch [regex]::Escape("category: $category")) { throw "角色权限矩阵场景缺少类别: $category" }
}

$errors = Get-Content -LiteralPath (Join-Path $repo "spec\api\error-codes.yaml") -Raw
foreach ($errorCode in @([regex]::Matches($scenarios, 'expected_error:\s+"([A-Z][A-Z0-9_]+)"') | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique)) {
  if ($errors -notmatch [regex]::Escape("id: `"$errorCode`"")) { throw "角色权限矩阵场景引用未知错误码: $errorCode" }
}

$gates = Get-Content -LiteralPath (Join-Path $repo "spec\platform\feature-gates.yaml") -Raw
foreach ($rule in @(
  "synthetic_admin_role_access_matrix: false",
  'synthetic_admin_role_access_matrix: ["internal_sandbox", "synthetic_admin_multi_organization", "synthetic_admin_authentication"]'
)) {
  if ($gates -notmatch [regex]::Escape($rule)) { throw "角色权限矩阵门禁缺少: $rule" }
}

Write-Host "运营后台三级授权模型与授权导航契约检查通过。"
Write-Host "授权层级: $levelCount"
Write-Host "业务能力: $capabilityCount"
Write-Host "一级菜单: $menuCount"
Write-Host "验收场景: $scenarioCount"
