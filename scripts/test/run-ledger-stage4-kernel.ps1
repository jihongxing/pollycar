$ErrorActionPreference = "Stop"

$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$containerName = "pollycar-ledger-stage4-$PID"
$databaseName = "pollycar_ledger_stage4"
$databasePassword = "postgres"
$containerStarted = $false

try {
  if (-not (Get-Command podman -ErrorAction SilentlyContinue)) {
    throw "阶段四账本持久化内核验证需要 Podman"
  }

  $containerId = podman run -d `
    --name $containerName `
    -e "POSTGRES_PASSWORD=$databasePassword" `
    -e "POSTGRES_DB=$databaseName" `
    -p "127.0.0.1::5432" `
    "docker.io/library/postgres:17-alpine"
  if ($LASTEXITCODE -ne 0) {
    throw "无法启动阶段四 PostgreSQL 容器"
  }
  $containerStarted = $true

  $deadline = (Get-Date).AddSeconds(60)
  do {
    podman exec $containerName pg_isready -U postgres -d $databaseName *> $null
    if ($LASTEXITCODE -eq 0) {
      break
    }
    Start-Sleep -Milliseconds 500
  } while ((Get-Date) -lt $deadline)

  if ($LASTEXITCODE -ne 0) {
    throw "阶段四 PostgreSQL 容器未在时限内就绪"
  }

  $portMapping = podman port $containerName "5432/tcp"
  if ($LASTEXITCODE -ne 0 -or $portMapping -notmatch ':(\d+)\s*$') {
    throw "无法取得阶段四 PostgreSQL 映射端口"
  }
  $hostPort = $Matches[1]

  $env:POLLYCAR_LEDGER_KERNEL_DATABASE_URL =
    "postgresql://postgres:$databasePassword@127.0.0.1:$hostPort/$databaseName"

  Push-Location $repo
  try {
    pnpm --filter @pollycar/server test:postgres-ledger-kernel
    if ($LASTEXITCODE -ne 0) {
      throw "阶段四账本持久化内核验证失败"
    }
  } finally {
    Pop-Location
  }

  Write-Host "阶段四账本持久化内核验证通过。"
  Write-Host "容器: $containerId"
  Write-Host "数据库: $databaseName"
} finally {
  Remove-Item Env:POLLYCAR_LEDGER_KERNEL_DATABASE_URL -ErrorAction SilentlyContinue
  if ($containerStarted) {
    podman rm -f $containerName *> $null
  }
}
