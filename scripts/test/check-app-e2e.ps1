$ErrorActionPreference = "Stop"

$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$required = @(
  "playwright.config.ts",
  "tests\e2e\app-core-flow.spec.ts",
  "tests\e2e\app-accessibility.spec.ts",
  "tests\e2e\app-product-interactions.spec.ts",
  "tests\e2e\cross-module-flow.spec.ts",
  "tests\e2e\app-usability-acceptance.spec.ts",
  "packages\contracts\src\usability-acceptance.ts",
  "apps\app\src\infrastructure\api-base-url.ts",
  "apps\app\src\navigation\routes.ts",
  "apps\app\src\features\vehicle-review\vehicle-draft-storage.ts",
  "apps\app\src\features\vehicle-review\vehicle-form-model.ts",
  "apps\app\src\navigation\use-unsaved-changes-guard.ts",
  "apps\app\src\components\product-components.tsx"
)
$routeFiles = @(
  "passenger-workbench.tsx",
  "owner-apply-intro.tsx",
  "owner-profile.tsx",
  "vehicle-form.tsx",
  "submission-review.tsx",
  "review-pending.tsx",
  "review-needs-material.tsx",
  "review-approved.tsx",
  "owner-workbench.tsx",
  "account.tsx",
  "account-profile.tsx",
  "identity-settings.tsx",
  "vehicle-settings.tsx",
  "eligibility-settings.tsx",
  "quota-settings.tsx",
  "theme-settings.tsx",
  "privacy-safety-settings.tsx",
  "notifications.tsx",
  "trip-create.tsx",
  "trip-payment.tsx",
  "trip-matching.tsx",
  "trip-active.tsx",
  "trip-result.tsx",
  "trip-recovery.tsx",
  "driver-offers.tsx",
  "driver-trip.tsx",
  "safety-chat.tsx",
  "safety-report.tsx",
  "safety-frozen.tsx",
  "safety-appeal.tsx",
  "safety-result.tsx"
)
foreach ($routeFile in $routeFiles) {
  $required += "apps\app\app\$routeFile"
}
foreach ($path in $required) {
  if (-not (Test-Path -LiteralPath (Join-Path $repo $path))) {
    throw "缺少 App E2E 文件: $path"
  }
}

$config = Get-Content -LiteralPath (Join-Path $repo "playwright.config.ts") -Raw
foreach ($rule in @(
  "output/playwright",
  "127.0.0.1:4321",
  "127.0.0.1:8181",
  "127.0.0.1:4174",
  "workers: 1",
  'trace: "retain-on-failure"',
  "--single"
)) {
  if ($config -notmatch [regex]::Escape($rule)) { throw "Playwright 配置缺少: $rule" }
}

$core = Get-Content -LiteralPath (Join-Path $repo "tests\e2e\app-core-flow.spec.ts") -Raw
foreach ($rule in @(
  "默认入口进入叫车首页并可选择三人行程",
  "乘车人数（必选）",
  "身份切换面板保持单 App 双身份语义",
  "车主申请流程使用真实 URL 和浏览器返回",
  "车主首页突出自主接单、车辆容量和订单资金入口",
  "底部主导航连接身份首页和我的页面",
  "我的页面提供账户、身份、车辆、资格、配额、主题和隐私安全入口",
  "消息中心提供行程与车辆通知并保留沙箱边界",
  "申请和审核流程不显示底部主导航",
  "account-profile",
  "identity-settings",
  "vehicle-settings",
  "eligibility-settings",
  "quota-settings",
  "theme-settings",
  "privacy-safety-settings",
  "消息中心提供行程与车辆通知并保留沙箱边界",
  "默认入口进入叫车首页并可选择三人行程",
  "车主首页突出自主接单、车辆容量和订单资金入口"
)) {
  if ($core -notmatch [regex]::Escape($rule)) { throw "App 核心 E2E 缺少: $rule" }
}

