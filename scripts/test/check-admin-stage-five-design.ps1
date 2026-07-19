$ErrorActionPreference = "Stop"
$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")

$required = @(
  "docs\decisions\0019-运营控制台高层驾驶舱与指标治理.md",
  "docs\product\admin\23-阶段五高层驾驶舱契约.md",
  "docs\product\admin\24-阶段五实施前设计评审.md",
  "spec\admin\executive-dashboard.yaml",
  "spec\tests\admin-executive-dashboard-scenarios.yaml",
  "spec\meta\executive-dashboard.schema.json",
  "spec\meta\admin-executive-dashboard-scenarios.schema.json",
  "docs\product\prototypes\admin-stage-five\shared\stage-five.css"
)
foreach ($path in $required) {
  if (-not (Test-Path -LiteralPath (Join-Path $repo $path))) {
    throw "缺少阶段五实施前设计文件: $path"
  }
}

$contract = Get-Content -LiteralPath (Join-Path $repo "spec\admin\executive-dashboard.yaml") -Raw
foreach ($rule in @(
  'status: "implementation_approved"',
  "implementation_approved: true",
  'implementation_approved_on: "2026-07-14"',
  'id: "synthetic_admin_executive_dashboard"',
  "default_enabled: false",
  '"synthetic_admin_operator_management"',
  '"synthetic_admin_trip_operations"',
  '"synthetic_admin_case_management"',
  '"synthetic_admin_finance_operations"',
  "dashboard_is_authoritative: false",
  "copied_balance_forbidden: true",
  "inherited_write_access_forbidden: true",
  "client_recalculation_forbidden: true",
  "small_sample_suppression_required: true",
  "minimum_publishable_sample: 10",
  'zero_denominator_result: "not_applicable"',
  'composite_as_of_rule: "oldest_source_timestamp"',
  'version: "operator-health-v1"',
  "weighted_average_forbidden: true",
  "weekly_monthly_reports_require_closed_period: true",
  "formal_report_fail_closed: true",
  'service: "ExecutiveDashboardQueryService"',
  "historical_snapshot_overwrite_forbidden: true",
  "direct_decision_action_forbidden: true",
  "governance_opinion_recording_allowed: true",
  "requester_and_approver_must_differ: true",
  "both_approvers_must_differ_from_requester: true",
  "cross_domain_export_forbidden: true",
  'approved_file_ttl: "PT30M"',
  'finance_lead: "exact_aggregate_l3"',
  "implementation_allowed: true",
  "runtime_code_forbidden_before_approval: false",
  "http_api_forbidden_before_approval: false",
  "admin_module_forbidden_before_approval: false",
  "real_data_allowed: false",
  "production_enablement_allowed: false"
)) {
  if ($contract -notmatch [regex]::Escape($rule)) {
    throw "阶段五高层驾驶舱契约缺少: $rule"
  }
}

$metricSection = [regex]::Match($contract, '(?ms)^metrics:\s*$.*?(?=^operator_health_rule:\s*$)').Value
$metricCount = ([regex]::Matches($metricSection, '(?m)^\s{2}- id: "(trip_completion_rate|dispatch_acceptance_rate|trip_cancellation_rate|payout_timeliness_rate|reconciliation_difference_rate|business_day_close_rate|operator_health|safety_incident_rate)"\s*$')).Count
if ($metricCount -ne 8) {
  throw "阶段五核心指标应为 8 项，实际为 $metricCount"
}
$totalMetricCount = ([regex]::Matches($metricSection, '(?m)^\s{2}- id: "[a-z][a-z0-9_]+"\s*$')).Count
if ($totalMetricCount -ne 19) {
  throw "阶段五已登记指标应为 19 项，实际为 $totalMetricCount"
}

$scenarios = Get-Content -LiteralPath (Join-Path $repo "spec\tests\admin-executive-dashboard-scenarios.yaml") -Raw
$scenarioCount = ([regex]::Matches($scenarios, '(?m)^\s{2}- id: "ADMIN-EXE-[0-9]{3}"\s*$')).Count
if ($scenarioCount -ne 32) {
  throw "阶段五验收场景应为 32 项，实际为 $scenarioCount"
}
foreach ($category in @(
  "feature_gate",
  "implementation_gate",
  "organization_scope",
  "metric",
  "freshness",
  "close_status",
  "drilldown",
  "privacy",
  "finance",
  "safety",
  "decision",
  "export"
)) {
  if ($scenarios -notmatch [regex]::Escape("category: $category")) {
    throw "阶段五验收场景缺少类别: $category"
  }
}

