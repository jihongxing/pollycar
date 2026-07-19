$ErrorActionPreference = "Stop"

$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")

function Read-RequiredFile {
  param([string]$RelativePath)

  $path = Join-Path $repo $RelativePath
  if (-not (Test-Path -LiteralPath $path)) {
    throw "缺少 API 或验收规范: $RelativePath"
  }

  return Get-Content -LiteralPath $path -Raw
}

function Get-ListIds {
  param([string]$Content)

  return @(
    [regex]::Matches($Content, '(?m)^\s*-\s+id:\s+"([^"]+)"\s*$') |
      ForEach-Object { $_.Groups[1].Value }
  )
}

function Assert-ProductionDisabled {
  param(
    [string]$Name,
    [string]$Content
  )

  if ($Content -notmatch '(?m)^production_enabled:\s+false\s*$') {
    throw "$Name 必须明确 production_enabled: false"
  }
}

$errorSpec = Read-RequiredFile "spec\api\error-codes.yaml"
$scenarioSpec = Read-RequiredFile "spec\tests\eligibility-scenarios.yaml"
$adminFinanceScenarioSpec = Read-RequiredFile "spec\tests\admin-finance-operations-scenarios.yaml"
$adminExecutiveScenarioSpec = Read-RequiredFile "spec\tests\admin-executive-dashboard-scenarios.yaml"
$stateSpec = Read-RequiredFile "spec\domain\eligibility-states.yaml"
$eventSpec = Read-RequiredFile "spec\domain\eligibility-events.yaml"
$roleSpec = Read-RequiredFile "spec\security\roles.yaml"
$classificationSpec = Read-RequiredFile "spec\security\data-classification.yaml"
$authorizationSpec = Read-RequiredFile "spec\security\authorization-rules.yaml"
$openApiSpec = Read-RequiredFile "spec\api\openapi.yaml"

Assert-ProductionDisabled "error-codes.yaml" $errorSpec
Assert-ProductionDisabled "eligibility-scenarios.yaml" $scenarioSpec
Assert-ProductionDisabled "admin-finance-operations-scenarios.yaml" $adminFinanceScenarioSpec
Assert-ProductionDisabled "admin-executive-dashboard-scenarios.yaml" $adminExecutiveScenarioSpec

$errorIds = Get-ListIds $errorSpec
$scenarioIds = Get-ListIds $scenarioSpec
$adminFinanceScenarioIds = Get-ListIds $adminFinanceScenarioSpec
$adminExecutiveScenarioIds = Get-ListIds $adminExecutiveScenarioSpec
$eventIds = Get-ListIds $eventSpec
$roleIds = Get-ListIds $roleSpec
$actionIds = Get-ListIds $authorizationSpec

$stateSection = [regex]::Match($stateSpec, '(?ms)^states:\s*$.*?(?=^transitions:\s*$)').Value
$stateIds = Get-ListIds $stateSection
$scenarioStateIds = @(
  $stateIds
  "pending_payment"
  "paid_pending_match"
  "accepted"
  "in_progress"
  "safety_frozen"
  "completed"
  "cancelled"
  "open_frozen"
  "appealing"
  "restored"
  "upheld"
)
$levelIds = @(
  [regex]::Matches($classificationSpec, '(?m)^\s{2}-\s+id:\s+"(L[0-4])"\s*$') |
    ForEach-Object { $_.Groups[1].Value }
)

if ($errorIds.Count -eq 0) {
  throw "错误码规范没有定义错误码"
}
if ($scenarioIds.Count -eq 0) {
  throw "验收场景规范没有定义场景"
}
if ($adminFinanceScenarioIds.Count -ne 32) {
  throw "阶段四资金运营验收场景应为 32 项，实际为 $($adminFinanceScenarioIds.Count)"
}
if ($adminExecutiveScenarioIds.Count -ne 32) {
  throw "阶段五高层驾驶舱验收场景应为 32 项，实际为 $($adminExecutiveScenarioIds.Count)"
}