$accessibility = Get-Content -LiteralPath (Join-Path $repo "tests\e2e\app-accessibility.spec.ts") -Raw
foreach ($rule in @(
  "@axe-core/playwright",
  "AxeBuilder",
  "toBeFocused",
  "底部主导航和我的页面具有可访问名称",
  "最大字体下核心页面不横向溢出且保持屏幕阅读器语义",
  "合成车辆类型",
  "保险有效期"
)) {
  if ($accessibility -notmatch [regex]::Escape($rule)) { throw "App 可访问性测试缺少: $rule" }
}

$crossModule = Get-Content -LiteralPath (Join-Path $repo "tests\e2e\cross-module-flow.spec.ts") -Raw
foreach ($rule in @(
  "openAuthenticatedPage",
  "identity-settings",
  "vehicle-settings",
  "eligibility-settings",
  "driver-orders",
  "privacy-safety-settings",
  "正式认证门禁"
)) {
  if ($crossModule -notmatch [regex]::Escape($rule)) { throw "跨模块 E2E 缺少: $rule" }
}
foreach ($forbidden in @(
  "Authorization: `"Sandbox",
  "synthetic-account-7",
  "synthetic-reviewer-001"
)) {
  if ($crossModule -match [regex]::Escape($forbidden)) { throw "跨模块 E2E 仍绕过手机号认证: $forbidden" }
}

$authenticationHelper = Get-Content -LiteralPath (Join-Path $repo "tests\e2e\helpers\authenticated-app.ts") -Raw
foreach ($rule in @(
  "loginThroughPhoneVerification",
  "使用验收号码",
  "获取验证码",
  "验证并登录",
  "completeAdultEligibility",
  "进入首页"
)) {
  if ($authenticationHelper -notmatch [regex]::Escape($rule)) { throw "浏览器认证助手缺少: $rule" }
}

$productInteractions = Get-Content -LiteralPath (Join-Path $repo "tests\e2e\app-product-interactions.spec.ts") -Raw
foreach ($rule in @(
  "确认提交车辆审核",
  "确认取消",
  "防止重复提交",
  "审核页面支持直接深链和刷新恢复",
  "流程进度",
  "车辆草稿刷新后恢复且浏览器返回保留输入",
  "车辆表单实时校验、格式化并保护未同步修改",
  "车辆草稿同步失败后保留输入和本地恢复能力",
  "App 重启后恢复身份和主题偏好",
  "离线提示在网络恢复后自动消失并同步",
  "内部会话过期时提供只读重连入口",
  "慢网下保持页面可读并最终同步最新状态"
)) {
  if ($productInteractions -notmatch [regex]::Escape($rule)) { throw "产品级交互 E2E 缺少: $rule" }
}

$usabilityAcceptance = Get-Content -LiteralPath (Join-Path $repo "tests\e2e\app-usability-acceptance.spec.ts") -Raw
foreach ($rule in @(
  "首次用户可直接叫车并找到消息与账户入口",
  "乘客可完成叫车、零金额前置、匹配并确认取消",
  "车主可切换身份并理解审核资格配额与接单边界",
  "异常情况下保持可读并提供安全恢复路径",
  "openAuthenticatedPage",
  "恢复后只读取最新状态，不自动重复提交"
)) {
  if ($usabilityAcceptance -notmatch [regex]::Escape($rule)) { throw "产品可用性验收 E2E 缺少: $rule" }
}

$usabilityContract = Get-Content -LiteralPath (Join-Path $repo "packages\contracts\src\usability-acceptance.ts") -Raw
foreach ($rule in @(
  "UsabilityJourney",
  "UsabilityAcceptanceCriterion",
  "UsabilityAcceptanceResult",
  "maximumPrimaryActions",
  "first_time_user",
  "passenger",
  "owner",
  "exception_recovery",
  "syntheticOnly: true"
)) {
  if ($usabilityContract -notmatch [regex]::Escape($rule)) { throw "产品可用性验收契约缺少: $rule" }
}

Write-Host "App E2E 与可访问性自动化实施检查通过。"
Write-Host "浏览器测试文件: 5"