$roles = Get-Content -LiteralPath (Join-Path $repo "spec\security\roles.yaml") -Raw
foreach ($role in @("executive_sponsor", "operator_executive")) {
  if ($roles -notmatch [regex]::Escape("id: `"$role`"")) {
    throw "阶段五角色契约缺少: $role"
  }
}

$authorization = Get-Content -LiteralPath (Join-Path $repo "spec\security\authorization-rules.yaml") -Raw
$actions = @(
  "admin_executive.dashboard.read",
  "admin_executive.operations.read",
  "admin_executive.finance.read",
  "admin_executive.finance.amount.read",
  "admin_executive.safety_compliance.read",
  "admin_executive.decisions.read",
  "admin_executive.decision_opinion.record",
  "admin_executive.metric_registry.read",
  "admin_executive.drilldown.read",
  "admin_executive.export.request",
  "admin_executive.export.privacy_approve",
  "admin_executive.export.domain_approve",
  "admin_executive.export.revoke",
  "admin_executive.export.download"
)
foreach ($action in $actions) {
  if ($authorization -notmatch [regex]::Escape("id: `"$action`"")) {
    throw "阶段五授权规则缺少动作: $action"
  }
}

$gates = Get-Content -LiteralPath (Join-Path $repo "spec\platform\feature-gates.yaml") -Raw
foreach ($rule in @(
  "synthetic_admin_executive_dashboard: false",
  'synthetic_admin_executive_dashboard: ["internal_sandbox", "synthetic_admin_multi_organization", "synthetic_admin_operator_management", "synthetic_admin_trip_operations", "synthetic_admin_case_management", "synthetic_admin_finance_operations"]'
)) {
  if ($gates -notmatch [regex]::Escape($rule)) {
    throw "阶段五功能门禁缺少: $rule"
  }
}

$prototypeChecks = @{
  "docs\product\prototypes\admin-stage-five\executive-overview\index.html" = @("高层总览", "未关账", "记录高层决策意见", "不执行命令", "局部降级")
  "docs\product\prototypes\admin-stage-five\operations-health\index.html" = @("经营趋势与城市健康", "完成率", "接单率", "个人排名", "失败关闭")
  "docs\product\prototypes\admin-stage-five\operator-health\index.html" = @("运营主体健康", "最严重维度优先", "样本数低于 10", "suppressed", "blocked")
  "docs\product\prototypes\admin-stage-five\finance-safety\index.html" = @("资金安全", "L3 精确金额", "状态／区间／趋势", "非零差异", "未知结果")
  "docs\product\prototypes\admin-stage-five\safety-compliance\index.html" = @("安全与合规", "partial", "恢复待复核", "权限异常", "导出关闭")
  "docs\product\prototypes\admin-stage-five\decisions-metrics\index.html" = @("待决事项与指标口径", "追加式高层意见", "单一职责域", "第一道批准", "第二道批准")
}
foreach ($entry in $prototypeChecks.GetEnumerator()) {
  $path = Join-Path $repo $entry.Key
  if (-not (Test-Path -LiteralPath $path)) {
    throw "缺少阶段五高保真原型: $($entry.Key)"
  }
  $content = Get-Content -LiteralPath $path -Raw
  foreach ($term in $entry.Value) {
    if ($content -notmatch [regex]::Escape($term)) {
      throw "阶段五高保真原型 $($entry.Key) 缺少: $term"
    }
  }
  $finalized = Join-Path (Split-Path $path -Parent) "finalized.json"
  if (-not (Test-Path -LiteralPath $finalized)) {
    throw "阶段五高保真原型缺少 finalized.json: $($entry.Key)"
  }
}

Write-Host "运营控制台阶段五高层驾驶舱实施前设计检查通过。"
Write-Host "阶段五核心指标: $metricCount"
Write-Host "阶段五登记指标: $totalMetricCount"
Write-Host "阶段五验收场景: $scenarioCount"
Write-Host "阶段五授权动作: $($actions.Count)"
Write-Host "高保真页面: $($prototypeChecks.Count)"