$duplicateErrors = @($errorIds | Group-Object | Where-Object Count -gt 1 | ForEach-Object Name)
if ($duplicateErrors.Count -gt 0) {
  throw "错误码重复: $($duplicateErrors -join ', ')"
}

$duplicateScenarios = @($scenarioIds | Group-Object | Where-Object Count -gt 1 | ForEach-Object Name)
if ($duplicateScenarios.Count -gt 0) {
  throw "场景编号重复: $($duplicateScenarios -join ', ')"
}

$adminFinanceScenarioErrors = @(
  [regex]::Matches($adminFinanceScenarioSpec, 'expected_error:\s+"([A-Z][A-Z0-9_]+)"') |
    ForEach-Object { $_.Groups[1].Value } |
    Sort-Object -Unique
)
foreach ($errorCode in $adminFinanceScenarioErrors) {
  if ($errorIds -notcontains $errorCode) {
    throw "阶段四资金运营场景引用了未知错误码: $errorCode"
  }
}

$adminExecutiveScenarioErrors = @(
  [regex]::Matches($adminExecutiveScenarioSpec, 'expected_error:\s+"([A-Z][A-Z0-9_]+)"') |
    ForEach-Object { $_.Groups[1].Value } |
    Sort-Object -Unique
)
foreach ($errorCode in $adminExecutiveScenarioErrors) {
  if ($errorIds -notcontains $errorCode) {
    throw "阶段五高层驾驶舱场景引用了未知错误码: $errorCode"
  }
}

$requiredErrors = @(
  "VALIDATION_INVALID_REQUEST",
  "AUTHENTICATION_REQUIRED",
  "AUTHORIZATION_DENIED",
  "AUTHORIZATION_SEPARATION_OF_DUTIES",
  "ELIGIBILITY_INVALID_STATE",
  "ELIGIBILITY_SUSPENDED",
  "ELIGIBILITY_REVOKED",
  "ELIGIBILITY_EXPIRED",
  "ELIGIBILITY_ACTIVATION_DAYS_EXCEEDED",
  "QUOTA_24H_EXCEEDED",
  "QUOTA_7D_EXCEEDED",
  "QUOTA_30D_EXCEEDED",
  "QUOTA_ORDER_ALREADY_ACCEPTED",
  "PAYMENT_PROVIDER_UNAVAILABLE",
  "SAFETY_ACTION_BLOCKED",
  "CONFLICT_VERSION_MISMATCH",
  "INTERNAL_UNEXPECTED_ERROR"
)
foreach ($errorCode in $requiredErrors) {
  if ($errorIds -notcontains $errorCode) {
    throw "错误码规范缺少: $errorCode"
  }
}

$domainErrorReferences = @(
  [regex]::Matches("$stateSpec`n$((Read-RequiredFile 'spec\domain\quota-policy.yaml'))", '"([A-Z][A-Z0-9_]+)"') |
    ForEach-Object { $_.Groups[1].Value } |
    Where-Object { $_ -match '^(ELIGIBILITY|QUOTA)_' } |
    Sort-Object -Unique
)
foreach ($errorCode in $domainErrorReferences) {
  if ($errorIds -notcontains $errorCode) {
    throw "领域规范引用了未注册错误码: $errorCode"
  }
}

$errorBlocks = [regex]::Matches(
  $errorSpec,
  '(?ms)^\s{2}-\s+id:\s+"([^"]+)".*?^\s{4}http_status:\s+(\d+).*?^\s{4}retryable:\s+(true|false).*?^\s{4}disclosure:\s+"([^"]+)".*?^\s{4}audit:\s+"([^"]+)"'
)
if ($errorBlocks.Count -ne $errorIds.Count) {
  throw "每个错误码都必须定义 http_status、retryable、disclosure 和 audit"
}

