$ErrorActionPreference = "Stop"
$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Push-Location $repo
try {
  & pnpm exec vitest run scripts/infra/generate-container-supply-chain-report.test.mjs
  if ($LASTEXITCODE -ne 0) { throw "容器供应链专项测试失败" }
} finally {
  Pop-Location
}
Write-Host "容器供应链本地证据与失败关闭门禁检查通过。"
