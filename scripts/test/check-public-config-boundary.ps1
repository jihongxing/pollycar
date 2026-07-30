param(
  [switch]$RequireBuildOutputs
)

$ErrorActionPreference = "Stop"

$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$required = @(
  "packages\configuration\src\public-config.js",
  "packages\configuration\src\public-config.test.js",
  "apps\admin\src\infrastructure\public-config.ts",
  "apps\app\src\infrastructure\public-config.ts",
  "apps\admin\scripts\build-admin-environment.mjs",
  "apps\app\scripts\build-brand-environment.mjs"
)
foreach ($path in $required) {
  if (-not (Test-Path -LiteralPath (Join-Path $repo $path))) {
    throw "公开配置边界缺少文件: $path"
  }
}

$runtimeReads = & rg `
  -n `
  --glob "*.ts" `
  --glob "*.tsx" `
  --glob "!**/*.test.ts" `
  --glob "!**/*.test.tsx" `
  "process\.env|import\.meta\.env" `
  (Join-Path $repo "apps\admin\src") `
  (Join-Path $repo "apps\app\src")
if ($LASTEXITCODE -gt 1) {
  throw "无法扫描 Admin/App 运行时环境读取"
}
$normalizedReads = @($runtimeReads) | ForEach-Object {
  $_.Replace((Resolve-Path $repo).Path + "\", "").Replace("/", "\")
}
$adminReads = @($normalizedReads) | Where-Object {
  $_ -match '^apps\\admin\\src\\infrastructure\\public-config\.ts:\d+:\s+serialized = import\.meta\.env\.VITE_POLLYCAR_PUBLIC_CONFIG,$'
}
$appReads = @($normalizedReads) | Where-Object {
  $_ -match '^apps\\app\\src\\infrastructure\\public-config\.ts:\d+:\s+serialized = process\.env\.EXPO_PUBLIC_POLLYCAR_PUBLIC_CONFIG,$'
}
if (
  $normalizedReads.Count -ne 2 -or
  $adminReads.Count -ne 1 -or
  $appReads.Count -ne 1
) {
  throw "Admin/App 必须各自且仅通过一个 PublicConfig 适配器读取环境: $($normalizedReads -join '; ')"
}

$forbiddenRuntimeNames = & rg `
  -n `
  --glob "*.ts" `
  --glob "*.tsx" `
  --glob "!**/*.test.ts" `
  --glob "!**/*.test.tsx" `
  "VITE_ADMIN_API_BASE_URL|VITE_SYNTHETIC_ADMIN_|EXPO_PUBLIC_POLLYCAR_API_BASE_URL|EXPO_PUBLIC_BRAND_|EXPO_PUBLIC_POLLYCAR_AMAP_" `
  (Join-Path $repo "apps\admin\src") `
  (Join-Path $repo "apps\app\src")
if ($LASTEXITCODE -gt 1) {
  throw "无法扫描前端旧公开配置名"
}
if ($forbiddenRuntimeNames) {
  throw "Admin/App 业务源码仍引用旧公开配置名: $($forbiddenRuntimeNames -join '; ')"
}

$configuration = Get-Content -LiteralPath (
  Join-Path $repo "packages\configuration\src\public-config.js"
) -Raw
foreach ($requiredRule in @(
  "createPublicConfigEnvironment",
  "!name.startsWith(`"VITE_`")",
  "!name.startsWith(`"EXPO_PUBLIC_`")",
  "VITE_POLLYCAR_PUBLIC_CONFIG",
  "EXPO_PUBLIC_POLLYCAR_PUBLIC_CONFIG"
)) {
  $sources = $configuration + (
    Get-Content -LiteralPath (
      Join-Path $repo "packages\configuration\src\index.d.ts"
    ) -Raw
  )
  if ($sources -notmatch [regex]::Escape($requiredRule)) {
    throw "公开配置生成器缺少失败关闭规则: $requiredRule"
  }
}

$outputDirectories = @(
  "apps\admin\dist",
  "apps\app\dist-sandbox"
)
if ($RequireBuildOutputs) {
  foreach ($directory in $outputDirectories) {
    if (-not (Test-Path -LiteralPath (Join-Path $repo $directory))) {
      throw "公开配置产物扫描缺少构建目录: $directory"
    }
  }
}

if ($RequireBuildOutputs) {
  $forbiddenArtifactPatterns = @(
    "POLLYCAR_DATABASE_URL",
    "POLLYCAR_SECRET_PROVIDER_REFERENCE",
    "POLLYCAR_AUTH_ADMIN_OIDC_CLIENT_SECRET_REFERENCE",
    "POLLYCAR_AMAP_APPROVAL_REFERENCE",
    "EXPO_PUBLIC_POLLYCAR_AMAP_APPROVAL_REFERENCE",
    "VITE_ADMIN_API_BASE_URL",
    "VITE_SYNTHETIC_ADMIN_",
    "EXPO_PUBLIC_POLLYCAR_API_BASE_URL",
    "EXPO_PUBLIC_BRAND_PRODUCTION",
    "EXPO_PUBLIC_BRAND_DEMO"
  )
  foreach ($directory in $outputDirectories) {
    $path = Join-Path $repo $directory
    foreach ($pattern in $forbiddenArtifactPatterns) {
      $matches = & rg -n --fixed-strings $pattern $path
      if ($LASTEXITCODE -gt 1) {
        throw "无法扫描公开配置构建产物: $directory"
      }
      if ($matches) {
        throw "前端构建产物包含禁止配置标识: $pattern"
      }
    }
  }
}

Write-Host "Admin/App PublicConfig 单入口与 L2/L3 构建产物边界检查通过。"
