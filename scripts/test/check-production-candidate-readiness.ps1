$ErrorActionPreference = "Stop"
$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Push-Location $repo
try {
  & pnpm exec vitest run scripts/infra/generate-production-candidate-readiness.test.mjs
  if ($LASTEXITCODE -ne 0) { throw "生产候选就绪汇总测试失败" }
} finally {
  Pop-Location
}
Write-Host "生产候选就绪汇总报告失败关闭检查通过。"
