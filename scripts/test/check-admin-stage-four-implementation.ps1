$ErrorActionPreference = "Stop"
$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")

$required = @(
  "packages\contracts\src\admin-finance-operations.ts",
  "apps\server\src\application\admin-finance-operations-service.ts",
  "apps\server\src\application\admin-finance-operations-service.test.ts",
  "apps\server\src\http\admin-finance-operations-routes.ts",
  "apps\server\src\http\admin-finance-operations-routes.test.ts",
  "apps\admin\src\features\admin-stage-four\stage-four-workspace.tsx",
  "apps\admin\src\features\admin-stage-four\stage-four-workspace.test.tsx"
)
foreach ($path in $required) {
  if (-not (Test-Path -LiteralPath (Join-Path $repo $path))) {
    throw "缺少阶段四实现文件: $path"
  }
}

$contract = Get-Content -LiteralPath (Join-Path $repo "spec\admin\finance-operations.yaml") -Raw
foreach ($rule in @(
  'status: "approved"',
  "implementation_approved: true",
  "implementation_allowed: true",
  "runtime_code_forbidden_before_approval: false",
  "real_money_movement_allowed: false",
  "production_enablement_allowed: false"
)) {
  if ($contract -notmatch [regex]::Escape($rule)) {
    throw "阶段四实现批准契约缺少: $rule"
  }
}

$all = (($required + @(
  "spec\admin\finance-operations.yaml",
  "spec\platform\feature-gates.yaml"
)) | ForEach-Object { Get-Content -LiteralPath (Join-Path $repo $_) -Raw }) -join "`n"
foreach ($term in @(
  "synthetic_admin_finance_operations",
  "allocation-15-45-40-v1",
  "ADMIN_FINANCE_SETTLEMENT_BLOCKED",
  "ADMIN_FINANCE_PAYOUT_BLOCKED",
  "ADMIN_FINANCE_REVIEWER_CONFLICT",
  "ADMIN_FINANCE_UNKNOWN_RESULT_IN_PROGRESS",
  "CONFLICT_IDEMPOTENCY_KEY_REUSED",
  "balanceProjectionReadOnly",
  "entryEditAllowed",
  "Idempotency-Key",
  "T+1 车主付款",
  "资金运营中心"
)) {
  if ($all -notmatch [regex]::Escape($term)) {
    throw "阶段四实现缺少关键约束: $term"
  }
}

$openApi = Get-Content -LiteralPath (Join-Path $repo "spec\api\openapi.yaml") -Raw
$operationCount = [regex]::Matches(
  $openApi,
  '(?m)^\s{6}operationId:\s+(getAdminFinanceOperationsCenter|getAdminAllocationSettlement|getAdminDriverPayout|getAdminRefundReversal|getAdminReconciliationFundCases|getAdminBusinessDayClose|getAdminLedgerTransaction|executeAdminFinanceOperationsCommand)\s*$'
).Count
if ($operationCount -ne 8) {
  throw "阶段四 OpenAPI 操作数应为 8，实际为 $operationCount"
}

Write-Host "运营控制台阶段四资金运营合成内核实施检查通过。"
Write-Host "阶段四 API: $operationCount"
Write-Host "阶段四页面: 7"