$validDisclosures = @("public", "limited", "generic", "internal_only")
$validAudits = @("none", "standard", "sensitive", "strict")
foreach ($block in $errorBlocks) {
  $httpStatus = [int]$block.Groups[2].Value
  $disclosure = $block.Groups[4].Value
  $audit = $block.Groups[5].Value

  if ($httpStatus -lt 400 -or $httpStatus -gt 599) {
    throw "错误码 $($block.Groups[1].Value) 的 HTTP 状态无效: $httpStatus"
  }
  if ($validDisclosures -notcontains $disclosure) {
    throw "错误码 $($block.Groups[1].Value) 的披露等级无效: $disclosure"
  }
  if ($validAudits -notcontains $audit) {
    throw "错误码 $($block.Groups[1].Value) 的审计等级无效: $audit"
  }
}

$scenarioBlocks = [regex]::Matches(
  $scenarioSpec,
  '(?ms)^\s{2}-\s+id:\s+"([^"]+)"(?<body>.*?)(?=^\s{2}-\s+id:|\z)'
)

$validAuditsForScenarios = @("none", "standard", "sensitive", "strict")
foreach ($scenario in $scenarioBlocks) {
  $scenarioId = $scenario.Groups[1].Value
  $body = $scenario.Groups["body"].Value

  $stateMatches = [regex]::Matches($body, '(?m)^\s{4}(?:initial_state|expected_state):\s+"([^"]+)"\s*$')
  foreach ($stateMatch in $stateMatches) {
    $state = $stateMatch.Groups[1].Value
    if ($scenarioStateIds -notcontains $state) {
      throw "场景 $scenarioId 引用了未知状态: $state"
    }
  }

  $actorMatch = [regex]::Match($body, '(?m)^\s{4}actor:\s+"([^"]+)"\s*$')
  if (-not $actorMatch.Success -or $roleIds -notcontains $actorMatch.Groups[1].Value) {
    throw "场景 $scenarioId 引用了未知角色"
  }

  $commandMatch = [regex]::Match($body, '(?m)^\s{4}command:\s+"([^"]+)"\s*$')
  if (-not $commandMatch.Success) {
    throw "场景 $scenarioId 缺少 command"
  }

  $command = $commandMatch.Groups[1].Value
  $knownScenarioOnlyPrefixes = @(
    "eligibility.activation.",
    "eligibility.activate",
    "eligibility.restore",
    "eligibility.expire",
    "quota.release",
    "quota.finalize",
    "data.",
    "spec."
  )
  $isScenarioOnlyCommand = $false
  foreach ($prefix in $knownScenarioOnlyPrefixes) {
    if ($command.StartsWith($prefix, [System.StringComparison]::Ordinal)) {
      $isScenarioOnlyCommand = $true
      break
    }
  }
  if (-not $isScenarioOnlyCommand -and $actionIds -notcontains $command) {
    throw "场景 $scenarioId 引用了未知授权动作: $command"
  }

  $eventListMatch = [regex]::Match($body, '(?m)^\s{4}expected_events:\s+\[([^\]]*)\]\s*$')
  if (-not $eventListMatch.Success) {
    throw "场景 $scenarioId 缺少 expected_events"
  }
  $scenarioEvents = @(
    [regex]::Matches($eventListMatch.Groups[1].Value, '"([^"]+)"') |
      ForEach-Object { $_.Groups[1].Value }
  )
  foreach ($event in $scenarioEvents) {
    if ($eventIds -notcontains $event) {
      throw "场景 $scenarioId 引用了未知事件: $event"
    }
  }

  $errorMatch = [regex]::Match($body, '(?m)^\s{4}expected_error:\s+(?:"([^"]+)"|null)\s*$')
  if (-not $errorMatch.Success) {
    throw "场景 $scenarioId 缺少 expected_error"
  }
  if ($errorMatch.Groups[1].Success -and $errorIds -notcontains $errorMatch.Groups[1].Value) {
    throw "场景 $scenarioId 引用了未知错误码: $($errorMatch.Groups[1].Value)"
  }

  $auditMatch = [regex]::Match($body, '(?m)^\s{4}audit:\s+"([^"]+)"\s*$')
  if (-not $auditMatch.Success -or $validAuditsForScenarios -notcontains $auditMatch.Groups[1].Value) {
    throw "场景 $scenarioId 的审计等级无效"
  }

  $classificationMatch = [regex]::Match($body, '(?m)^\s{4}classification:\s+"(L[0-4])"\s*$')
  if (-not $classificationMatch.Success -or $levelIds -notcontains $classificationMatch.Groups[1].Value) {
    throw "场景 $scenarioId 的数据等级无效"
  }

  if ($body -notmatch '(?m)^\s{4}release_blocking:\s+(true|false)\s*$') {
    throw "场景 $scenarioId 缺少 release_blocking"
  }
}

