$ErrorActionPreference = "Stop"
$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")

$required = @(
  "docs\decisions\0018-运营控制台资金运营与职责分离.md",
  "docs\product\admin\21-阶段四资金运营契约.md",
  "docs\product\admin\22-阶段四实施前设计评审.md",
  "spec\admin\finance-operations.yaml",
  "spec\tests\admin-finance-operations-scenarios.yaml",
  "spec\meta\finance-operations.schema.json",
  "spec\meta\admin-finance-operations-scenarios.schema.json",
  "docs\product\prototypes\admin-stage-four\shared\stage-four.css"
)
foreach ($path in $required) {
  if (-not (Test-Path -LiteralPath (Join-Path $repo $path))) {
    throw "缺少阶段四实施前设计文件: $path"
  }
}

$contract = Get-Content -LiteralPath (Join-Path $repo "spec\admin\finance-operations.yaml") -Raw
foreach ($rule in @(
  'status: "approved"',
  "implementation_approved: true",
  'id: "synthetic_admin_finance_operations"',
  "default_enabled: false",
  '"synthetic_financial_ledger"',
  '"synthetic_financial_reconciliation"',
  '"synthetic_operator_funds"',
  "shadow_balance_forbidden: true",
  "client_amount_edit_forbidden: true",
  "prepared_and_reviewed_by_must_differ: true",
  "early_settlement_enabled: false",
  "replacement_command_forbidden: true",
  "implementation_allowed: true",
  "runtime_code_forbidden_before_approval: false",
  "real_money_movement_allowed: false",
  "production_enablement_allowed: false"
)) {
  if ($contract -notmatch [regex]::Escape($rule)) {
    throw "阶段四资金运营契约缺少: $rule"
  }
}

$scenarios = Get-Content -LiteralPath (Join-Path $repo "spec\tests\admin-finance-operations-scenarios.yaml") -Raw
$scenarioCount = ([regex]::Matches($scenarios, '(?m)^\s{2}- id: "ADMIN-FIN-[0-9]{3}"\s*$')).Count
if ($scenarioCount -ne 32) {
  throw "阶段四验收场景应为 32 项，实际为 $scenarioCount"
}
foreach ($category in @(
  "feature_gate",
  "implementation_gate",
  "organization_scope",
  "money",
  "balance",
  "ledger",
  "allocation",
  "settlement",
  "payout",
  "refund",
  "reversal",
  "reconciliation",
  "fund_case",
  "business_day_close",
  "separation_of_duties",
  "export",
  "unknown_result"
)) {
  if ($scenarios -notmatch [regex]::Escape("category: $category")) {
    throw "阶段四验收场景缺少类别: $category"
  }
}

