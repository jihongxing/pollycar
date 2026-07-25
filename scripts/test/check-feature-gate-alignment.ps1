$ErrorActionPreference = "Stop"

$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$specPath = Join-Path $repo "spec\platform\feature-gates.yaml"
$contractPath = Join-Path $repo "packages\contracts\src\feature-gates.ts"
$roadmapPath = Join-Path $repo "ROADMAP.md"

$specLines = Get-Content -LiteralPath $specPath
$contractLines = Get-Content -LiteralPath $contractPath
$roadmapLines = Get-Content -LiteralPath $roadmapPath

function Convert-ToSnakeCase([string]$value) {
  return [regex]::Replace($value, "(?<!^)([A-Z])", "_`$1").ToLowerInvariant()
}

function Assert-SameGateSet(
  [string]$leftLabel,
  [string[]]$left,
  [string]$rightLabel,
  [string[]]$right
) {
  $difference = Compare-Object ($left | Sort-Object -Unique) ($right | Sort-Object -Unique)
  if ($difference) {
    $details = $difference | ForEach-Object {
      $location = if ($_.SideIndicator -eq "<=") { $leftLabel } else { $rightLabel }
      "$($_.InputObject) 仅存在于 $location"
    }
    throw "生产能力门禁名称不一致：`n$($details -join "`n")"
  }
}

$specGates = @("production_enabled")
$insideDefaults = $false
foreach ($line in $specLines) {
  if ($line -eq "defaults:") {
    $insideDefaults = $true
    continue
  }
  if ($insideDefaults -and $line -match "^[a-z]") {
    break
  }
  if ($insideDefaults -and $line -match "^  ([a-z][a-z0-9_]+): (true|false)$") {
    $specGates += $Matches[1]
  }
}

$contractGates = @()
$insideFeatureGates = $false
foreach ($line in $contractLines) {
  if ($line -eq "export interface FeatureGates {") {
    $insideFeatureGates = $true
    continue
  }
  if ($insideFeatureGates -and $line -eq "}") {
    break
  }
  if ($insideFeatureGates -and $line -match "^\s+readonly ([a-zA-Z][a-zA-Z0-9]+): boolean;$") {
    $contractGates += Convert-ToSnakeCase $Matches[1]
  }
}

$roadmapGates = foreach ($line in $roadmapLines) {
  if ($line -match "^([a-z][a-z0-9_]+): (true|false)$") {
    $Matches[1]
  }
}

Assert-SameGateSet "平台规范" $specGates "运行时契约" $contractGates
Assert-SameGateSet "平台规范" $specGates "路线图摘要" $roadmapGates

$specImplemented = @()
$insideImplemented = $false
foreach ($line in $specLines) {
  if ($line -eq "  implemented_internal:") {
    $insideImplemented = $true
    continue
  }
  if ($insideImplemented -and $line -match "^  [a-z]") {
    break
  }
  if ($insideImplemented -and $line -match '^    - "([a-z][a-z0-9_]+)"$') {
    $specImplemented += $Matches[1]
  }
}

$contractImplemented = @()
$insideImplementedCapabilities = $false
foreach ($line in $contractLines) {
  if ($line -match "^const internallyImplementedCapabilities = ") {
    $insideImplementedCapabilities = $true
    continue
  }
  if ($insideImplementedCapabilities -and $line -eq "]);") {
    break
  }
  if ($insideImplementedCapabilities -and $line -match '^\s+"([a-zA-Z][a-zA-Z0-9]+)",$') {
    $contractImplemented += Convert-ToSnakeCase $Matches[1]
  }
}

Assert-SameGateSet "平台规范已实现清单" $specImplemented "运行时已实现清单" $contractImplemented

$spec = $specLines -join "`n"
foreach ($required in @(
  'machine_source_of_truth: "spec/platform/feature-gates.yaml"',
  'roadmap_role: "human_readable_status_summary"',
  'implemented: false',
  'approved: false',
  'configured: false',
  'enabled: false',
  '- "reference"',
  '- "approved_by_roles"',
  '- "approved_on"',
  '- "environment"',
  '- "artifact_reference"'
)) {
  if ($spec -notmatch [regex]::Escape($required)) {
    throw "平台门禁规范缺少生命周期或批准证据字段: $required"
  }
}

foreach ($gate in $specGates | Where-Object {
  $_ -ne "internal_sandbox" -and $_ -notlike "synthetic_*"
}) {
  if ($gate -eq "production_enabled") {
    if ($spec -notmatch "(?m)^production_enabled: false$") {
      throw "真实生产门禁默认值必须关闭: $gate"
    }
    continue
  }
  if ($spec -notmatch "(?m)^  $([regex]::Escape($gate)): false$") {
    throw "真实生产门禁默认值必须关闭: $gate"
  }
}

if ($spec -notmatch "(?m)^  internal_sandbox: true$") {
  throw "internal_sandbox 必须是唯一默认开启的环境门禁"
}

$approvalPolicyGates = @()
foreach ($line in $specLines | Where-Object { $_ -match "^\s+gates: \[" }) {
  foreach ($match in [regex]::Matches($line, '"([a-z][a-z0-9_]+)"')) {
    $approvalPolicyGates += $match.Groups[1].Value
  }
}
$approvalRequiredGates = $specGates | Where-Object {
  $_ -ne "internal_sandbox" -and $_ -notlike "synthetic_*"
}
Assert-SameGateSet "需要批准的真实能力" $approvalRequiredGates "批准策略覆盖" $approvalPolicyGates

Write-Output "生产能力门禁对齐检查通过：规范、运行时契约与路线图摘要名称一致，真实能力默认关闭。"
