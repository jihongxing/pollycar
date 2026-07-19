$ErrorActionPreference = "Stop"

$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$required = @(
  "AGENTS.md",
  "ROADMAP.md",
  "DESIGN.md",
  "PRODUCT_LANGUAGE.md",
  "docs\README.md",
  "docs\decisions\README.md",
  "spec\README.md",
  "spec\platform\feature-gates.yaml"
)

$missing = @()
foreach ($path in $required) {
  if (-not (Test-Path -LiteralPath (Join-Path $repo $path))) {
    $missing += $path
  }
}
if ($missing.Count -gt 0) {
  throw "缺少轻量治理必需文件: $($missing -join ', ')"
}

$agents = Get-Content -LiteralPath (Join-Path $repo "AGENTS.md") -Raw
$design = Get-Content -LiteralPath (Join-Path $repo "DESIGN.md") -Raw
$productLanguage = Get-Content -LiteralPath (Join-Path $repo "PRODUCT_LANGUAGE.md") -Raw
$docsIndex = Get-Content -LiteralPath (Join-Path $repo "docs\README.md") -Raw

foreach ($rule in @(
  "用户界面产品化硬约束",
  "用户界面完成门禁",
  "PRODUCT_LANGUAGE.md"
)) {
  if ($agents -notmatch [regex]::Escape($rule)) {
    throw "AGENTS.md 缺少用户界面产品化规则: $rule"
  }
}

foreach ($rule in @(
  "最终态产品体验",
  "截图与文案收敛验收",
  "PRODUCT_LANGUAGE.md"
)) {
  if ($design -notmatch [regex]::Escape($rule)) {
    throw "DESIGN.md 缺少产品化体验规则: $rule"
  }
}

foreach ($rule in @(
  "最终态定义",
  "内部状态转换规则",
  "截图与文案验收",
  "文案删除审查"
)) {
  if ($productLanguage -notmatch [regex]::Escape($rule)) {
    throw "PRODUCT_LANGUAGE.md 缺少产品语言规则: $rule"
  }
}

if ($docsIndex -notmatch [regex]::Escape("../PRODUCT_LANGUAGE.md")) {
  throw "docs/README.md 未索引 PRODUCT_LANGUAGE.md"
}

$featureGates = Get-Content -LiteralPath (Join-Path $repo "spec\platform\feature-gates.yaml") -Raw
foreach ($rule in @(
  "production_enabled: false",
  "real_payment: false",
  "paid_flex_trial: false",
  "real_user_invitation: false",
  "shanghai_pilot: false",
  "real_data_ingestion: false"
)) {
  if ($featureGates -notmatch [regex]::Escape($rule)) {
    throw "功能门禁缺少默认关闭规则: $rule"
  }
}

$decisionDir = Join-Path $repo "docs\decisions"
$decisionIndex = Get-Content -LiteralPath (Join-Path $decisionDir "README.md") -Raw
$unindexedDecisions = @()
Get-ChildItem -LiteralPath $decisionDir -File -Filter "*.md" |
  Where-Object { $_.Name -ne "README.md" } |
  ForEach-Object {
    if ($decisionIndex -notmatch [regex]::Escape($_.Name)) {
      $unindexedDecisions += $_.Name
    }
  }
if ($unindexedDecisions.Count -gt 0) {
  throw "docs/decisions/README.md 未索引: $($unindexedDecisions -join ', ')"
}

$markdownFiles = @(
  Get-Item -LiteralPath (Join-Path $repo "AGENTS.md")
  Get-Item -LiteralPath (Join-Path $repo "ROADMAP.md")
  Get-Item -LiteralPath (Join-Path $repo "README.md")
  Get-Item -LiteralPath (Join-Path $repo "DESIGN.md")
  Get-Item -LiteralPath (Join-Path $repo "PRODUCT_LANGUAGE.md")
  Get-Item -LiteralPath (Join-Path $repo "spec\README.md")
  Get-ChildItem -LiteralPath (Join-Path $repo "docs") -Recurse -File -Filter "*.md"
)
$allowedAsciiHeadings = @("AGENTS.md", "PollyCar", "API 契约说明", "AI 工程治理", "MVP 核心验收场景")
$nonChineseHeadings = @()
foreach ($file in $markdownFiles) {
  Get-Content -LiteralPath $file.FullName | ForEach-Object {
    if ($_ -match '^\s*#{1,6}\s+(.+?)\s*$' -and $matches[1] -notmatch '[\p{IsCJKUnifiedIdeographs}]' -and $allowedAsciiHeadings -notcontains $matches[1]) {
      $relative = $file.FullName.Substring($repo.Path.Length).TrimStart('\','/')
      $nonChineseHeadings += "$relative`: $($matches[1])"
    }
  }
}
if ($nonChineseHeadings.Count -gt 0) {
  throw "发现不符合中文文档约束的标题: $($nonChineseHeadings -join '; ')"
}

Write-Host "轻量文档治理检查通过。"
Write-Host "已索引高风险决策: $((Get-ChildItem -LiteralPath $decisionDir -File -Filter '*.md' | Where-Object { $_.Name -ne 'README.md' } | Measure-Object).Count)"
Write-Host "默认关闭功能门禁检查通过。"
