$ErrorActionPreference = "Stop"

$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$required = @(
  "apps\admin\package.json",
  "apps\admin\src\app\shell.tsx",
  "apps\admin\src\infrastructure\synthetic-admin-review-client.ts",
  "packages\contracts\src\admin-review.ts",
  "apps\server\src\application\admin-review-task-service.ts",
  "apps\server\src\application\admin-review-task-service.test.ts",
  "apps\server\src\adapters\memory-review-task-repository.ts",
  "apps\server\src\ports\review-tasks.ts"
)
foreach ($path in $required) {
  if (-not (Test-Path -LiteralPath (Join-Path $repo $path))) {
    throw "缺少运营后台实施文件: $path"
  }
}

$contract = Get-Content -LiteralPath (Join-Path $repo "packages\contracts\src\admin-review.ts") -Raw
foreach ($name in @(
  "AdminReviewTaskSummary",
  "AdminReviewTaskDetail",
  "AdminReviewLease",
  "ClaimAdminReviewTaskCommand",
  "RequestVehicleMaterialAdminCommand",
  "AdminReviewClient"
)) {
  if ($contract -notmatch [regex]::Escape($name)) { throw "后台公开契约缺少: $name" }
}
foreach ($forbidden in @(
  "ApproveAdminReview",
  "RejectAdminReview",
  "EscalateAdminReview",
  "ReconsiderAdminReview",
  "identityDocument",
  "licensePlate",
  "safetyEvidence"
)) {
  if ($contract -match [regex]::Escape($forbidden)) { throw "后台公开契约包含禁止能力或字段: $forbidden" }
}

$service = Get-Content -LiteralPath (Join-Path $repo "apps\server\src\application\admin-review-task-service.ts") -Raw
foreach ($rule in @(
  "leaseMilliseconds = 30 * 60 * 1000",
  "renewWindowMilliseconds = 5 * 60 * 1000",
  "ADMIN_TASK_ALREADY_CLAIMED",
  "ADMIN_TASK_OWNERSHIP_LOST",
  "compareAndSet",
  "previewConfirmed"
)) {
  if ($service -notmatch [regex]::Escape($rule)) { throw "后台服务缺少关键规则: $rule" }
}

$adminFiles = Get-ChildItem -LiteralPath (Join-Path $repo "apps\admin\src") -Recurse -File
$adminText = ($adminFiles | ForEach-Object { Get-Content -LiteralPath $_.FullName -Raw }) -join "`n"
foreach ($rule in @("内部沙箱", "仅合成数据", "生产能力关闭", "严格受限原文与安全证据在本切片中不可访问")) {
  if ($adminText -notmatch [regex]::Escape($rule)) { throw "后台界面缺少安全边界文案: $rule" }
}
foreach ($forbidden in @("真实支付", "真实用户邀请", "批量认领", "自动批准")) {
  if ($adminText -match [regex]::Escape($forbidden)) { throw "后台实现出现禁止能力: $forbidden" }
}

$package = Get-Content -LiteralPath (Join-Path $repo "apps\admin\package.json") -Raw
foreach ($dependency in @('"react": "19.2.3"', '"vite": "7.3.6"', '"@pollycar/contracts": "workspace:*"')) {
  if ($package -notmatch [regex]::Escape($dependency)) { throw "后台 workspace 依赖缺少或未固定: $dependency" }
}

$implementation = Get-Content -LiteralPath (Join-Path $repo "docs\implementation\0005-运营后台首个合成审核切片.md") -Raw
if ($implementation -notmatch [regex]::Escape('`已完成`')) {
  throw "运营后台实施包未处于已完成状态"
}

Write-Host "运营后台首个合成审核切片实施检查通过。"
Write-Host "后台源码文件: $($adminFiles.Count)"
