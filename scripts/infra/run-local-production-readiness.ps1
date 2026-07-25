param(
  [switch]$KeepRunning
)

$ErrorActionPreference = "Stop"

$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$infra = Join-Path $repo "infrastructure\local-production"
$compose = @("compose", "-f", (Join-Path $infra "compose.yaml"), "--project-name", "pollycar-production-readiness")
$deployment = Join-Path $infra "state\server-deploy"
$deploymentBundle = Join-Path $infra "state\server-bundle"

& (Join-Path $PSScriptRoot "initialize-local-production-readiness.ps1") -Root $infra
& pnpm --filter @pollycar/server build
if ($LASTEXITCODE -ne 0) { throw "生产就绪服务构建失败" }
if (Test-Path -LiteralPath $deployment) {
  $resolvedDeployment = (Resolve-Path -LiteralPath $deployment).Path
  $resolvedState = (Resolve-Path -LiteralPath (Join-Path $infra "state")).Path
  if (-not $resolvedDeployment.StartsWith($resolvedState, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "生产就绪部署产物目录越界"
  }
  Remove-Item -LiteralPath $resolvedDeployment -Recurse -Force
}
& pnpm --filter @pollycar/server deploy --prod --legacy --offline $deployment
if ($LASTEXITCODE -ne 0) { throw "生产就绪离线部署产物生成失败" }
if (Test-Path -LiteralPath $deploymentBundle) {
  $resolvedDeploymentBundle = (Resolve-Path -LiteralPath $deploymentBundle).Path
  $resolvedState = (Resolve-Path -LiteralPath (Join-Path $infra "state")).Path
  if (-not $resolvedDeploymentBundle.StartsWith($resolvedState, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "生产就绪镜像产物目录越界"
  }
  Remove-Item -LiteralPath $resolvedDeploymentBundle -Recurse -Force
}
& node (Join-Path $PSScriptRoot "materialize-local-production-deployment.mjs") $deployment $deploymentBundle
if ($LASTEXITCODE -ne 0) { throw "生产就绪镜像产物物化失败" }

try {
  & podman @compose up --build --detach
  if ($LASTEXITCODE -ne 0) { throw "本地生产就绪栈启动失败" }

  & podman @compose run --rm server node dist/persistence/run-production-migrations.js
  if ($LASTEXITCODE -ne 0) { throw "生产就绪迁移失败" }

  $proxyCertificateAuthority = Join-Path $infra "secrets\postgres-ca.crt"
  $live = (& curl.exe --silent --show-error --fail `
    --ssl-no-revoke `
    --cacert $proxyCertificateAuthority `
    --resolve "api.pollycar.example:8444:127.0.0.1" `
    "https://api.pollycar.example:8444/health/live") | ConvertFrom-Json
  if ($LASTEXITCODE -ne 0) { throw "存活检查请求失败" }
  if ($live.status -ne "live") { throw "存活检查失败" }
  $ready = (& curl.exe --silent --show-error --fail `
    --ssl-no-revoke `
    --cacert $proxyCertificateAuthority `
    --resolve "api.pollycar.example:8444:127.0.0.1" `
    "https://api.pollycar.example:8444/health/ready") | ConvertFrom-Json
  if ($LASTEXITCODE -ne 0) { throw "就绪检查请求失败" }
  if ($ready.status -ne "ready") { throw "就绪检查失败" }

  $backup = Join-Path $infra "state\pollycar-backup.sql"
  $backupContents = & podman @compose exec -T postgres sh -ec "PGPASSWORD=`$(cat /run/local-production/postgres-password.txt) pg_dump --format=plain --no-owner --username=pollycar --dbname=pollycar"
  if ($LASTEXITCODE -ne 0) { throw "备份失败" }
  [System.IO.File]::WriteAllText(
    $backup,
    [string]::Join([Environment]::NewLine, $backupContents),
    (New-Object System.Text.UTF8Encoding($false))
  )

  $restoreCommand = "PGPASSWORD=`$(cat /run/local-production/postgres-password.txt) dropdb --if-exists --username=pollycar pollycar_restore; PGPASSWORD=`$(cat /run/local-production/postgres-password.txt) createdb --username=pollycar pollycar_restore; PGPASSWORD=`$(cat /run/local-production/postgres-password.txt) psql --set ON_ERROR_STOP=on --username=pollycar --dbname=pollycar_restore"
  [System.IO.File]::ReadAllText($backup) | & podman @compose exec -T postgres sh -ec $restoreCommand
  if ($LASTEXITCODE -ne 0) { throw "恢复失败" }

  $migrationCount = & podman @compose exec -T postgres sh -ec "PGPASSWORD=`$(cat /run/local-production/postgres-password.txt) psql --tuples-only --no-align --username=pollycar --dbname=pollycar_restore --command 'select count(*) from pollycar_schema_migrations'"
  if ([int]($migrationCount | Select-Object -Last 1) -le 0) { throw "恢复后的迁移历史为空" }

  Write-Output "本地生产就绪验收通过：部署、迁移、HTTPS 健康检查、备份和恢复均已验证。"
} finally {
  if (-not $KeepRunning) {
    & podman @compose down --volumes
    if ($LASTEXITCODE -ne 0) { throw "本地生产就绪栈停止失败" }
  }
}
