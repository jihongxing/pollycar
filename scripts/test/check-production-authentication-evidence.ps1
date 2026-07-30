$ErrorActionPreference = "Stop"

$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$schemaPath = Join-Path $repo "infrastructure\production-authentication\readiness-evidence.schema.json"
$inputPath = Join-Path $repo "infrastructure\production-authentication\readiness-evidence.example.json"
$currentInputPath = Join-Path $repo "infrastructure\production-authentication\readiness-evidence.current.json"
$policyPath = Join-Path $repo "scripts\infra\production-authentication-readiness.mjs"
$runnerPath = Join-Path $repo "scripts\infra\generate-production-authentication-readiness.mjs"
$testPath = Join-Path $repo "scripts\infra\production-authentication-readiness.test.mjs"
$temporaryReport = Join-Path ([System.IO.Path]::GetTempPath()) "pollycar-production-authentication-readiness.json"

foreach ($path in @($schemaPath, $inputPath, $currentInputPath, $policyPath, $runnerPath, $testPath)) {
  if (-not (Test-Path -LiteralPath $path)) {
    throw "真实账号与认证证据门禁缺少文件: $path"
  }
}

$schema = Get-Content -LiteralPath $schemaPath -Raw | ConvertFrom-Json
$input = Get-Content -LiteralPath $inputPath -Raw | ConvertFrom-Json
$currentInput = Get-Content -LiteralPath $currentInputPath -Raw | ConvertFrom-Json
if ($schema.'$schema' -ne "https://json-schema.org/draft/2020-12/schema") {
  throw "真实账号与认证证据 Schema 版本不正确"
}
if ($input.contractVersion -ne "1.0" -or $input.environment -ne "shared-preproduction") {
  throw "真实账号与认证证据模板版本或环境不正确"
}
if (@($input.decisions.psobject.Properties).Count -ne 10) {
  throw "真实账号与认证证据模板必须包含十项决策"
}
if (@($input.approvals.psobject.Properties).Count -ne 6) {
  throw "真实账号与认证证据模板必须包含六类批准"
}
if (@($input.providers.psobject.Properties).Count -ne 3) {
  throw "真实账号与认证证据模板必须包含三条供应商链路"
}
if (
  $currentInput.providers.sms.selectedProviderId -ne "tencent-cloud-sms" -or
  $currentInput.providers.adultEligibility.selectedProviderId -ne "tencent-cloud-faceid" -or
  $currentInput.providers.adminWorkforce.selectedProviderId -ne "alibaba-cloud-idaas-eiam"
) {
  throw "真实账号与认证当前证据必须登记三类已选择供应商"
}

Push-Location $repo
try {
  & pnpm exec vitest run $testPath
  if ($LASTEXITCODE -ne 0) {
    throw "真实账号与认证证据专项测试失败"
  }

  & node $runnerPath $inputPath $temporaryReport
  if ($LASTEXITCODE -ne 0) {
    throw "真实账号与认证就绪报告生成失败"
  }
  $report = Get-Content -LiteralPath $temporaryReport -Raw | ConvertFrom-Json
  if ($report.status -ne "blocked") {
    throw "外部证据缺失时真实账号与认证必须保持 blocked"
  }
  if (@($report.blockers).Count -ne 70) {
    throw "真实账号与认证安全空值基线必须稳定保留 70 项阻断"
  }

  & node $runnerPath $currentInputPath $temporaryReport
  if ($LASTEXITCODE -ne 0) {
    throw "真实账号与认证当前进展报告生成失败"
  }
  $report = Get-Content -LiteralPath $temporaryReport -Raw | ConvertFrom-Json
  if ($report.status -ne "blocked" -or @($report.blockers).Count -ne 37) {
    throw "供应商选择和九项策略决策完成后必须稳定保留 37 项外部阻断"
  }
  if (
    $report.providerTestingAllowed -ne $false -or
    $report.productionAuthenticationEnabled -ne $false -or
    $report.authenticationRoutesEnabled -ne $false -or
    $report.productionMigrationsEnabled -ne $false -or
    $report.realDataUsed -ne $false
  ) {
    throw "真实账号与认证证据门禁不得启用供应商测试、生产认证、路由、迁移或真实数据"
  }
}
finally {
  Pop-Location
  Remove-Item -LiteralPath $temporaryReport -Force -ErrorAction SilentlyContinue
}

Write-Host "真实账号与认证安全基线 70 项、当前进展 37 项和三条供应商选择证据门禁检查通过。"
