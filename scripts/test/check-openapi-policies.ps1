$ErrorActionPreference = "Stop"

$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")

function Read-Required {
  param([string]$RelativePath)

  $path = Join-Path $repo $RelativePath
  if (-not (Test-Path -LiteralPath $path)) {
    throw "缺少 OpenAPI 治理文件: $RelativePath"
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

function Get-InlineArray {
  param(
    [string]$Body,
    [string]$Property
  )

  $match = [regex]::Match(
    $Body,
    "(?m)^\s{4}$([regex]::Escape($Property)):\s+\[([^\]]*)\]\s*$"
  )
  if (-not $match.Success) {
    return $null
  }

  return @(
    [regex]::Matches($match.Groups[1].Value, '"([^"]+)"') |
      ForEach-Object { $_.Groups[1].Value }
  )
}

$openApi = Read-Required "spec\api\openapi.yaml"
$policies = Read-Required "spec\api\operation-policies.yaml"
$authorization = Read-Required "spec\security\authorization-rules.yaml"
$roles = Read-Required "spec\security\roles.yaml"
$classifications = Read-Required "spec\security\data-classification.yaml"
$errors = Read-Required "spec\api\error-codes.yaml"
$scenarios = (
  Read-Required "spec\tests\eligibility-scenarios.yaml"
) + (
  Read-Required "spec\tests\admin-review-scenarios.yaml"
) + (
  Read-Required "spec\tests\mobility-scenarios.yaml"
) + (
  Read-Required "spec\tests\adult-eligibility-scenarios.yaml"
) + (
  Read-Required "spec\tests\admin-multi-organization-scenarios.yaml"
) + (
  Read-Required "spec\tests\admin-operator-management-scenarios.yaml"
) + (
  Read-Required "spec\tests\admin-trip-case-management-scenarios.yaml"
) + (
  Read-Required "spec\tests\admin-finance-operations-scenarios.yaml"
) + (
  Read-Required "spec\tests\admin-executive-dashboard-scenarios.yaml"
) + (
  Read-Required "spec\tests\admin-product-experience-scenarios.yaml"
)

if ($policies -notmatch '(?m)^production_enabled:\s+false\s*$') {
  throw "operation-policies.yaml 必须明确 production_enabled: false"
}

$roleIds = Get-ListIds $roles
$actionIds = Get-ListIds $authorization
$errorIds = Get-ListIds $errors
$scenarioIds = Get-ListIds $scenarios
$levelIds = @(
  [regex]::Matches($classifications, '(?m)^\s{2}-\s+id:\s+"(L[0-4])"\s*$') |
    ForEach-Object { $_.Groups[1].Value }
)

$authorizationBlocks = @{}
$authorizationMatches = [regex]::Matches(
  $authorization,
  '(?ms)^\s{2}-\s+id:\s+"([^"]+)"(?<body>.*?)(?=^\s{2}-\s+id:|^forbidden_role_action_pairs:|\z)'
)
foreach ($match in $authorizationMatches) {
  $authorizationBlocks[$match.Groups[1].Value] = $match.Groups["body"].Value
}

$openApiLines = Get-Content -LiteralPath (Join-Path $repo "spec\api\openapi.yaml")
$openApiOperations = @{}
$currentPath = $null
$currentMethod = $null
$operationStart = -1

for ($index = 0; $index -lt $openApiLines.Count; $index++) {
  $line = $openApiLines[$index]
  if ($line -match '^  (/[^:]+):\s*$') {
    $currentPath = $matches[1]
    $currentMethod = $null
    continue
  }
  if ($line -match '^    (get|post|put|patch|delete):\s*$') {
    $currentMethod = $matches[1].ToUpperInvariant()
    $operationStart = $index
    continue
  }
  if ($null -ne $currentMethod -and $line -match '^\s{6}operationId:\s+([A-Za-z][A-Za-z0-9]+)\s*$') {
    $operationId = $matches[1]
    $end = $index + 1
    while ($end -lt $openApiLines.Count) {
      if ($openApiLines[$end] -match '^  /[^:]+:\s*$' -or $openApiLines[$end] -match '^    (get|post|put|patch|delete):\s*$' -or $openApiLines[$end] -match '^components:\s*$') {
        break
      }
      $end++
    }
    $body = ($openApiLines[$operationStart..($end - 1)] -join "`n")
    $openApiOperations[$operationId] = [pscustomobject]@{
      Method = $currentMethod
      Path = $currentPath
      Body = $body
    }
  }
}

if ($openApiOperations.Count -eq 0) {
  throw "OpenAPI 未发现 operationId"
}

$policyBlocks = @{}
$policyMatches = [regex]::Matches(
  $policies,
  '(?ms)^\s{2}-\s+operation_id:\s+"([^"]+)"(?<body>.*?)(?=^\s{2}-\s+operation_id:|^global_rules:|\z)'
)
foreach ($match in $policyMatches) {
  $policyBlocks[$match.Groups[1].Value] = $match.Groups["body"].Value
}

$missingPolicies = @($openApiOperations.Keys | Where-Object { -not $policyBlocks.ContainsKey($_) })
if ($missingPolicies.Count -gt 0) {
  throw "OpenAPI 操作缺少策略映射: $($missingPolicies -join ', ')"
}

$extraPolicies = @($policyBlocks.Keys | Where-Object { -not $openApiOperations.ContainsKey($_) })
if ($extraPolicies.Count -gt 0) {
  throw "操作策略引用了不存在的 OpenAPI 操作: $($extraPolicies -join ', ')"
}

$writeMethods = @("POST", "PUT", "PATCH", "DELETE")
$validAudits = @("none", "standard", "sensitive", "strict")

foreach ($operationId in $openApiOperations.Keys) {
  $operation = $openApiOperations[$operationId]
  $policyBody = $policyBlocks[$operationId]

  $methodMatch = [regex]::Match($policyBody, '(?m)^\s{4}method:\s+"([^"]+)"\s*$')
  $pathMatch = [regex]::Match($policyBody, '(?m)^\s{4}path:\s+"([^"]+)"\s*$')
  $actionMatch = [regex]::Match($policyBody, '(?m)^\s{4}authorization_action:\s+"([^"]+)"\s*$')
  $requestClassMatch = [regex]::Match($policyBody, '(?m)^\s{4}request_classification:\s+"(L[0-4])"\s*$')
  $responseClassMatch = [regex]::Match($policyBody, '(?m)^\s{4}response_classification:\s+"(L[0-4])"\s*$')
  $idempotencyMatch = [regex]::Match($policyBody, '(?m)^\s{4}idempotency_required:\s+(true|false)\s*$')
  $auditMatch = [regex]::Match($policyBody, '(?m)^\s{4}audit:\s+"([^"]+)"\s*$')

  if (-not $methodMatch.Success -or $methodMatch.Groups[1].Value -ne $operation.Method) {
    throw "$operationId 的策略 method 与 OpenAPI 不一致"
  }
  if (-not $pathMatch.Success -or $pathMatch.Groups[1].Value -ne $operation.Path) {
    throw "$operationId 的策略 path 与 OpenAPI 不一致"
  }
  if (-not $actionMatch.Success -or $actionIds -notcontains $actionMatch.Groups[1].Value) {
    throw "$operationId 引用了未知授权动作"
  }
  if (-not $requestClassMatch.Success -or $levelIds -notcontains $requestClassMatch.Groups[1].Value) {
    throw "$operationId 请求数据等级无效"
  }
  if (-not $responseClassMatch.Success -or $levelIds -notcontains $responseClassMatch.Groups[1].Value) {
    throw "$operationId 响应数据等级无效"
  }
  if (-not $idempotencyMatch.Success) {
    throw "$operationId 缺少 idempotency_required"
  }
  if (-not $auditMatch.Success -or $validAudits -notcontains $auditMatch.Groups[1].Value) {
    throw "$operationId 审计等级无效"
  }

  $actors = Get-InlineArray $policyBody "actors"
  if ($null -eq $actors -or $actors.Count -eq 0) {
    throw "$operationId 缺少 actors"
  }
  foreach ($actor in $actors) {
    if ($roleIds -notcontains $actor) {
      throw "$operationId 引用了未知角色: $actor"
    }
  }

  $authorizationBody = $authorizationBlocks[$actionMatch.Groups[1].Value]
  $allowedRoles = Get-InlineArray $authorizationBody "allowed_roles"
  foreach ($actor in $actors) {
    if ($allowedRoles -notcontains $actor) {
      throw "$operationId 的角色 $actor 不在授权动作允许列表中"
    }
  }

  $allowedErrors = Get-InlineArray $policyBody "allowed_errors"
  if ($null -eq $allowedErrors -or $allowedErrors.Count -eq 0) {
    throw "$operationId 缺少 allowed_errors"
  }
  foreach ($errorCode in $allowedErrors) {
    if ($errorIds -notcontains $errorCode) {
      throw "$operationId 引用了未知错误码: $errorCode"
    }
  }

  $acceptanceScenarios = Get-InlineArray $policyBody "acceptance_scenarios"
  if ($null -eq $acceptanceScenarios -or $acceptanceScenarios.Count -eq 0) {
    throw "$operationId 缺少 acceptance_scenarios"
  }
  foreach ($scenario in $acceptanceScenarios) {
    if ($scenarioIds -notcontains $scenario) {
      throw "$operationId 引用了未知验收场景: $scenario"
    }
  }

  if ($operation.Body -notmatch '(?m)^\s{6}security:\s*$') {
    throw "$operationId 缺少身份认证声明"
  }

  if ($writeMethods -contains $operation.Method) {
    if ($idempotencyMatch.Groups[1].Value -ne "true") {
      throw "$operationId 是写操作，策略必须要求幂等"
    }
    if ($operation.Body -notmatch 'IdempotencyKey') {
      throw "$operationId 是写操作，但 OpenAPI 未引用 Idempotency-Key"
    }
  }

  if ($operation.Body -notmatch '#/components/responses/(ValidationError|AuthenticationError|AuthorizationError|NotFoundError|ConflictError|BusinessRuleError)') {
    throw "$operationId 缺少统一错误响应引用"
  }
}

if ($policies -notmatch '(?m)^\s{2}forbidden_actions:\s+\["quota.override"\]\s*$') {
  throw "操作策略必须禁止 quota.override"
}

$forbiddenTerms = @(
  "risk_score",
  "risk_threshold",
  "reporter_identity",
  "chat_message_body",
  "precise_location_trace",
  "full_payment_credential",
  "quota_override"
)
foreach ($term in $forbiddenTerms) {
  if ($openApi -match [regex]::Escape($term)) {
    throw "OpenAPI 暴露了禁止字段或能力: $term"
  }
}

Write-Host "OpenAPI 操作策略检查通过。"
Write-Host "OpenAPI 操作: $($openApiOperations.Count)"
Write-Host "操作策略: $($policyBlocks.Count)"
