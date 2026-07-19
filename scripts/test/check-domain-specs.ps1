$ErrorActionPreference = "Stop"

$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")

function Read-Spec {
  param([string]$RelativePath)

  $path = Join-Path $repo $RelativePath
  if (-not (Test-Path -LiteralPath $path)) {
    throw "缺少领域规范: $RelativePath"
  }

  return Get-Content -LiteralPath $path -Raw
}

function Get-ListItemProperty {
  param(
    [string]$Content,
    [string]$Property
  )

  $pattern = "(?m)^\s*-\s+$([regex]::Escape($Property)):\s+`"?([^`"`r`n]+)`"?\s*$"
  return @(
    [regex]::Matches($Content, $pattern) |
      ForEach-Object { $_.Groups[1].Value.Trim() }
  )
}

function Get-ScalarProperty {
  param(
    [string]$Content,
    [string]$Property
  )

  $pattern = "(?m)^\s*$([regex]::Escape($Property)):\s+`"?([^`"`r`n]+)`"?\s*$"
  $match = [regex]::Match($Content, $pattern)
  if (-not $match.Success) {
    return $null
  }

  return $match.Groups[1].Value.Trim()
}

function Assert-Contains {
  param(
    [string]$Content,
    [string[]]$Values,
    [string]$Label
  )

  $missing = @()
  foreach ($value in $Values) {
    if ($Content -notmatch [regex]::Escape($value)) {
      $missing += $value
    }
  }

  if ($missing.Count -gt 0) {
    throw "$Label 缺少: $($missing -join ', ')"
  }
}

$stateSpec = Read-Spec "spec\domain\eligibility-states.yaml"
$eventSpec = Read-Spec "spec\domain\eligibility-events.yaml"
$quotaSpec = Read-Spec "spec\domain\quota-policy.yaml"
$goodwillCancellationSpec = Read-Spec "spec\domain\goodwill-cancellation-policy.yaml"
$adultEligibilitySpec = Read-Spec "spec\domain\adult-eligibility-verification.yaml"
$roleSpec = Read-Spec "spec\security\roles.yaml"
$classificationSpec = Read-Spec "spec\security\data-classification.yaml"
$authorizationSpec = Read-Spec "spec\security\authorization-rules.yaml"

$allSpecs = @{
  "eligibility-states.yaml" = $stateSpec
  "eligibility-events.yaml" = $eventSpec
  "quota-policy.yaml" = $quotaSpec
  "goodwill-cancellation-policy.yaml" = $goodwillCancellationSpec
  "adult-eligibility-verification.yaml" = $adultEligibilitySpec
  "roles.yaml" = $roleSpec
  "data-classification.yaml" = $classificationSpec
  "authorization-rules.yaml" = $authorizationSpec
}

Assert-Contains $adultEligibilitySpec @(
  'user_facing_name: "成年资格验证"',
  'minimum_age_years: 18',
  'self_declared_age_sufficient: false',
  'real_identity_verification: false',
  'real_biometric_verification: false',
  'external_identity_provider: false',
  'synthetic_only: true',
  'id: "document"',
  'id: "age"',
  'id: "liveness"',
  'id: "face_match"',
  'business_access_allowed_only_when: "state == verified && all_required_checks == passed"',
  'result_unknown: "retry_verification"',
  '"raw_face_image"',
  '"biometric_template"'
) "成年资格验证规范"

foreach ($entry in $allSpecs.GetEnumerator()) {
  if ($entry.Value -notmatch '(?m)^production_enabled:\s+false\s*$') {
    throw "$($entry.Key) 必须明确 production_enabled: false"
  }

  if ($entry.Value -notmatch '(?m)^language:\s+"zh-CN"\s*$') {
    throw "$($entry.Key) 必须声明 language: `"zh-CN`""
  }
}

$stateSection = [regex]::Match($stateSpec, '(?ms)^states:\s*$.*?(?=^transitions:\s*$)').Value
$stateIds = Get-ListItemProperty $stateSection "id"
$eventIds = Get-ListItemProperty $eventSpec "id"
$roleIds = Get-ListItemProperty $roleSpec "id"
$levelIds = @(
  [regex]::Matches($classificationSpec, '(?m)^\s{2}-\s+id:\s+"(L[0-4])"\s*$') |
    ForEach-Object { $_.Groups[1].Value }
)
$fieldClassifications = @(
  [regex]::Matches($classificationSpec, '(?m)^\s{4}classification:\s+"(L[0-4])"\s*$') |
    ForEach-Object { $_.Groups[1].Value }
)

$requiredStates = @(
  "not_applied",
  "under_review",
  "rejected",
  "awaiting_confirmation",
  "awaiting_payment",
  "payment_failed",
  "pending_activation",
  "activation_blocked",
  "active",
  "suspended",
  "pending_restoration",
  "appealing",
  "revoked",
  "expired",
  "invalidated"
)
foreach ($state in $requiredStates) {
  if ($stateIds -notcontains $state) {
    throw "资格状态规范缺少状态: $state"
  }
}

$flexActiveState = Get-ScalarProperty $stateSpec "flex_quota_active_state"
if ($flexActiveState -ne "active") {
  throw "只有 active 状态可以声明为弹性配额状态"
}

$flexEnabledMatches = [regex]::Matches(
  $stateSection,
  '(?ms)^\s{2}-\s+id:\s+"([^"]+)"(?:(?!^\s{2}-\s+id:).)*?^\s{4}flex_quota_enabled:\s+true\s*$'
)
$flexEnabledStates = @($flexEnabledMatches | ForEach-Object { $_.Groups[1].Value })
if ($flexEnabledStates.Count -ne 1 -or $flexEnabledStates[0] -ne "active") {
  throw "flex_quota_enabled 只能在 active 状态为 true"
}

$transitionBlocks = [regex]::Matches(
  $stateSpec,
  '(?ms)^\s{2}-\s+id:\s+"([^"]+)"\s*\r?\n\s{4}from:\s+"([^"]+)"\s*\r?\n\s{4}to:\s+"([^"]+)"\s*\r?\n\s{4}event:\s+"([^"]+)"'
)
if ($transitionBlocks.Count -eq 0) {
  throw "资格状态规范未定义转换"
}

foreach ($transition in $transitionBlocks) {
  $transitionId = $transition.Groups[1].Value
  $fromState = $transition.Groups[2].Value
  $toState = $transition.Groups[3].Value
  $eventId = $transition.Groups[4].Value

  if ($stateIds -notcontains $fromState) {
    throw "转换 $transitionId 引用了未知源状态: $fromState"
  }
  if ($stateIds -notcontains $toState) {
    throw "转换 $transitionId 引用了未知目标状态: $toState"
  }
  if ($eventIds -notcontains $eventId) {
    throw "转换 $transitionId 引用了未知事件: $eventId"
  }
}

$requiredEvents = @(
  "flex_eligibility_application_submitted",
  "flex_eligibility_application_approved",
  "flex_eligibility_application_rejected",
  "flex_eligibility_payment_succeeded",
  "flex_eligibility_activated",
  "flex_eligibility_suspended",
  "flex_eligibility_restored",
  "flex_eligibility_revoked",
  "flex_eligibility_appeal_submitted",
  "flex_eligibility_expired",
  "flex_eligibility_refund_completed",
  "quota_evaluation_passed",
  "quota_evaluation_rejected",
  "quota_slot_occupied",
  "quota_slot_released",
  "quota_slot_finalized"
)
foreach ($event in $requiredEvents) {
  if ($eventIds -notcontains $event) {
    throw "资格事件规范缺少事件: $event"
  }
}

$eventClassifications = @(
  [regex]::Matches($eventSpec, '(?m)^\s{4}classification:\s+"(L[0-4])"\s*$') |
    ForEach-Object { $_.Groups[1].Value }
)
foreach ($classification in $eventClassifications) {
  if ($levelIds -notcontains $classification) {
    throw "事件规范引用了未知数据等级: $classification"
  }
}

$requiredDurations = @("PT24H", "P7D", "P30D")
foreach ($duration in $requiredDurations) {
  $count = [regex]::Matches($quotaSpec, "duration:\s+`"$([regex]::Escape($duration))`"").Count
  if ($count -ne 2) {
    throw "配额规范必须在基础和弹性策略中各定义一次 $duration"
  }
}

$quotaLimits = @(
  "duration: `"PT24H`"`r?`n        limit: 3",
  "duration: `"P7D`"`r?`n        limit: 10",
  "duration: `"P30D`"`r?`n        limit: 15",
  "duration: `"PT24H`"`r?`n        limit: 4",
  "duration: `"P7D`"`r?`n        limit: 12",
  "duration: `"P30D`"`r?`n        limit: 18"
)
foreach ($pattern in $quotaLimits) {
  if ($quotaSpec -notmatch $pattern) {
    throw "配额规范缺少预期窗口或上限: $pattern"
  }
}

Assert-Contains $quotaSpec @(
  'flex_policy_state: "active"',
  'all_other_states_policy: "base"',
  'lookback: "P90D"',
  'maximum_active_calendar_days: 60',
  'atomic_trip_acceptance_and_quota_occupancy',
  'cancel_in_flight_trips: false',
  'release_existing_occupancy: false'
) "配额规范"

$requiredRoles = @(
  "passenger",
  "driver",
  "customer_support",
  "reviewer",
  "senior_reviewer",
  "safety_officer",
  "safety_lead",
  "finance_officer",
  "finance_lead",
  "operations_officer",
  "operations_lead",
  "privacy_compliance",
  "data_analyst",
  "technical_operations",
  "auditor",
  "emergency_responder",
  "scheduler",
  "eligibility_system",
  "risk_system",
  "payment_callback",
  "payment_system"
)
foreach ($role in $requiredRoles) {
  if ($roleIds -notcontains $role) {
    throw "角色规范缺少角色: $role"
  }
}

$transitionActorLists = @(
  [regex]::Matches($stateSpec, '(?m)^\s{4}actors:\s+\[([^\]]*)\]\s*$') |
    ForEach-Object {
      [regex]::Matches($_.Groups[1].Value, '"([^"]+)"') |
        ForEach-Object { $_.Groups[1].Value }
    }
)
foreach ($actor in $transitionActorLists) {
  if ($roleIds -notcontains $actor) {
    throw "状态规范引用了未知角色: $actor"
  }
}

$allowedRoleLists = @(
  [regex]::Matches($authorizationSpec, '(?m)^\s{4}allowed_roles:\s+\[([^\]]*)\]\s*$') |
    ForEach-Object {
      [regex]::Matches($_.Groups[1].Value, '"([^"]+)"') |
        ForEach-Object { $_.Groups[1].Value }
    }
)
foreach ($role in $allowedRoleLists) {
  if ($roleIds -notcontains $role) {
    throw "授权规范引用了未知角色: $role"
  }
}

if ($levelIds.Count -ne 5) {
  throw "数据等级规范必须定义 L0 至 L4"
}
foreach ($level in @("L0", "L1", "L2", "L3", "L4")) {
  if ($levelIds -notcontains $level) {
    throw "数据等级规范缺少等级: $level"
  }
}
foreach ($classification in $fieldClassifications) {
  if ($levelIds -notcontains $classification) {
    throw "字段映射引用了未知数据等级: $classification"
  }
}

$authorizationClassifications = @(
  [regex]::Matches($authorizationSpec, '(?m)^\s{4}maximum_classification:\s+"(L[0-4])"\s*$') |
    ForEach-Object { $_.Groups[1].Value }
)
foreach ($classification in $authorizationClassifications) {
  if ($levelIds -notcontains $classification) {
    throw "授权规范引用了未知数据等级: $classification"
  }
}

Assert-Contains $authorizationSpec @(
  'default_effect: "deny"',
  'id: "quota.override"',
  'allowed_roles: []',
  'separation_of_duties: "not_original_decider"',
  'dual_approval_required: true',
  'temporary_access_required: true'
) "授权规范"

Write-Host "领域与安全规范检查通过。"
Write-Host "资格状态: $($stateIds.Count)"
Write-Host "领域事件: $($eventIds.Count)"
Write-Host "安全角色: $($roleIds.Count)"
Write-Host "数据等级: $($levelIds.Count)"
