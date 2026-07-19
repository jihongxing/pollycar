$ErrorActionPreference = "Stop"

$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$required = @(
  "apps\server\src\http\internal-sandbox-server.ts",
  "apps\server\src\http\admin-review-routes.ts",
  "apps\server\src\http\vehicle-review-routes.ts",
  "apps\server\src\http\free-flex-trial-routes.ts",
  "apps\server\src\http\synthetic-trip-routes.ts",
  "apps\server\src\http\safety-case-routes.ts",
  "apps\server\src\http\error-mapper.ts",
  "apps\server\src\http\request-context.ts",
  "apps\server\src\http\internal-sandbox-server.test.ts",
  "apps\admin\src\infrastructure\http-admin-review-client.ts",
  "apps\admin\src\infrastructure\http-admin-review-client.test.ts",
  "apps\app\src\infrastructure\http-vehicle-review-client.ts",
  "apps\app\src\infrastructure\http-vehicle-review-client.test.ts",
  "apps\app\src\infrastructure\http-free-flex-trial-client.ts",
  "apps\app\src\infrastructure\http-free-flex-trial-client.test.ts",
  "apps\app\src\infrastructure\http-synthetic-trip-client.ts",
  "apps\app\src\infrastructure\http-synthetic-trip-client.test.ts",
  "apps\app\src\infrastructure\http-safety-case-client.ts",
  "apps\app\src\infrastructure\http-safety-case-client.test.ts",
  "docs\implementation\0006-运营后台Server沙箱API集成.md"
)
foreach ($path in $required) {
  if (-not (Test-Path -LiteralPath (Join-Path $repo $path))) {
    throw "缺少运营后台沙箱 API 文件: $path"
  }
}

$server = (
  Get-Content -LiteralPath (Join-Path $repo "apps\server\src\http\internal-sandbox-server.ts") -Raw
) + (
  Get-Content -LiteralPath (Join-Path $repo "apps\server\src\config.ts") -Raw
)
foreach ($rule in @(
  "127.0.0.1",
  "/v1/internal-sandbox/health",
  "createRequestContext",
  "Cache-Control",
  "no-store"
)) {
  if ($server -notmatch [regex]::Escape($rule)) { throw "沙箱 HTTP Server 缺少规则: $rule" }
}
if ($server -match [regex]::Escape("0.0.0.0")) { throw "沙箱 HTTP Server 不得监听全部网络接口" }

$routes = (
  Get-Content -LiteralPath (Join-Path $repo "apps\server\src\http\admin-review-routes.ts") -Raw
) + (
  Get-Content -LiteralPath (Join-Path $repo "apps\server\src\http\vehicle-review-routes.ts") -Raw
) + (
  Get-Content -LiteralPath (Join-Path $repo "apps\server\src\http\free-flex-trial-routes.ts") -Raw
) + (
  Get-Content -LiteralPath (Join-Path $repo "apps\server\src\http\synthetic-trip-routes.ts") -Raw
) + (
  Get-Content -LiteralPath (Join-Path $repo "apps\server\src\http\safety-case-routes.ts") -Raw
) + (
  Get-Content -LiteralPath (Join-Path $repo "apps\server\src\http\error-mapper.ts") -Raw
)
foreach ($rule in @(
  "/v1/internal-sandbox/admin/review-tasks",
  "/v1/internal-sandbox/app/vehicle-reviews/",
  "/v1/internal-sandbox/app/free-flex-trial",
  "/v1/internal-sandbox/app/synthetic-trips",
  "messages|reports",
  "safety-cases",
  "resolution",
  "Idempotency-Key",
  "ADMIN_TASK_ALREADY_CLAIMED",
  "material-request-preview",
  "idempotency-results",
  "Access-Control-Allow-Origin"
)) {
  if ($routes -notmatch [regex]::Escape($rule)) { throw "沙箱审核路由缺少规则: $rule" }
}
foreach ($forbidden in @("/approve", "/reject", "/escalate", "/reconsider")) {
  if ($routes -match [regex]::Escape($forbidden)) { throw "沙箱审核路由出现禁止操作: $forbidden" }
}

