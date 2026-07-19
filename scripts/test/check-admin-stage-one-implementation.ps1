$ErrorActionPreference = "Stop"

$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$required = @(
  "packages\contracts\src\admin-access.ts",
  "apps\server\src\application\admin-access-service.ts",
  "apps\server\src\application\admin-access-service.test.ts",
  "apps\server\src\http\admin-access-routes.ts",
  "apps\server\src\http\admin-access-routes.test.ts",
  "apps\admin\src\infrastructure\http-admin-access-client.ts",
  "apps\admin\src\features\admin-stage-one\stage-one-shell.tsx",
  "apps\admin\src\features\admin-stage-one\stage-one-shell.css",
  "apps\admin\src\features\admin-stage-one\stage-one-shell.test.tsx"
)

foreach ($path in $required) {
  if (-not (Test-Path -LiteralPath (Join-Path $repo $path))) {
    throw "缺少运营控制台阶段一实现文件: $path"
  }
}

$gates = Get-Content -LiteralPath (Join-Path $repo "packages\contracts\src\feature-gates.ts") -Raw
foreach ($rule in @(
  "syntheticAdminMultiOrganization: false",
  "gates.syntheticAdminMultiOrganization && gates.internalSandbox"
)) {
  if ($gates -notmatch [regex]::Escape($rule)) { throw "阶段一实现门禁缺少: $rule" }
}

$service = Get-Content -LiteralPath (Join-Path $repo "apps\server\src\application\admin-access-service.ts") -Raw
foreach ($rule in @(
  "FEATURE_DISABLED",
  "ADMIN_ORGANIZATION_CONTEXT_FIXED",
  "AUTHORIZATION_DENIED",
  "contextSwitchResults",
  "organization_context_changed",
  "access_allowed",
  "access_denied",
  "sensitiveFieldsMasked: true",
  "lifecycleActionsAllowed: false",
  "crossOperatorAccessAllowed: false",
  "financeReadOnly: true"
)) {
  if ($service -notmatch [regex]::Escape($rule)) { throw "阶段一授权服务缺少: $rule" }
}

$routes = Get-Content -LiteralPath (Join-Path $repo "apps\server\src\http\admin-access-routes.ts") -Raw
foreach ($rule in @(
  "/v1/internal-sandbox/admin/access",
  "/session",
  "/context",
  "/platform-workbench",
  "/operator-workbench",
  "/operators",
  "/audit",
  "Idempotency-Key",
  "X-Request-Id",
  "Cache-Control"
)) {
  if ($routes -notmatch [regex]::Escape($rule)) { throw "阶段一 HTTP 路由缺少: $rule" }
}

$client = Get-Content -LiteralPath (Join-Path $repo "apps\admin\src\infrastructure\http-admin-access-client.ts") -Raw
foreach ($rule in @(
  "Sandbox ${this.identity}",
  "Idempotency-Key",
  "UNKNOWN_RESULT",
  "SERVICE_UNAVAILABLE",
  "/v1/internal-sandbox/admin/access"
)) {
  if ($client -notmatch [regex]::Escape($rule)) { throw "阶段一 Admin HTTP 客户端缺少: $rule" }
}

$shell = (
  Get-Content -LiteralPath (Join-Path $repo "apps\admin\src\app\shell.tsx") -Raw
) + (
  Get-Content -LiteralPath (Join-Path $repo "apps\admin\src\features\admin-stage-one\stage-one-shell.tsx") -Raw
)
foreach ($rule in @(
  "VITE_SYNTHETIC_ADMIN_MULTI_ORGANIZATION",
  "平台运营工作台",
  "运营主体工作台",
  "运营主体名录",
  "主体上下文固定",
  "资金操作门禁关闭",
  "访问与范围事件"
)) {
  if ($shell -notmatch [regex]::Escape($rule)) { throw "阶段一 Admin Shell 缺少: $rule" }
}

$serverTests = Get-Content -LiteralPath (Join-Path $repo "apps\server\src\http\admin-access-routes.test.ts") -Raw
$adminTests = Get-Content -LiteralPath (Join-Path $repo "apps\admin\src\features\admin-stage-one\stage-one-shell.test.tsx") -Raw
foreach ($rule in @(
  "默认门禁关闭时拒绝阶段一 API",
  "平台用户切换获批观察范围并读取只读名录",
  "运营主体用户不能切换主体或访问平台名录且拒绝结果可审计"
)) {
  if ($serverTests -notmatch [regex]::Escape($rule)) { throw "阶段一 Server 测试缺少: $rule" }
}
foreach ($rule in @(
  "平台用户切换观察范围但功能角色保持不变",
  "平台名录只显示脱敏摘要且没有生命周期操作",
  "运营主体工作台固定主体并展示服务端拒绝",
  "审计页面展示允许与拒绝事件且不显示敏感原文"
)) {
  if ($adminTests -notmatch [regex]::Escape($rule)) { throw "阶段一 Admin 测试缺少: $rule" }
}

Write-Host "运营控制台阶段一多组织后台底座实施检查通过。"
Write-Host "阶段一 API: 6"
Write-Host "阶段一页面: 3"
