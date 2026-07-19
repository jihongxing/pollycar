$ErrorActionPreference = "Stop"

$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$required = @(
  "spec\admin\review-task-workflow.yaml",
  "spec\admin\vehicle-review-decisions.yaml",
  "spec\admin\field-disclosure.yaml",
  "spec\admin\decision-messages.yaml",
  "spec\tests\admin-review-scenarios.yaml",
  "docs\decisions\0009-运营后台技术选型.md",
  "docs\product\prototypes\admin-reference\index.html",
  "docs\product\prototypes\admin-reference\styles.css",
  "docs\product\prototypes\admin-reference\prototype.js",
  "docs\product\admin\09-设计评审记录.md"
)
foreach ($path in $required) {
  if (-not (Test-Path -LiteralPath (Join-Path $repo $path))) {
    throw "缺少运营后台收敛证据: $path"
  }
}

$task = Get-Content -LiteralPath (Join-Path $repo "spec\admin\review-task-workflow.yaml") -Raw
foreach ($rule in @(
  "atomic_claim: true",
  'lease_duration: "PT30M"',
  "deny_write_after_loss: true",
  "self_review_forbidden: true",
  "operations_business_decision_forbidden: true",
  "production_enabled: false"
)) {
  if ($task -notmatch [regex]::Escape($rule)) { throw "审核任务规范缺少: $rule" }
}

$decisions = Get-Content -LiteralPath (Join-Path $repo "spec\admin\vehicle-review-decisions.yaml") -Raw
foreach ($rule in @(
  "request_material:",
  "approve:",
  "reject:",
  "escalate:",
  "reconsider:",
  "original_actor_must_differ: true",
  "user_message_preview_required: true"
)) {
  if ($decisions -notmatch [regex]::Escape($rule)) { throw "审核决定规范缺少: $rule" }
}

$disclosure = Get-Content -LiteralPath (Join-Path $repo "spec\admin\field-disclosure.yaml") -Raw
foreach ($rule in @(
  "default_policy: deny",
  "reveal_all_forbidden: true",
  "access_audit_required: true",
  'ttl: "PT5M"',
  "task_ownership_required: true"
)) {
  if ($disclosure -notmatch [regex]::Escape($rule)) { throw "字段披露规范缺少: $rule" }
}

$messages = Get-Content -LiteralPath (Join-Path $repo "spec\admin\decision-messages.yaml") -Raw
foreach ($rule in @(
  "preview_required_before_submit: true",
  "free_text_only_forbidden: true",
  "sensitive_detail_in_user_message_forbidden: true",
  "approved_standard:"
)) {
  if ($messages -notmatch [regex]::Escape($rule)) { throw "决定文案规范缺少: $rule" }
}

$scenarios = Get-Content -LiteralPath (Join-Path $repo "spec\tests\admin-review-scenarios.yaml") -Raw
$scenarioCount = ([regex]::Matches($scenarios, '(?m)^\s{2}- id:')).Count
if ($scenarioCount -lt 14) { throw "后台验收场景不足，当前: $scenarioCount" }
foreach ($category in @("concurrency", "authorization", "separation_of_duties", "data_protection", "safety", "resilience", "audit")) {
  if ($scenarios -notmatch [regex]::Escape("category: $category")) {
    throw "后台验收场景缺少类别: $category"
  }
}

$errors = Get-Content -LiteralPath (Join-Path $repo "spec\api\error-codes.yaml") -Raw
foreach ($code in @(
  "ADMIN_TASK_ALREADY_CLAIMED",
  "ADMIN_TASK_OWNERSHIP_LOST",
  "ADMIN_SELF_REVIEW_FORBIDDEN",
  "ADMIN_SELF_RECONSIDERATION_FORBIDDEN",
  "ADMIN_DISCLOSURE_PURPOSE_REQUIRED",
  "ADMIN_DISCLOSURE_EXPIRED",
  "ADMIN_OPEN_RISK_BLOCKS_APPROVAL",
  "ADMIN_DECISION_REASON_REQUIRED"
)) {
  if ($errors -notmatch [regex]::Escape($code)) { throw "错误码规范缺少: $code" }
}

$prototype = Get-Content -LiteralPath (Join-Path $repo "docs\product\prototypes\admin-reference\index.html") -Raw
$pageCount = ([regex]::Matches($prototype, 'data-page="')).Count
if ($pageCount -lt 13) { throw "后台高保真页面不足，当前: $pageCount" }
foreach ($term in @("内部沙箱", "敏感披露", "要求补充", "批准确认", "拒绝确认", "并发冲突", "所有权失效", "审计记录", "死信与人工重放")) {
  if ($prototype -notmatch [regex]::Escape($term)) { throw "后台原型缺少关键页面或状态: $term" }
}

$decision = Get-Content -LiteralPath (Join-Path $repo "docs\decisions\0009-运营后台技术选型.md") -Raw
foreach ($rule in @('`已批准`', 'React 19', 'Vite', 'TanStack Router', '不得使用通用管理员模板', '不批准创建后台工程')) {
  if ($decision -notmatch [regex]::Escape($rule)) { throw "运营后台技术决策缺少: $rule" }
}

$review = Get-Content -LiteralPath (Join-Path $repo "docs\product\admin\09-设计评审记录.md") -Raw
foreach ($rule in @("产品、安全、隐私和工程设计评审已通过", "产品评审", "安全评审", "隐私评审", "工程评审")) {
  if ($review -notmatch [regex]::Escape($rule)) { throw "运营后台设计评审缺少: $rule" }
}

Write-Host "运营后台设计与实现准入检查通过。"
Write-Host "后台验收场景: $scenarioCount"
Write-Host "高保真页面状态: $pageCount"
