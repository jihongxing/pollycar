$ErrorActionPreference = "Stop"

$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$required = @(
  "docs\decisions\0015-运营控制台多组织授权与审计模型.md",
  "docs\product\admin\15-阶段一多组织权限与审计契约.md",
  "docs\product\admin\16-阶段一实施前设计评审.md",
  "spec\admin\internal-access-control.yaml",
  "spec\admin\audit-event-model.yaml",
  "spec\tests\admin-multi-organization-scenarios.yaml",
  "docs\product\prototypes\admin-stage-one\shared\styles.css",
  "docs\product\prototypes\admin-stage-one\shared\prototype.js",
  "docs\product\prototypes\admin-stage-one\platform-workbench\index.html",
  "docs\product\prototypes\admin-stage-one\operator-workbench\index.html",
  "docs\product\prototypes\admin-stage-one\operator-directory\index.html"
)

foreach ($path in $required) {
  if (-not (Test-Path -LiteralPath (Join-Path $repo $path))) {
    throw "缺少运营控制台阶段一设计证据: $path"
  }
}

$access = Get-Content -LiteralPath (Join-Path $repo "spec\admin\internal-access-control.yaml") -Raw
foreach ($rule in @(
  "default_policy: deny",
  "client_scope_trusted: false",
  "server_reauthorization_required: true",
  "repository_scope_required: true",
  "cross_operator_access_forbidden: true",
  "deep_link_revalidation_required: true",
  'default_max_ttl: "PT4H"',
  'restricted_data_max_ttl: "PT15M"',
  "separation_of_duties_bypass_forbidden: true",
  "maker_checker_must_differ: true",
  "operator_user_access_forbidden: true",
  "production_admin_enabled: false"
)) {
  if ($access -notmatch [regex]::Escape($rule)) {
    throw "阶段一授权契约缺少: $rule"
  }
}

$audit = Get-Content -LiteralPath (Join-Path $repo "spec\admin\audit-event-model.yaml") -Raw
foreach ($rule in @(
  "append_only: true",
  "update_forbidden: true",
  "delete_forbidden: true",
  "sensitive_plaintext_forbidden: true",
  "access_denied",
  "organization_context_changed",
  "sensitive_data_disclosed",
  "immutable_database_enforcement_required_before_production: true"
)) {
  if ($audit -notmatch [regex]::Escape($rule)) {
    throw "阶段一审计契约缺少: $rule"
  }
}

$scenarios = Get-Content -LiteralPath (Join-Path $repo "spec\tests\admin-multi-organization-scenarios.yaml") -Raw
$scenarioCount = ([regex]::Matches($scenarios, '(?m)^\s{2}- id:')).Count
if ($scenarioCount -lt 20) {
  throw "阶段一多组织验收场景不足，当前: $scenarioCount"
}
foreach ($category in @("authorization", "navigation", "boundary", "data_protection", "separation_of_duties", "audit", "feature_gate")) {
  if ($scenarios -notmatch [regex]::Escape("category: $category")) {
    throw "阶段一验收场景缺少类别: $category"
  }
}

$gates = Get-Content -LiteralPath (Join-Path $repo "spec\platform\feature-gates.yaml") -Raw
foreach ($rule in @(
  "synthetic_admin_multi_organization: false",
  "real_admin_organization_accounts: false",
  "real_admin_finance_operations: false",
  "production_admin_enabled: false"
)) {
  if ($gates -notmatch [regex]::Escape($rule)) {
    throw "阶段一功能门禁缺少: $rule"
  }
}

$prototypeChecks = @{
  "docs\product\prototypes\admin-stage-one\platform-workbench\index.html" = @(
    "平台运营工作台",
    "调整观察范围",
    "临时授权",
    "审计事件已追加"
  )
  "docs\product\prototypes\admin-stage-one\operator-workbench\index.html" = @(
    "运营主体工作台",
    "主体上下文固定",
    "不能访问其他运营主体",
    "资金操作门禁关闭"
  )
  "docs\product\prototypes\admin-stage-one\operator-directory\index.html" = @(
    "运营主体",
    "只读名录",
    "阶段一不提供创建",
    "查看摘要"
  )
}

foreach ($entry in $prototypeChecks.GetEnumerator()) {
  $content = Get-Content -LiteralPath (Join-Path $repo $entry.Key) -Raw
  foreach ($term in $entry.Value) {
    if ($content -notmatch [regex]::Escape($term)) {
      throw "阶段一高保真原型 $($entry.Key) 缺少: $term"
    }
  }
}

Write-Host "运营控制台阶段一实施前设计检查通过。"
Write-Host "多组织验收场景: $scenarioCount"
Write-Host "高保真页面: 3"
