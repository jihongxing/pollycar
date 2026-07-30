$ErrorActionPreference = "Stop"

$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$required = @(
  "packages\contracts\src\admin-operator-management.ts",
  "apps\server\src\application\admin-operator-management-service.ts",
  "apps\server\src\application\admin-operator-management-service.test.ts",
  "apps\server\src\http\admin-operator-management-routes.ts",
  "apps\server\src\http\admin-operator-management-routes.test.ts",
  "apps\admin\src\features\admin-stage-two\stage-two-workspace.tsx",
  "apps\admin\src\features\admin-stage-two\stage-two-workspace.test.tsx",
  "spec\api\openapi.yaml",
  "spec\api\operation-policies.yaml"
)

foreach ($path in $required) {
  if (-not (Test-Path -LiteralPath (Join-Path $repo $path))) {
    throw "缺少运营控制台阶段二实现文件: $path"
  }
}

$gates = Get-Content -LiteralPath (Join-Path $repo "packages\contracts\src\feature-gates.ts") -Raw
foreach ($rule in @(
  "syntheticAdminOperatorManagement: false",
  "gates.syntheticAdminOperatorManagement &&",
  "gates.syntheticAdminMultiOrganization"
)) {
  if ($gates -notmatch [regex]::Escape($rule)) { throw "阶段二实现门禁缺少: $rule" }
}

$service = Get-Content -LiteralPath (Join-Path $repo "apps\server\src\application\admin-operator-management-service.ts") -Raw
foreach ($rule in @(
  "AdminOperatorManagementService",
  "PrimaryOperatorRelationshipGateway",
  "pollycar_finance.driver_operator_memberships",
  "resourceVersion",
  "idempotency",
  "ADMIN_OPERATOR_INVALID_TRANSITION",
  "ADMIN_OPERATOR_MIGRATION_BLOCKED",
  "recordOperatorManagementEvent"
)) {
  if ($service -notmatch [regex]::Escape($rule)) { throw "阶段二应用服务缺少: $rule" }
}

$routes = Get-Content -LiteralPath (Join-Path $repo "apps\server\src\http\admin-operator-management-routes.ts") -Raw
foreach ($rule in @(
  "/v1/internal-sandbox/admin/operator-management",
  "operators|onboarding-cases|drivers|vehicles|migrations",
  "/commands",
  "Idempotency-Key",
  "X-Request-Id",
  "Cache-Control"
)) {
  if ($routes -notmatch [regex]::Escape($rule)) { throw "阶段二 HTTP 路由缺少: $rule" }
}

$admin = (
  Get-Content -LiteralPath (Join-Path $repo "apps\admin\src\app\shell.tsx") -Raw
) + (
  Get-Content -LiteralPath (Join-Path $repo "apps\admin\src\features\admin-stage-two\stage-two-workspace.tsx") -Raw
)
foreach ($rule in @(
  "resolveAdminPublicCapabilities",
  "operatorManagementEnabled",
  "运营主体 360°",
  "运营主体入驻案件",
  "车主 360°",
  "车辆 360°",
  "主运营关系迁移",
  "生产启用关闭",
  "发送双方确认"
)) {
  if ($admin -notmatch [regex]::Escape($rule)) { throw "阶段二 Admin 工作区缺少: $rule" }
}

$publicCapabilities = Get-Content -LiteralPath (
  Join-Path $repo "apps\admin\src\infrastructure\admin-public-capabilities.ts"
) -Raw
$localProfile = Get-Content -LiteralPath (
  Join-Path $repo "packages\configuration\src\index.js"
) -Raw
foreach ($rule in @(
  "config.capabilities.operatorManagement",
  "VITE_POLLYCAR_PUBLIC_CONFIG",
  "syntheticAdminOperatorManagement"
)) {
  if (
    $publicCapabilities -notmatch [regex]::Escape($rule) -and
    $localProfile -notmatch [regex]::Escape($rule)
  ) {
    throw "阶段二统一配置链路缺少: $rule"
  }
}

$openApi = Get-Content -LiteralPath (Join-Path $repo "spec\api\openapi.yaml") -Raw
$operationCount = [regex]::Matches($openApi, '(?m)^\s{6}operationId:\s+(getAdminOperator360|getAdminOperatorOnboardingCase|getAdminDriver360|getAdminVehicle360|getAdminPrimaryOperatorMigration|executeAdminOperatorManagementCommand)\s*$').Count
if ($operationCount -ne 6) {
  throw "阶段二 OpenAPI 操作数应为 6，实际为 $operationCount"
}

$serverTests = Get-Content -LiteralPath (Join-Path $repo "apps\server\src\application\admin-operator-management-service.test.ts") -Raw
$httpTests = Get-Content -LiteralPath (Join-Path $repo "apps\server\src\http\admin-operator-management-routes.test.ts") -Raw
$adminTests = Get-Content -LiteralPath (Join-Path $repo "apps\admin\src\features\admin-stage-two\stage-two-workspace.test.tsx") -Raw
foreach ($rule in @(
  "默认关闭阶段二门禁",
  "运营主体只能查看本主体及其关联车主车辆",
  "迁移被进行中行程阻断",
  "重复幂等键返回原结果"
)) {
  if ($serverTests -notmatch [regex]::Escape($rule)) { throw "阶段二领域测试缺少: $rule" }
}
foreach ($rule in @(
  "只有阶段一和阶段二门禁同时开启时提供查询",
  "统一命令入口强制幂等键并返回原结果"
)) {
  if ($httpTests -notmatch [regex]::Escape($rule)) { throw "阶段二 HTTP 测试缺少: $rule" }
}
foreach ($rule in @(
  "平台请求补充材料后刷新入驻案件状态",
  "运营主体人员不显示平台入驻写入口",
  "迁移存在阻断项时双方确认保持禁用"
)) {
  if ($adminTests -notmatch [regex]::Escape($rule)) { throw "阶段二 Admin 测试缺少: $rule" }
}

Write-Host "运营控制台阶段二组织与运力合成内核实施检查通过。"
Write-Host "阶段二 API: 6"
Write-Host "阶段二聚合页面: 5"
