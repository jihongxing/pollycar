$ErrorActionPreference = "Stop"

$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$containerName = "pollycar-ledger-stage5-$PID"
$databaseName = "pollycar_ledger_stage5"
$databasePassword = "postgres"
$containerStarted = $false

function Wait-ForPostgres {
  $deadline = (Get-Date).AddSeconds(60)
  do {
    podman exec $containerName pg_isready -U postgres -d $databaseName *> $null
    if ($LASTEXITCODE -eq 0) {
      return
    }
    Start-Sleep -Milliseconds 500
  } while ((Get-Date) -lt $deadline)
  throw "阶段五 PostgreSQL 容器未在时限内就绪"
}

function Invoke-ResiliencePhase([string]$phase) {
  $env:POLLYCAR_LEDGER_RESILIENCE_PHASE = $phase
  pnpm --filter @pollycar/server test:postgres-ledger-resilience
  if ($LASTEXITCODE -ne 0) {
    throw "阶段五账本韧性验证失败：$phase"
  }
}

try {
  if (-not (Get-Command podman -ErrorAction SilentlyContinue)) {
    throw "阶段五账本韧性验证需要 Podman"
  }

  $containerId = podman run -d `
    --name $containerName `
    -e "POSTGRES_PASSWORD=$databasePassword" `
    -e "POSTGRES_DB=$databaseName" `
    -p "127.0.0.1::5432" `
    "docker.io/library/postgres:17-alpine"
  if ($LASTEXITCODE -ne 0) {
    throw "无法启动阶段五 PostgreSQL 容器"
  }
  $containerStarted = $true
  Wait-ForPostgres

  $portMapping = podman port $containerName "5432/tcp"
  if ($LASTEXITCODE -ne 0 -or $portMapping -notmatch ':(\d+)\s*$') {
    throw "无法取得阶段五 PostgreSQL 映射端口"
  }
  $hostPort = $Matches[1]
  $env:POLLYCAR_LEDGER_RESILIENCE_DATABASE_URL =
    "postgresql://postgres:$databasePassword@127.0.0.1:$hostPort/$databaseName"

  Push-Location $repo
  try {
    Invoke-ResiliencePhase "before_restart"
    podman restart $containerName *> $null
    if ($LASTEXITCODE -ne 0) {
      throw "阶段五 PostgreSQL 容器重启失败"
    }
    Wait-ForPostgres
    Invoke-ResiliencePhase "after_restart"
  } finally {
    Pop-Location
  }

  Write-Host "阶段五账本并发、重建、回滚和重启恢复验证通过。"
  Write-Host "容器: $containerId"
  Write-Host "数据库: $databaseName"
} finally {
  Remove-Item Env:POLLYCAR_LEDGER_RESILIENCE_DATABASE_URL -ErrorAction SilentlyContinue
  Remove-Item Env:POLLYCAR_LEDGER_RESILIENCE_PHASE -ErrorAction SilentlyContinue
  if ($containerStarted) {
    podman rm -f $containerName *> $null
  }
}