$errorSpec = Get-Content -LiteralPath (Join-Path $repo "spec\api\error-codes.yaml") -Raw
$scenarioErrors = @(
  [regex]::Matches($scenarios, 'expected_error:\s+"([A-Z][A-Z0-9_]+)"') |
    ForEach-Object { $_.Groups[1].Value } |
    Sort-Object -Unique
)
foreach ($errorCode in $scenarioErrors) {
  if ($errorSpec -notmatch [regex]::Escape("id: `"$errorCode`"")) {
    throw "阶段四场景引用了未注册错误码: $errorCode"
  }
}

$roles = Get-Content -LiteralPath (Join-Path $repo "spec\security\roles.yaml") -Raw
foreach ($role in @("operator_finance_officer", "operator_finance_lead")) {
  if ($roles -notmatch [regex]::Escape("id: `"$role`"")) {
    throw "阶段四角色契约缺少: $role"
  }
}

$authorization = Get-Content -LiteralPath (Join-Path $repo "spec\security\authorization-rules.yaml") -Raw
$actions = @(
  "admin_finance.operations.read",
  "admin_finance.command.execute",
  "admin_finance.allocation.read",
  "admin_finance.settlement.read",
  "admin_finance.settlement.prepare",
  "admin_finance.settlement.review",
  "admin_finance.payout.read",
  "admin_finance.payout.prepare",
  "admin_finance.payout.review",
  "admin_finance.payout.request",
  "admin_finance.refund.read",
  "admin_finance.refund.request",
  "admin_finance.reversal.read",
  "admin_finance.reversal.request",
  "admin_finance.reversal.review",
  "admin_finance.reconciliation.read",
  "admin_finance.reconciliation.resolve",
  "admin_finance.reconciliation.review",
  "admin_finance.fund_case.read",
  "admin_finance.fund_case.manage",
  "admin_finance.business_day.read",
  "admin_finance.business_day.prepare",
  "admin_finance.business_day.review",
  "admin_finance.ledger.read",
  "admin_finance.export.request",
  "admin_finance.export.approve",
  "admin_finance.recovery.read",
  "admin_finance.recovery.manage"
)
foreach ($action in $actions) {
  if ($authorization -notmatch [regex]::Escape("id: `"$action`"")) {
    throw "阶段四授权规则缺少动作: $action"
  }
}

$gates = Get-Content -LiteralPath (Join-Path $repo "spec\platform\feature-gates.yaml") -Raw
foreach ($rule in @(
  "synthetic_admin_finance_operations: false",
  'synthetic_admin_finance_operations: ["internal_sandbox", "synthetic_admin_multi_organization", "synthetic_financial_ledger", "synthetic_financial_reconciliation", "synthetic_operator_funds"]'
)) {
  if ($gates -notmatch [regex]::Escape($rule)) {
    throw "阶段四功能门禁缺少: $rule"
  }
}

$prototypeChecks = @{
  "docs\product\prototypes\admin-stage-four\finance-operations-center\index.html" = @("资金运营中心", "非零差异阻断", "待独立复核", "未知结果", "资金案件")
  "docs\product\prototypes\admin-stage-four\allocation-settlement\index.html" = @("15% / 45% / 40%", "allocation-15-45-40-v1", "金额不可编辑", "运营主体清算", "经办人与复核人必须不同")
  "docs\product\prototypes\admin-stage-four\driver-payouts\index.html" = @("T+1 车主付款", "手续费由运营主体承担", "不减少车主应付款", "提前结算关闭", "禁止第二笔付款")
  "docs\product\prototypes\admin-stage-four\refund-reversals\index.html" = @("退款与完整冲正", "引用原支付", "支付机构权威结果", "原交易保持不变", "任意分录")
  "docs\product\prototypes\admin-stage-four\reconciliation-fund-cases\index.html" = @("四方事实源", "非零差异不得自动核销", "证据引用", "独立复核", "资金案件只承载调查，不形成余额")
  "docs\product\prototypes\admin-stage-four\business-day-close\index.html" = @("日终关账", "Asia/Shanghai", "全部对账运行关闭", "零差异", "经办人与复核人必须不同")
  "docs\product\prototypes\admin-stage-four\ledger-explorer\index.html" = @("账本查询", "全局交易序列", "余额投影只读", "主体范围过滤", "编辑账本分录")
}
foreach ($entry in $prototypeChecks.GetEnumerator()) {
  $path = Join-Path $repo $entry.Key
  if (-not (Test-Path -LiteralPath $path)) {
    throw "缺少阶段四高保真原型: $($entry.Key)"
  }
  $content = Get-Content -LiteralPath $path -Raw
  foreach ($term in $entry.Value) {
    if ($content -notmatch [regex]::Escape($term)) {
      throw "阶段四高保真原型 $($entry.Key) 缺少: $term"
    }
  }
  $finalized = Join-Path (Split-Path $path -Parent) "finalized.json"
  if (-not (Test-Path -LiteralPath $finalized)) {
    throw "阶段四高保真原型缺少 finalized.json: $($entry.Key)"
  }
}

Write-Host "运营控制台阶段四资金运营实施前设计检查通过。"
Write-Host "阶段四验收场景: $scenarioCount"
Write-Host "阶段四授权动作: $($actions.Count)"
Write-Host "阶段四新增错误码: $(([regex]::Matches($errorSpec, '(?m)^\s{2}- id: "ADMIN_FINANCE_')).Count)"
Write-Host "高保真页面: $($prototypeChecks.Count)"
