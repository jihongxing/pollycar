$ErrorActionPreference = "Stop"

$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$required = @(
  "docs\decisions\0017-行程客服安全协作与证据访问.md",
  "docs\product\admin\19-阶段三行程客服安全契约.md",
  "docs\product\admin\20-阶段三实施前设计评审.md",
  "spec\admin\trip-case-management.yaml",
  "spec\tests\admin-trip-case-management-scenarios.yaml",
  "spec\meta\trip-case-management.schema.json",
  "spec\meta\admin-trip-case-management-scenarios.schema.json"
)
foreach ($path in $required) {
  if (-not (Test-Path -LiteralPath (Join-Path $repo $path))) {
    throw "缺少运营控制台阶段三设计文件: $path"
  }
}

$contract = Get-Content -LiteralPath (Join-Path $repo "spec\admin\trip-case-management.yaml") -Raw
foreach ($rule in @(
  'status: "approved"',
  "approved: true",
  'approved_on: "2026-07-14"',
  'trip_operations: "synthetic_admin_trip_operations"',
  'case_management: "synthetic_admin_case_management"',
  "copied_authoritative_state_forbidden: true",
  "direct_trip_state_mutation_forbidden: true",
  "trip_operator_snapshot_immutable: true",
  "restoration_requires_independent_reviewer: true",
  "freezer_cannot_restore: true",
  "normal_ttl_minutes: 30",
  "break_glass_ttl_minutes: 15",
  "duplicate_command_on_unknown_forbidden: true",
  "technical_operations_business_decision_forbidden: true",
  "production_admin_enabled: true"
)) {
  if ($contract -notmatch [regex]::Escape($rule)) {
    throw "阶段三行程客服安全契约缺少: $rule"
  }
}

foreach ($tripState in @(
  "pending_payment",
  "paid_pending_match",
  "scheduled",
  "reserved",
  "preparing",
  "accepted",
  "driver_en_route",
  "driver_arrived",
  "in_progress",
  "safety_frozen",
  "completed",
  "unfulfilled",
  "cancelled"
)) {
  if ($contract -notmatch "(?m)^\s{4}- $([regex]::Escape($tripState))\s*$") {
    throw "阶段三契约缺少权威行程状态: $tripState"
  }
}

$scenarios = Get-Content -LiteralPath (Join-Path $repo "spec\tests\admin-trip-case-management-scenarios.yaml") -Raw
$scenarioCount = ([regex]::Matches($scenarios, '(?m)^\s{2}- id:')).Count
if ($scenarioCount -lt 30) {
  throw "阶段三验收场景不足，当前: $scenarioCount"
}
foreach ($category in @(
  "trip_operations",
  "support_case",
  "safety_case",
  "emergency",
  "evidence",
  "cross_organization",
  "recovery",
  "authorization",
  "boundary",
  "separation_of_duties",
  "concurrency",
  "audit",
  "feature_gate"
)) {
  if ($scenarios -notmatch [regex]::Escape("category: $category")) {
    throw "阶段三验收场景缺少类别: $category"
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
    throw "阶段三场景引用了未注册错误码: $errorCode"
  }
}

$authorization = Get-Content -LiteralPath (Join-Path $repo "spec\security\authorization-rules.yaml") -Raw
foreach ($action in @(
  "admin_trip.operations.read",
  "admin_trip.operations.manage",
  "admin_trip.domain_action.request",
  "admin_trip.trip_360.read",
  "admin_support.case.read",
  "admin_support.case.manage",
  "admin_support.case.escalate",
  "admin_safety.case.read",
  "admin_safety.investigation.manage",
  "admin_safety.restoration.review",
  "admin_emergency.response.manage",
  "admin_evidence.access.request",
  "admin_evidence.access.approve",
  "admin_evidence.field.read",
  "admin_evidence.export",
  "admin_collaboration.task.manage",
  "admin_recovery.command_result.read",
  "admin_recovery.command_result.manage"
)) {
  if ($authorization -notmatch [regex]::Escape("id: `"$action`"")) {
    throw "阶段三授权规则缺少动作: $action"
  }
}

$gates = Get-Content -LiteralPath (Join-Path $repo "spec\platform\feature-gates.yaml") -Raw
foreach ($rule in @(
  "synthetic_admin_trip_operations: false",
  "synthetic_admin_case_management: false",
  'synthetic_admin_trip_operations: ["internal_sandbox", "synthetic_admin_multi_organization"]',
  'synthetic_admin_case_management: ["internal_sandbox", "synthetic_admin_multi_organization"]'
)) {
  if ($gates -notmatch [regex]::Escape($rule)) {
    throw "阶段三功能门禁缺少: $rule"
  }
}

$prototypeChecks = @{
  "docs\product\prototypes\admin-stage-three\trip-operations-center\index.html" = @(
    "行程运营中心",
    "唯一写入边界",
    "直接修改行程状态",
    "结果未知"
  )
  "docs\product\prototypes\admin-stage-three\trip-360\index.html" = @(
    "行程 360°",
    "权威时间线",
    "主体快照已固化",
    "直接修改权威状态"
  )
  "docs\product\prototypes\admin-stage-three\support-case\index.html" = @(
    "客服案件详情",
    "客服与安全权限隔离",
    "转介安全",
    "直接退款"
  )
  "docs\product\prototypes\admin-stage-three\safety-case\index.html" = @(
    "安全案件详情",
    "安全恢复双人复核",
    "恢复被阻断",
    "独立复核"
  )
  "docs\product\prototypes\admin-stage-three\evidence-access\index.html" = @(
    "字段级证据访问",
    "双人批准",
    "自动遮蔽",
    "导出证据包"
  )
  "docs\product\prototypes\admin-stage-three\unknown-result-recovery\index.html" = @(
    "未知结果恢复",
    "禁止重复提交",
    "查询原幂等结果",
    "不可作业务决定"
  )
}
foreach ($entry in $prototypeChecks.GetEnumerator()) {
  $content = Get-Content -LiteralPath (Join-Path $repo $entry.Key) -Raw
  foreach ($term in $entry.Value) {
    if ($content -notmatch [regex]::Escape($term)) {
      throw "阶段三高保真原型 $($entry.Key) 缺少: $term"
    }
  }
}

Write-Host "运营控制台阶段三实施前设计检查通过。"
Write-Host "阶段三验收场景: $scenarioCount"
Write-Host "阶段三授权动作: 18"
Write-Host "高保真页面: 6"
