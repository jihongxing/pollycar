$ErrorActionPreference = "Stop"

$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$containerName = "pollycar-ledger-stage3-$PID"
$databaseName = "pollycar_ledger_stage3"
$databasePassword = "postgres"
$containerStarted = $false

try {
  if (-not (Get-Command podman -ErrorAction SilentlyContinue)) {
    throw "阶段三账本证明需要 Podman"
  }

  $containerId = podman run -d `
    --name $containerName `
    -e "POSTGRES_PASSWORD=$databasePassword" `
    -e "POSTGRES_DB=$databaseName" `
    -p "127.0.0.1::5432" `
    "docker.io/library/postgres:17-alpine"
  if ($LASTEXITCODE -ne 0) {
    throw "无法启动阶段三 PostgreSQL 容器"
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
    throw "阶段三 PostgreSQL 容器未在时限内就绪"
  }

  $portMapping = podman port $containerName "5432/tcp"
  if ($LASTEXITCODE -ne 0 -or $portMapping -notmatch ':(\d+)\s*$') {
    throw "无法取得阶段三 PostgreSQL 映射端口"
  }
  $hostPort = $Matches[1]

  $env:POLLYCAR_LEDGER_PROTOTYPE_DATABASE_URL =
    "postgresql://postgres:$databasePassword@127.0.0.1:$hostPort/$databaseName"

  Push-Location $repo
  try {
    pnpm --filter @pollycar/server test:postgres-ledger-prototype
    if ($LASTEXITCODE -ne 0) {
      throw "阶段三账本数据库不变量证明失败"
    }
  } finally {
    Pop-Location
  }

  Write-Host "阶段三账本数据库不变量证明通过。"
  Write-Host "容器: $containerId"
  Write-Host "数据库: $databaseName"
} finally {
  Remove-Item Env:POLLYCAR_LEDGER_PROTOTYPE_DATABASE_URL -ErrorAction SilentlyContinue
  if ($containerStarted) {
    podman rm -f $containerName *> $null
  }
}
