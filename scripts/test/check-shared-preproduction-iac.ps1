$ErrorActionPreference = "Stop"

$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$policyPath = Join-Path $repo "scripts\infra\shared-preproduction-iac-policy.mjs"
$runnerPath = Join-Path $repo "scripts\infra\run-shared-preproduction-iac.mjs"
$testPath = Join-Path $repo "scripts\infra\shared-preproduction-iac-policy.test.mjs"
$schemaPath = Join-Path $repo "infrastructure\shared-preproduction\iac-input.schema.json"
$inputPath = Join-Path $repo "infrastructure\shared-preproduction\iac-input.example.json"
$temporaryPlan = Join-Path ([System.IO.Path]::GetTempPath()) "pollycar-shared-preproduction-iac-plan.json"
$temporaryApplyOutput = Join-Path ([System.IO.Path]::GetTempPath()) "pollycar-shared-preproduction-iac-apply.out"
$temporaryApplyError = Join-Path ([System.IO.Path]::GetTempPath()) "pollycar-shared-preproduction-iac-apply.err"

foreach ($path in @($policyPath, $runnerPath, $testPath, $schemaPath, $inputPath)) {
  if (-not (Test-Path -LiteralPath $path)) {
    throw "共享预生产 IaC 门禁缺少文件: $path"
  }
}

Push-Location $repo
try {
  & pnpm exec vitest run $testPath
  if ($LASTEXITCODE -ne 0) {
    throw "共享预生产 IaC 专项测试失败"
  }

  & node $runnerPath plan --input $inputPath --output $temporaryPlan
  if ($LASTEXITCODE -ne 0) {
    throw "共享预生产 IaC 只读计划生成失败"
  }

  $plan = Get-Content -LiteralPath $temporaryPlan -Raw | ConvertFrom-Json
  if ($plan.status -ne "blocked") {
    throw "缺少外部输入时共享预生产计划必须为 blocked"
  }
  if ($plan.resourceCreationAllowed -ne $false -or $plan.deploymentAllowed -ne $false) {
    throw "共享预生产只读计划不得允许资源创建或部署"
  }
  if (@($plan.resourceChanges).Count -ne 0) {
    throw "共享预生产只读计划不得产生资源变更"
  }

  $applyProcess = Start-Process -FilePath "node" -ArgumentList @(
    $runnerPath,
    "apply",
    "--input",
    $inputPath,
    "--output",
    $temporaryPlan
  ) -NoNewWindow -Wait -PassThru `
    -RedirectStandardOutput $temporaryApplyOutput `
    -RedirectStandardError $temporaryApplyError
  if ($applyProcess.ExitCode -eq 0) {
    throw "共享预生产 apply 在当前门禁下必须失败"
  }
}
finally {
  Pop-Location
  Remove-Item -LiteralPath @(
    $temporaryPlan,
    $temporaryApplyOutput,
    $temporaryApplyError
  ) -Force -ErrorAction SilentlyContinue
}

Write-Host "共享预生产 IaC 输入契约、零资源计划与 apply 失败关闭检查通过。"
