param(
  [Parameter(Mandatory = $true)]
  [string]$ProfileId,
  [Parameter(Mandatory = $true)]
  [ValidateSet("first_time_user", "passenger", "owner", "exception_recovery")]
  [string]$Journey,
  [Parameter(Mandatory = $true)]
  [ValidateSet("core", "vehicle", "offline")]
  [string]$Flow,
  [Parameter(Mandatory = $true)]
  [ValidateSet("passed", "failed", "blocked")]
  [string]$Status,
  [Parameter(Mandatory = $true)]
  [string]$TesterId,
  [Parameter(Mandatory = $true)]
  [string]$BuildId,
  [Parameter(Mandatory = $true)]
  [string]$DeviceName,
  [Parameter(Mandatory = $true)]
  [string]$OsVersion,
  [ValidateSet("P0", "P1", "P2", "P3")]
  [string]$IssueSeverity,
  [string]$IssueCode,
  [string]$Notes = ""
)

$ErrorActionPreference = "Stop"
$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$matrix = Get-Content -LiteralPath (Join-Path $repo "qa\device-matrix.json") -Raw | ConvertFrom-Json
$profile = $matrix.profiles | Where-Object profileId -eq $ProfileId | Select-Object -First 1
if (-not $profile) {
  throw "未知设备配置: $ProfileId"
}
if ($Status -eq "failed" -and -not $IssueSeverity) {
  throw "失败结果必须提供 IssueSeverity。"
}
if ($Status -eq "failed" -and -not $IssueCode) {
  throw "失败结果必须提供 IssueCode。"
}

$resultDirectory = Join-Path $repo "output\device-qa\results"
New-Item -ItemType Directory -Path $resultDirectory -Force | Out-Null
$runId = [guid]::NewGuid().ToString()
$result = [ordered]@{
  runId = $runId
  recordedAt = [DateTimeOffset]::Now.ToString("o")
  profileId = $ProfileId
  platform = $profile.platform
  executionEnvironment = "physical_device"
  journey = $Journey
  flow = $Flow
  testerId = $TesterId
  buildId = $BuildId
  deviceName = $DeviceName
  osVersion = $OsVersion
  status = $Status
  notes = $Notes
  syntheticOnly = $true
}
if ($IssueSeverity) { $result.issueSeverity = $IssueSeverity }
if ($IssueCode) { $result.issueCode = $IssueCode }

$resultPath = Join-Path $resultDirectory "$runId.json"
$result | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $resultPath -Encoding utf8
Write-Host "设备验收结果已记录: $resultPath"
