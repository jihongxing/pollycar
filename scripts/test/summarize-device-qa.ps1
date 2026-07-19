param(
  [switch]$FailOnBlockingIssues
)

$ErrorActionPreference = "Stop"
$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$plan = Get-Content -LiteralPath (Join-Path $repo "qa\device-acceptance-plan.json") -Raw | ConvertFrom-Json
$resultDirectory = Join-Path $repo "output\device-qa\results"
$results = @()
if (Test-Path -LiteralPath $resultDirectory) {
  $results = @(Get-ChildItem -LiteralPath $resultDirectory -Filter "*.json" -File | ForEach-Object {
    Get-Content -LiteralPath $_.FullName -Raw | ConvertFrom-Json
  })
}

$latestByRequirement = @{}
foreach ($result in ($results | Sort-Object recordedAt)) {
  $key = "$($result.profileId)|$($result.journey)|$($result.flow)"
  $latestByRequirement[$key] = $result
}

$summaryRows = foreach ($required in $plan.requiredRuns) {
  $key = "$($required.profileId)|$($required.journey)|$($required.flow)"
  $result = $latestByRequirement[$key]
  [pscustomobject]@{
    profileId = $required.profileId
    journey = $required.journey
    flow = $required.flow
    status = if ($result) { $result.status } else { "not_run" }
    issueSeverity = if ($result.issueSeverity) { $result.issueSeverity } else { "" }
    issueCode = if ($result.issueCode) { $result.issueCode } else { "" }
  }
}

$summaryRows | Format-Table -AutoSize
$completed = @($summaryRows | Where-Object status -eq "passed").Count
$failed = @($summaryRows | Where-Object status -eq "failed").Count
$blocked = @($summaryRows | Where-Object status -eq "blocked").Count
$notRun = @($summaryRows | Where-Object status -eq "not_run").Count
$blockingIssues = @($summaryRows | Where-Object { $_.issueSeverity -in @("P0", "P1") }).Count

Write-Host "计划运行: $($summaryRows.Count)"
Write-Host "通过: $completed；失败: $failed；阻断: $blocked；未运行: $notRun；P0/P1: $blockingIssues"

if ($FailOnBlockingIssues -and $blockingIssues -gt 0) {
  throw "设备验收存在 $blockingIssues 个 P0/P1 问题。"
}