$requiredScenarioPrefixes = @("ELIG-", "PAY-", "EXP-", "QUOTA-", "CONC-", "AUTH-", "DATA-", "GOV-")
foreach ($prefix in $requiredScenarioPrefixes) {
  if (-not ($scenarioIds | Where-Object { $_.StartsWith($prefix, [System.StringComparison]::Ordinal) })) {
    throw "验收场景缺少类别: $prefix"
  }
}

$requiredOpenApiPaths = @(
  "/v1/drivers/me/flex-eligibility/applications:",
  "/v1/drivers/me/flex-eligibility:",
  "/v1/drivers/me/flex-eligibility/confirmation:",
  "/v1/drivers/me/flex-eligibility/appeals:",
  "/v1/admin/flex-eligibility/applications/{application_id}/decision:",
  "/v1/admin/flex-eligibilities/{eligibility_id}/suspension:",
  "/v1/admin/flex-eligibilities/{eligibility_id}/revocation:",
  "/v1/admin/flex-eligibility/appeals/{appeal_id}/decision:",
  "/v1/admin/flex-eligibilities/{eligibility_id}/financial-status:"
)
foreach ($path in $requiredOpenApiPaths) {
  if ($openApiSpec -notmatch [regex]::Escape($path)) {
    throw "OpenAPI 缺少路径: $path"
  }
}

if ($openApiSpec -notmatch [regex]::Escape('#/components/schemas/ErrorResponse')) {
  throw "OpenAPI 必须定义统一 ErrorResponse"
}
if ($openApiSpec -notmatch 'Idempotency-Key') {
  throw "OpenAPI 写操作必须定义 Idempotency-Key"
}

$openApiStateEnum = [regex]::Match(
  $openApiSpec,
  '(?ms)^\s{4}FlexEligibilityState:\s*$.*?^\s{6}enum:\s*$.*?(?=^\s{4}[A-Za-z][A-Za-z0-9]+:\s*$)'
).Value
foreach ($state in $stateIds) {
  if ($openApiStateEnum -notmatch "(?m)^\s{8}-\s+$([regex]::Escape($state))\s*$") {
    throw "OpenAPI 状态枚举缺少: $state"
  }
}

$forbiddenOpenApiTerms = @(
  "risk_score",
  "risk_threshold",
  "reporter_identity",
  "chat_message_body",
  "precise_location_trace",
  "full_payment_credential",
  "quota_override"
)
foreach ($term in $forbiddenOpenApiTerms) {
  if ($openApiSpec -match [regex]::Escape($term)) {
    throw "OpenAPI 暴露了禁止字段或能力: $term"
  }
}

Write-Host "错误码与验收场景检查通过。"
Write-Host "错误码: $($errorIds.Count)"
Write-Host "验收场景: $($scenarioIds.Count)"
Write-Host "阶段四资金运营场景: $($adminFinanceScenarioIds.Count)"
Write-Host "阶段五高层驾驶舱场景: $($adminExecutiveScenarioIds.Count)"
Write-Host "OpenAPI 最小契约检查通过。"
