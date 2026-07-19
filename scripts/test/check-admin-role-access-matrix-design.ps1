$ErrorActionPreference = "Stop"
$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")

$required = @(
  "docs\decisions\0021-运营后台角色权限与授权导航.md",
  "docs\product\admin\28-后台角色权限与授权导航契约.md",
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
  "platform_identity_global_scope_forbidden: true",
  "operator_membership_operator_id_fixed: true",
  "wildcard_operator_scope_forbidden: true",
  "navigation_api_forbidden_before_approval: false"
)) {
  if ($contract -notmatch [regex]::Escape($rule)) { throw "角色权限矩阵缺少: $rule" }
}

$platformRoleCount = ([regex]::Matches($contract, '(?m)^\s{2}- id: "(platform_access_administrator|operations_officer|operations_lead|operator_management_officer|reviewer|senior_reviewer|customer_support|support_lead|safety_officer|safety_lead|finance_officer|finance_lead|privacy_compliance|data_analyst|auditor|technical_operations|executive_sponsor)"\s*$')).Count
$operatorRoleCount = ([regex]::Matches($contract, '(?m)^\s{2}- id: "(operator_account_administrator|operator_operations_lead|operator_fleet_officer|operator_customer_support|operator_safety_liaison|operator_finance_officer|operator_finance_lead|operator_auditor|operator_executive)"\s*$')).Count
$menuCount = ([regex]::Matches($contract, '(?m)^\s{2}- id: "(workbench|organization_accounts|operator_management|driver_vehicle|trip_operations|support_safety|finance_operations|data_reports|executive_dashboard|audit_system)"\s*$')).Count
if ($platformRoleCount -ne 17) { throw "平台角色应为 17 项，实际为 $platformRoleCount" }
if ($operatorRoleCount -ne 9) { throw "运营公司角色应为 9 项，实际为 $operatorRoleCount" }
if ($menuCount -ne 10) { throw "一级菜单应为 10 项，实际为 $menuCount" }

$scenarios = Get-Content -LiteralPath (Join-Path $repo "spec\tests\admin-role-access-matrix-scenarios.yaml") -Raw
$scenarioCount = ([regex]::Matches($scenarios, '(?m)^\s{2}- id: "ADMIN-RBAC-[0-9]{3}"\s*$')).Count
if ($scenarioCount -ne 32) { throw "角色权限矩阵场景应为 32 项，实际为 $scenarioCount" }
foreach ($category in @("feature_gate", "implementation_gate", "role", "role_combination", "navigation", "route", "organization_scope", "operation", "field", "export", "bulk_action")) {
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

Write-Host "运营后台角色权限与授权导航实施前契约检查通过。"
Write-Host "平台角色: $platformRoleCount"
Write-Host "运营公司角色: $operatorRoleCount"
Write-Host "一级菜单: $menuCount"
Write-Host "验收场景: $scenarioCount"
