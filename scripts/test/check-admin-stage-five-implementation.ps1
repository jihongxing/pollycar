$ErrorActionPreference = "Stop"
$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")

$required = @(
  "packages\contracts\src\admin-executive-dashboard.ts",
  "apps\server\src\application\executive-dashboard-query-service.ts",
  "apps\server\src\application\executive-dashboard-query-service.test.ts",
  "apps\server\src\http\admin-executive-dashboard-routes.ts",
  "apps\server\src\http\admin-executive-dashboard-routes.test.ts",
  "apps\admin\src\features\admin-stage-five\stage-five-workspace.tsx",
  "apps\admin\src\features\admin-stage-five\stage-five-workspace.css",
  "apps\admin\src\features\admin-stage-five\stage-five-workspace.test.tsx"
)
foreach ($path in $required) {
  if (-not (Test-Path -LiteralPath (Join-Path $repo $path))) {
    throw "缺少阶段五实现文件: $path"
  }
}

$contract = Get-Content -LiteralPath (Join-Path $repo "spec\admin\executive-dashboard.yaml") -Raw
foreach ($rule in @(
  'status: "implementation_approved"',
  "implementation_approved: true",
  "implementation_allowed: true",
  "runtime_code_forbidden_before_approval: false",
  "real_data_allowed: false",
  "production_enablement_allowed: false"
)) {
  if ($contract -notmatch [regex]::Escape($rule)) {
    throw "阶段五实现批准契约缺少: $rule"
  }
}

$all = (($required + @(
  "apps\server\src\application\admin-access-service.ts",
  "apps\server\src\http\internal-sandbox-server.ts",
  "apps\admin\src\features\admin-stage-one\stage-one-shell.tsx",
  "spec\platform\feature-gates.yaml"
)) | ForEach-Object { Get-Content -LiteralPath (Join-Path $repo $_) -Raw }) -join "`n"

foreach ($term in @(
  "ExecutiveDashboardQueryService",
  "OperatorExecutiveMetricsPort",
  "TripExecutiveMetricsPort",
  "DispatchExecutiveMetricsPort",
  "SupportExecutiveMetricsPort",
  "SafetyExecutiveMetricsPort",
  "FinanceExecutiveMetricsPort",
  "synthetic_admin_executive_dashboard",
  "operator-health-v1",
  "businessStateChanged",
  "appendOnly",
  "awaiting_privacy_review",
  "awaiting_domain_review",
  "deletedAfterDownload",
  "clientRecalculationAllowed",
  "containsRealData",
  "snapshotKey",
  "organizationScopeDigest",
  "dimensionKey"
)) {
  if ($all -notmatch [regex]::Escape($term)) {
    throw "阶段五实现缺少关键约束: $term"
  }
}

$openApi = Get-Content -LiteralPath (Join-Path $repo "spec\api\openapi.yaml") -Raw
$operationCount = [regex]::Matches(
  $openApi,
  '(?m)^\s{6}operationId:\s+(getAdminExecutiveOverview|getAdminExecutiveOperationsHealth|getAdminExecutiveOperatorHealth|getAdminExecutiveFinanceSafety|getAdminExecutiveSafetyCompliance|getAdminExecutiveDecisionItems|getAdminExecutiveMetricRegistry|getAdminExecutiveDrilldown|recordAdminExecutiveDecisionOpinion|createAdminExecutiveExportRequest|reviewAdminExecutiveExportPrivacy|reviewAdminExecutiveExportDomain|revokeAdminExecutiveExport|downloadAdminExecutiveExport)\s*$'
).Count
if ($operationCount -ne 14) {
  throw "阶段五 OpenAPI 操作数应为 14，实际为 $operationCount"
}

Write-Host "运营控制台阶段五高层驾驶舱合成内核实施检查通过。"
Write-Host "阶段五 API: $operationCount"
Write-Host "阶段五页面: 6"
