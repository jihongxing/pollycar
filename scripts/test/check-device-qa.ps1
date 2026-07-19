$ErrorActionPreference = "Stop"

$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$required = @(
  "qa\device-matrix.json",
  "qa\device-acceptance-plan.json",
  "qa\virtual-acceptance-plan.json",
  "qa\maestro\app-core.yaml",
  "qa\maestro\vehicle-form.yaml",
  "qa\maestro\offline-recovery.yaml",
  "scripts\test\run-device-qa.ps1",
  "scripts\test\record-device-qa.ps1",
  "scripts\test\summarize-device-qa.ps1",
  "scripts\test\run-browser-mobile-acceptance.mjs",
  "scripts\test\run-android-emulator-web-acceptance.mjs",
  "packages\contracts\src\device-qa.ts"
)
foreach ($path in $required) {
  if (-not (Test-Path -LiteralPath (Join-Path $repo $path))) {
    throw "缺少真实设备 QA 文件: $path"
  }
}

$matrix = Get-Content -LiteralPath (Join-Path $repo "qa\device-matrix.json") -Raw | ConvertFrom-Json
if ($matrix.appId -ne "com.pollycar.internal.sandbox") {
  throw "真实设备 QA appId 不一致。"
}
if ($matrix.profiles.Count -lt 6) {
  throw "真实设备 QA 至少需要 Android 与 iOS 各三个配置。"
}
foreach ($platform in @("android", "ios")) {
  $profiles = @($matrix.profiles | Where-Object platform -eq $platform)
  foreach ($network in @("online", "slow", "offline")) {
    if (-not ($profiles | Where-Object network -eq $network)) {
      throw "$platform 缺少 $network 网络配置。"
    }
  }
  if (-not ($profiles | Where-Object fontScale -eq 2)) {
    throw "$platform 缺少最大字体配置。"
  }
}

$appJson = Get-Content -LiteralPath (Join-Path $repo "apps\app\app.json") -Raw
foreach ($rule in @(
  '"bundleIdentifier": "com.pollycar.internal.sandbox"',
  '"package": "com.pollycar.internal.sandbox"'
)) {
  if ($appJson -notmatch [regex]::Escape($rule)) {
    throw "Expo 设备配置缺少: $rule"
  }
}

$plan = Get-Content -LiteralPath (Join-Path $repo "qa\device-acceptance-plan.json") -Raw | ConvertFrom-Json
if ($plan.productionEnabled -ne $false -or $plan.syntheticOnly -ne $true) {
  throw "实体设备验收计划必须保持生产关闭且仅使用合成数据。"
}
if ($plan.requiredRuns.Count -lt 10) {
  throw "实体设备内部验收计划至少需要 10 个必跑组合。"
}
foreach ($journey in @("first_time_user", "passenger", "owner", "exception_recovery")) {
  if (-not ($plan.requiredRuns | Where-Object journey -eq $journey)) {
    throw "实体设备内部验收计划缺少旅程: $journey"
  }
}
foreach ($requiredRun in $plan.requiredRuns) {
  if (-not ($matrix.profiles | Where-Object profileId -eq $requiredRun.profileId)) {
    throw "验收计划引用未知设备配置: $($requiredRun.profileId)"
  }
}

$virtualPlan = Get-Content -LiteralPath (Join-Path $repo "qa\virtual-acceptance-plan.json") -Raw | ConvertFrom-Json
foreach ($environment in @("browser_mobile_viewport", "android_emulator_web", "android_emulator_native")) {
  if (-not ($virtualPlan.runs | Where-Object executionEnvironment -eq $environment)) {
    throw "虚拟设备验收计划缺少执行环境: $environment"
  }
}
if ($virtualPlan.productionEnabled -ne $false -or $virtualPlan.syntheticOnly -ne $true) {
  throw "虚拟设备验收计划必须保持生产关闭且仅使用合成数据。"
}

$recordScript = Get-Content -LiteralPath (Join-Path $repo "scripts\test\record-device-qa.ps1") -Raw
foreach ($rule in @("passed", "failed", "blocked", "IssueSeverity", "syntheticOnly", "output\device-qa\results")) {
  if ($recordScript -notmatch [regex]::Escape($rule)) {
    throw "设备验收结果记录缺少: $rule"
  }
}

Write-Host "Android 与 iOS 真实设备 QA 基础检查通过。"
Write-Host "设备配置: $($matrix.profiles.Count)"
Write-Host "内部验收必跑组合: $($plan.requiredRuns.Count)"
Write-Host "虚拟验收环境: $($virtualPlan.runs.Count)"
