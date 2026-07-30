[CmdletBinding()]
param(
  [switch]$Restart
)

$ErrorActionPreference = "Stop"
$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$runtimeDirectory = Join-Path $workspaceRoot ".codex-runtime\local-sandbox"
$outputDirectory = Join-Path $workspaceRoot "output"

function ConvertTo-EnvironmentHashtable {
  param(
    [Parameter(Mandatory)]
    [pscustomobject]$Environment
  )

  $result = @{}
  foreach ($property in $Environment.PSObject.Properties) {
    $result[$property.Name] = [string]$property.Value
  }
  return $result
}

$profileJson = & node (Join-Path $workspaceRoot "scripts\dev\print-local-sandbox-profile.mjs")
if ($LASTEXITCODE -ne 0) {
  throw "无法加载 local-sandbox Profile"
}
$launchManifest = $profileJson | ConvertFrom-Json
$network = $launchManifest.profile.network
$ports = @(
  [int]$network.serverPort,
  [int]$network.adminPort,
  [int]$network.appPort
)

function Stop-LocalSandboxProcesses {
  foreach ($port in $ports) {
    $connections = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
    foreach ($connection in $connections) {
      $process = Get-Process -Id $connection.OwningProcess -ErrorAction SilentlyContinue
      if ($process) {
        Write-Host "停止端口 $port 的进程 $($process.Id) ($($process.ProcessName))"
        Stop-Process -Id $process.Id -Force
      }
    }
  }

  Start-Sleep -Milliseconds 500
}

function Start-WorkspaceProcess {
  param(
    [Parameter(Mandatory)]
    [string]$Name,
    [Parameter(Mandatory)]
    [string]$WorkingDirectory,
    [Parameter(Mandatory)]
    [string[]]$Arguments,
    [Parameter(Mandatory)]
    [hashtable]$Environment,
    [Parameter(Mandatory)]
    [int]$Port
  )

  $stdoutPath = Join-Path $outputDirectory "$Name.log"
  $stderrPath = Join-Path $outputDirectory "$Name.error.log"
  $environmentAssignments = $Environment.GetEnumerator() |
    Sort-Object Key |
    ForEach-Object {
      "`$env:$($_.Key) = '$($_.Value.Replace("'", "''"))'"
    }
  $quotedArguments = $Arguments |
    ForEach-Object { "'$($_.Replace("'", "''"))'" }
  $command = @(
    '$ErrorActionPreference = ''Stop'''
    $environmentAssignments
    "Set-Location -LiteralPath '$($WorkingDirectory.Replace("'", "''"))'"
    "& pnpm.cmd $($quotedArguments -join ' ')"
  ) -join "; "

  $process = Start-Process `
    -FilePath "powershell.exe" `
    -ArgumentList @("-NoProfile", "-Command", $command) `
    -WorkingDirectory $WorkingDirectory `
    -WindowStyle Hidden `
    -RedirectStandardOutput $stdoutPath `
    -RedirectStandardError $stderrPath `
    -PassThru

  Set-Content -LiteralPath (Join-Path $runtimeDirectory "$Name.pid") -Value $process.Id

  $deadline = (Get-Date).AddSeconds(90)
  do {
    Start-Sleep -Milliseconds 500
    if ($process.HasExited) {
      $stderr = if (Test-Path $stderrPath) { Get-Content -Raw $stderrPath } else { "" }
      throw "$Name 启动失败：$stderr"
    }
    $listener = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
  } until ($listener -or (Get-Date) -ge $deadline)

  if (-not $listener) {
    throw "$Name 未在 90 秒内监听端口 $Port，请检查 $stdoutPath 和 $stderrPath"
  }

  Write-Host "$Name 已启动：http://127.0.0.1:$Port"
}

New-Item -ItemType Directory -Force -Path $runtimeDirectory, $outputDirectory | Out-Null

$occupiedPorts = Get-NetTCPConnection -State Listen -LocalPort $ports -ErrorAction SilentlyContinue
if ($occupiedPorts -and -not $Restart) {
  $occupied = ($occupiedPorts | Select-Object -ExpandProperty LocalPort -Unique | Sort-Object) -join ", "
  throw "端口 $occupied 已被占用。请使用 pnpm dev:local:restart 安全重启本地沙箱。"
}

if ($Restart) {
  Stop-LocalSandboxProcesses
}

$serverEnvironment = ConvertTo-EnvironmentHashtable $launchManifest.serverEnvironment
$adminEnvironment = ConvertTo-EnvironmentHashtable $launchManifest.adminEnvironment
$appEnvironment = ConvertTo-EnvironmentHashtable $launchManifest.appEnvironment

Start-WorkspaceProcess `
  -Name "server-$($network.serverPort)" `
  -WorkingDirectory (Join-Path $workspaceRoot "apps\server") `
  -Arguments @("dev:sandbox") `
  -Environment $serverEnvironment `
  -Port ([int]$network.serverPort)

Start-WorkspaceProcess `
  -Name "admin-$($network.adminPort)" `
  -WorkingDirectory (Join-Path $workspaceRoot "apps\admin") `
  -Arguments @("dev:sandbox", "--", "--strictPort") `
  -Environment $adminEnvironment `
  -Port ([int]$network.adminPort)

Start-WorkspaceProcess `
  -Name "app-$($network.appPort)" `
  -WorkingDirectory (Join-Path $workspaceRoot "apps\app") `
  -Arguments @("web", "--", "--port", [string]$network.appPort) `
  -Environment $appEnvironment `
  -Port ([int]$network.appPort)

Write-Host "本地沙箱已就绪。真实生产能力保持关闭。"