$client = Get-Content -LiteralPath (Join-Path $repo "apps\admin\src\infrastructure\http-admin-review-client.ts") -Raw
foreach ($rule in @(
  "Sandbox synthetic-reviewer-001",
  "UNKNOWN_RESULT",
  "SERVICE_UNAVAILABLE",
  "recoverResult"
)) {
  if ($client -notmatch [regex]::Escape($rule)) { throw "后台 HTTP 客户端缺少规则: $rule" }
}

$appClient = Get-Content -LiteralPath (Join-Path $repo "apps\app\src\infrastructure\http-vehicle-review-client.ts") -Raw
foreach ($rule in @(
  "authorizationHeader",
  "/v1/internal-sandbox/app/vehicle-reviews/",
  "UNKNOWN_RESULT",
  "SERVICE_UNAVAILABLE"
)) {
  if ($appClient -notmatch [regex]::Escape($rule)) { throw "App 车辆审核 HTTP 客户端缺少规则: $rule" }
}

$trialClient = Get-Content -LiteralPath (Join-Path $repo "apps\app\src\infrastructure\http-free-flex-trial-client.ts") -Raw
foreach ($rule in @(
  "authorizationHeader",
  "/v1/internal-sandbox/app/free-flex-trial",
  "UNKNOWN_RESULT",
  "SERVICE_UNAVAILABLE"
)) {
  if ($trialClient -notmatch [regex]::Escape($rule)) { throw "App 免费资格 HTTP 客户端缺少规则: $rule" }
}

$tripClient = Get-Content -LiteralPath (Join-Path $repo "apps\app\src\infrastructure\http-synthetic-trip-client.ts") -Raw
foreach ($rule in @(
  "authorizationHeader",
  "/v1/internal-sandbox/app/synthetic-trips",
  "UNKNOWN_RESULT",
  "SERVICE_UNAVAILABLE"
)) {
  if ($tripClient -notmatch [regex]::Escape($rule)) { throw "App 合成行程 HTTP 客户端缺少规则: $rule" }
}

$safetyClient = Get-Content -LiteralPath (Join-Path $repo "apps\app\src\infrastructure\http-safety-case-client.ts") -Raw
foreach ($rule in @(
  "authorizationHeader",
  "/safety/messages",
  "/safety/reports",
  "/appeal",
  "UNKNOWN_RESULT",
  "SERVICE_UNAVAILABLE"
)) {
  if ($safetyClient -notmatch [regex]::Escape($rule)) { throw "App 安全案件 HTTP 客户端缺少规则: $rule" }
}

$openapi = Get-Content -LiteralPath (Join-Path $repo "spec\api\openapi.yaml") -Raw
$operations = @(
  "listAdminReviewTasks",
  "getAdminReviewTask",
  "claimAdminReviewTask",
  "renewAdminReviewTaskLease",
  "releaseAdminReviewTask",
  "previewAdminMaterialRequest",
  "requestAdminVehicleMaterial",
  "approveAdminVehicleReview",
  "rejectAdminVehicleReview",
  "listAdminReviewTaskAudit",
  "getAdminIdempotencyResult",
  "getInternalSandboxHealth"
  "getAppVehicleReview"
  "saveAppVehicleReviewDraft"
  "submitAppVehicleReview"
  "resubmitAppVehicleReviewMaterial"
  "getAppFreeFlexTrial"
  "submitAppFreeFlexTrial"
  "approveAdminFreeFlexTrial"
  "confirmAppFreeFlexTrial"
  "getAppSyntheticTripDashboard"
  "createAppSyntheticTrip"
  "payAppSyntheticTrip"
  "acceptAppSyntheticTrip"
  "startAppSyntheticTrip"
  "completeAppSyntheticTrip"
  "getAppTripSafetyDashboard"
  "sendAppSyntheticChatMessage"
  "reportAppSyntheticTrip"
  "appealAppSafetyCase"
  "resolveSafetyCaseAppeal"
)
foreach ($operation in $operations) {
  if ($openapi -notmatch [regex]::Escape("operationId: $operation")) {
    throw "OpenAPI 缺少沙箱操作: $operation"
  }
}

$implementation = Get-Content -LiteralPath (Join-Path $repo "docs\implementation\0006-运营后台Server沙箱API集成.md") -Raw
if ($implementation -notmatch [regex]::Escape('`已完成`')) {
  throw "实施包 0006 未处于已完成状态"
}

Write-Host "运营后台 Server 沙箱 API 实施检查通过。"
Write-Host "沙箱 API 操作: $($operations.Count)"
