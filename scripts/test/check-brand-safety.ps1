$ErrorActionPreference = "Stop"

$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$productRoots = @(
  (Join-Path $repo "apps\app\src\features"),
  (Join-Path $repo "apps\app\src\components"),
  (Join-Path $repo "apps\app\src\navigation")
)

$files = Get-ChildItem -LiteralPath $productRoots -Recurse -File |
  Where-Object {
    $_.Extension -in @(".ts", ".tsx") -and
    $_.Name -notmatch "\.test\." -and
    $_.Name -notmatch "\.d\.ts$"
  }

$forbiddenPatterns = [ordered]@{
  "关系型产品定位" = "认识人的地方|认识新朋友|结识|邂逅|缘分|交友|社交平台|异性交友"
  "财富或身份等级卖点" = "精英出行|豪车接送|豪车车主专享|高端人群|身份象征"
  "关系结果承诺" = "匹配对象|心动|成功率|脱单|约会"
}

$violations = @()
foreach ($file in $files) {
  $content = Get-Content -LiteralPath $file.FullName -Raw
  foreach ($entry in $forbiddenPatterns.GetEnumerator()) {
    if ($content -match $entry.Value) {
      $violations += "$($entry.Key): $($file.FullName)"
    }
  }
}

if ($violations.Count -gt 0) {
  throw "品牌安全检查失败：`n$($violations -join "`n")"
}

$adultEligibility = Get-Content -LiteralPath (
  Join-Path $repo "apps\app\src\features\adult-eligibility\adult-eligibility-screens.tsx"
) -Raw
if ($adultEligibility -match "叫车、聊天|聊天和车主") {
  throw "成年资格页面不得把聊天作为一级产品能力宣传。"
}

$tripContact = Get-Content -LiteralPath (
  Join-Path $repo "apps\app\src\features\chat\trip-chat-screen.tsx"
) -Raw
foreach ($required in @("行程联系", "仅用于上车、到达和行程异常沟通", "开放 72 小时")) {
  if ($tripContact -notmatch [regex]::Escape($required)) {
    throw "行程联系页面缺少必要的出行用途边界: $required"
  }
}
if ($tripContact -match 'title=\{`与') {
  throw "行程联系页面不得以对方身份作为关系导向标题。"
}

$mapSurface = Get-Content -LiteralPath (
  Join-Path $repo "apps\app\src\components\mobility\map-surface.tsx"
) -Raw
if ($mapSurface -match "SandboxIndicator") {
  throw "地图首屏不得重复展示沙箱标识；全局顶栏已提供环境说明。"
}

$recoveryBanner = Get-Content -LiteralPath (
  Join-Path $repo "apps\app\src\application\app-recovery-banner.tsx"
) -Raw
if ($recoveryBanner -notmatch 'snapshot\.trigger !== "manual"') {
  throw "启动阶段同步失败不得覆盖普通用户业务首屏。"
}

$displayPolicy = Get-Content -LiteralPath (
  Join-Path $repo "apps\app\src\brand\display-environment.ts"
) -Raw
foreach ($environment in @('"sandbox"', '"demo"', '"production"')) {
  if ($displayPolicy -notmatch [regex]::Escape($environment)) {
    throw "品牌展示策略缺少环境: $environment"
  }
}
foreach ($disclosure in @("费用", "支付", "安全", "责任", "身份", "隐私", "删除", "审核", "资格", "配额")) {
  if ($displayPolicy -notmatch [regex]::Escape($disclosure)) {
    throw "生产展示过滤未保护必要披露类别: $disclosure"
  }
}

$appPackage = Get-Content -LiteralPath (Join-Path $repo "apps\app\package.json") -Raw |
  ConvertFrom-Json
foreach ($script in @("build:sandbox", "build:demo", "build:production", "check:production-brand")) {
  if (-not $appPackage.scripts.PSObject.Properties.Name.Contains($script)) {
    throw "App 缺少品牌环境构建脚本: $script"
  }
}
foreach ($scriptPath in @(
  "apps\app\scripts\build-brand-environment.mjs",
  "apps\app\scripts\check-production-brand-output.mjs"
)) {
  if (-not (Test-Path -LiteralPath (Join-Path $repo $scriptPath))) {
    throw "缺少品牌环境构建文件: $scriptPath"
  }
}

Write-Host "品牌安全检查通过：页面定位保持为出行工具，联系能力限定于行程与安全。"
