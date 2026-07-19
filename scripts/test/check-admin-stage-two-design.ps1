$ErrorActionPreference = "Stop"

$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$required = @(
  "docs\decisions\0016-运营主体生命周期与主运营关系迁移.md",
  "docs\product\admin\17-阶段二组织与运力契约.md",
  "docs\product\admin\18-阶段二实施前设计评审.md",
  "spec\admin\operator-management.yaml",
  "spec\tests\admin-operator-management-scenarios.yaml",
  "docs\product\prototypes\admin-stage-two\shared\stage-two.css",
  "docs\product\prototypes\admin-stage-two\shared\stage-two.js",
  "docs\product\prototypes\admin-stage-two\operator-360\index.html",
  "docs\product\prototypes\admin-stage-two\onboarding-case\index.html",
  "docs\product\prototypes\admin-stage-two\driver-360\index.html",
  "docs\product\prototypes\admin-stage-two\vehicle-360\index.html",
  "docs\product\prototypes\admin-stage-two\primary-operator-migration\index.html"
)

foreach ($path in $required) {
  if (-not (Test-Path -LiteralPath (Join-Path $repo $path))) {
    throw "缺少运营控制台阶段二设计证据: $path"
  }
}

$contract = Get-Content -LiteralPath (Join-Path $repo "spec\admin\operator-management.yaml") -Raw
foreach ($rule in @(
  "approved: true",
  'approved_on: "2026-07-14"',
  "synthetic_only: true",
  "internal_sandbox_only: true",
  "feature_gate_default_enabled: false",
  "real_data_forbidden: true",
  "id: synthetic_admin_operator_management",
  "synthetic_admin_multi_organization",
  "duplicated_fact_source_forbidden: true",
  "direct_state_update_forbidden: true",
  "exited_reactivation_forbidden: true",
  "account_activation_automatic: false",
  "wildcard_city_forbidden: true",
  "source_fact_editing_forbidden: true",
  'authoritative_table: "pollycar_finance.driver_operator_memberships"',
  "one_active_relationship_required: true",
  "historical_relationship_update_forbidden: true",
  "trip_operator_snapshot_immutable: true",
  "independent_review_required: true",
  "future_effective_at_required: true",
  "rollback_after_effective_forbidden: true",
  "atomic_end_and_create_required: true",
  "unresolved_nonzero_reconciliation_difference_forbidden: true",
  "real_primary_operator_migration: false",
  "production_admin_enabled: false"
)) {
  if ($contract -notmatch [regex]::Escape($rule)) {
    throw "阶段二运营主体契约缺少: $rule"
  }
}

foreach ($state in @(
  "candidate",
  "onboarding_review",
  "pending_activation",
  "active",
  "restricted",
  "suspended",
  "exit_pending",
  "exited"
)) {
  if ($contract -notmatch "(?m)^\s{4}- $([regex]::Escape($state))\s*$") {
    throw "阶段二运营主体生命周期缺少状态: $state"
  }
}

$scenarios = Get-Content -LiteralPath (Join-Path $repo "spec\tests\admin-operator-management-scenarios.yaml") -Raw
$scenarioCount = ([regex]::Matches($scenarios, '(?m)^\s{2}- id:')).Count
if ($scenarioCount -lt 27) {
  throw "阶段二运营主体验收场景不足，当前: $scenarioCount"
}
foreach ($category in @(
  "lifecycle",
  "onboarding",
  "capability",
  "authorization",
  "boundary",
  "data_protection",
  "migration",
  "separation_of_duties",
  "concurrency",
  "audit",
  "feature_gate"
)) {
  if ($scenarios -notmatch [regex]::Escape("category: $category")) {
    throw "阶段二验收场景缺少类别: $category"
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
    throw "阶段二场景引用了未注册错误码: $errorCode"
  }
}

$authorization = Get-Content -LiteralPath (Join-Path $repo "spec\security\authorization-rules.yaml") -Raw
foreach ($action in @(
  "admin_operator.profile.read",
  "admin_operator.onboarding.manage",
  "admin_operator.onboarding.review",
  "admin_operator.lifecycle.propose",
  "admin_operator.lifecycle.review",
  "admin_operator.city_capability.manage",
  "admin_operator.driver_360.read",
  "admin_operator.vehicle_360.read",
  "admin_operator.primary_relationship.read",
  "admin_operator.migration.manage",
  "admin_operator.migration.acknowledge",
  "admin_operator.migration.review"
)) {
  if ($authorization -notmatch [regex]::Escape("id: `"$action`"")) {
    throw "阶段二授权规则缺少动作: $action"
  }
}

$gates = Get-Content -LiteralPath (Join-Path $repo "spec\platform\feature-gates.yaml") -Raw
foreach ($rule in @(
  "synthetic_admin_operator_management: false",
  'synthetic_admin_operator_management: ["internal_sandbox", "synthetic_admin_multi_organization"]',
  "real_admin_organization_accounts: false",
  "production_admin_enabled: false"
)) {
  if ($gates -notmatch [regex]::Escape($rule)) {
    throw "阶段二功能门禁缺少: $rule"
  }
}

$prototypeChecks = @{
  "docs\product\prototypes\admin-stage-two\operator-360\index.html" = @(
    "运营主体 360°",
    "生命周期",
    "城市与能力",
    "资金关闭态"
  )
  "docs\product\prototypes\admin-stage-two\onboarding-case\index.html" = @(
    "入驻案件",
    "必需检查",
    "提交独立复核",
    '仅进入“待激活”'
  )
  "docs\product\prototypes\admin-stage-two\driver-360\index.html" = @(
    "车主 360°",
    "主体上下文固定",
    "严格敏感字段",
    "主运营关系历史"
  )
  "docs\product\prototypes\admin-stage-two\vehicle-360\index.html" = @(
    "车辆 360°",
    "权威来源：车辆审核域",
    "直接修改审核状态",
    "历史行程快照保持不变"
  )
  "docs\product\prototypes\admin-stage-two\primary-operator-migration\index.html" = @(
    "主运营关系迁移",
    "双方确认",
    "独立复核",
    "不可回滚"
  )
}

foreach ($entry in $prototypeChecks.GetEnumerator()) {
  $content = Get-Content -LiteralPath (Join-Path $repo $entry.Key) -Raw
  foreach ($term in $entry.Value) {
    if ($content -notmatch [regex]::Escape($term)) {
      throw "阶段二高保真原型 $($entry.Key) 缺少: $term"
    }
  }
}

Write-Host "运营控制台阶段二实施前设计检查通过。"
Write-Host "阶段二验收场景: $scenarioCount"
Write-Host "高保真页面: 5"
