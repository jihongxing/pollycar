$ErrorActionPreference = "Stop"

$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$runtimeListPath = Join-Path $repo "packages\configuration\src\deprecated-environment.js"
$contractPath = Join-Path $repo "packages\contracts\src\configuration-governance.ts"
$appBuildPath = Join-Path $repo "apps\app\scripts\build-brand-environment.mjs"
$playwrightPath = Join-Path $repo "playwright.config.ts"
$productionRuntimePath = Join-Path $repo "spec\platform\production-runtime.yaml"

foreach ($path in @(
  $runtimeListPath,
  $contractPath,
  $appBuildPath,
  $playwrightPath,
  $productionRuntimePath
)) {
  if (-not (Test-Path -LiteralPath $path)) {
    throw "批次七缺少文件: $path"
  }
}

Push-Location $repo
try {
  $deprecatedNamesJson = node --input-type=module -e "import { DEPRECATED_CONFIGURATION_ENVIRONMENT_NAMES } from './packages/configuration/src/deprecated-environment.js'; console.log(JSON.stringify(DEPRECATED_CONFIGURATION_ENVIRONMENT_NAMES));"
  if ($LASTEXITCODE -ne 0) {
    throw "无法读取批次七废弃配置清单"
  }
} finally {
  Pop-Location
}
$deprecatedNames = $deprecatedNamesJson | ConvertFrom-Json
$contract = Get-Content -LiteralPath $contractPath -Raw
$contractDeprecatedNames = [regex]::Matches(
  $contract,
  '"((?:POLLYCAR|EXPO_PUBLIC_POLLYCAR|EXPO_PUBLIC_BRAND|VITE_POLLYCAR|VITE_ADMIN)_[A-Z0-9_]+)"'
) | ForEach-Object { $_.Groups[1].Value }
$syntheticAdminSuffixes = [regex]::Matches(
  $contract,
  '(?m)^\s+"([A-Z_]+)",?$'
) | ForEach-Object { $_.Groups[1].Value }
foreach ($suffix in $syntheticAdminSuffixes) {
  $contractDeprecatedNames += "POLLYCAR_SYNTHETIC_ADMIN_$suffix"
  $contractDeprecatedNames += "VITE_SYNTHETIC_ADMIN_$suffix"
}
$contractDeprecatedNames = $contractDeprecatedNames | Sort-Object -Unique
$missingFromContract = $deprecatedNames |
  Where-Object { $contractDeprecatedNames -notcontains $_ }
if ($missingFromContract.Count -gt 0) {
  throw "配置治理契约缺少废弃变量: $($missingFromContract -join ', ')"
}

$scanRoots = @(
  (Join-Path $repo "apps"),
  (Join-Path $repo "infrastructure"),
  (Join-Path $repo "scripts\build"),
  (Join-Path $repo "scripts\dev"),
  (Join-Path $repo "scripts\infra"),
  (Join-Path $repo ".github"),
  (Join-Path $repo ".env.example"),
  (Join-Path $repo "DESIGN.md"),
  $playwrightPath,
  $productionRuntimePath
)
foreach ($name in $deprecatedNames) {
  $matches = & rg `
    -n `
    --fixed-strings `
    --glob "!**/*.test.*" `
    --glob "!**/*.spec.*" `
    $name `
    $scanRoots
  if ($LASTEXITCODE -gt 1) {
    throw "无法扫描废弃配置入口: $name"
  }
  if ($matches) {
    throw "运行入口仍包含废弃配置变量 $name`: $($matches -join '; ')"
  }
}

$appBuild = Get-Content -LiteralPath $appBuildPath -Raw
foreach ($required in @(
  "getLocalSandboxProfile(environment)",
  "EXPO_PUBLIC_POLLYCAR_PUBLIC_CONFIG"
)) {
  if ($appBuild -notmatch [regex]::Escape($required)) {
    throw "App 构建缺少批次七统一入口: $required"
  }
}

$playwright = Get-Content -LiteralPath $playwrightPath -Raw
if ($playwright -notmatch [regex]::Escape("getLocalSandboxProfile(process.env)")) {
  throw "Playwright 未直接使用本地沙箱统一端口入口"
}

$productionRuntime = Get-Content -LiteralPath $productionRuntimePath -Raw
if ($productionRuntime -notmatch [regex]::Escape('database_url_environment_name: "POLLYCAR_DATABASE_URL"')) {
  throw "生产运行契约未统一为 POLLYCAR_DATABASE_URL"
}

Write-Host "批次七旧配置入口删除与废弃变量失败关闭检查通过。"
