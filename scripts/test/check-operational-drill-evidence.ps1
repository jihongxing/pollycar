$ErrorActionPreference = "Stop"
$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$temporaryEvidence = Join-Path ([System.IO.Path]::GetTempPath()) "pollycar-operational-drill-evidence.json"
Push-Location $repo
try {
  & pnpm exec vitest run scripts/infra/operational-drill-evidence.test.mjs
  if ($LASTEXITCODE -ne 0) { throw "本地故障演练证据专项测试失败" }
  & node scripts/infra/run-operational-drill-evidence.mjs template $temporaryEvidence
  if ($LASTEXITCODE -ne 0) { throw "本地故障演练证据模板生成失败" }
  $evidence = Get-Content -LiteralPath $temporaryEvidence -Raw | ConvertFrom-Json
  if ($evidence.overallStatus -ne "blocked") {
    throw "未执行演练的证据模板必须保持 blocked"
  }
} finally {
  Pop-Location
  Remove-Item -LiteralPath $temporaryEvidence -Force -ErrorAction SilentlyContinue
}
Write-Host "本地故障演练报告与证据校验检查通过。"
