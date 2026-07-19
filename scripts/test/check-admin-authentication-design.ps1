$ErrorActionPreference = "Stop"

$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")

$required = @(
  "docs\decisions\0020-运营后台账号认证与工作身份会话.md",
  "docs\product\admin\27-后台账号认证与工作身份契约.md",
  "spec\admin\authentication-session.yaml",
  "spec\tests\admin-authentication-scenarios.yaml",
  "spec\meta\authentication-session.schema.json",
  "spec\meta\admin-authentication-scenarios.schema.json"
)

foreach ($path in $required) {
  if (-not (Test-Path -LiteralPath (Join-Path $repo $path))) {
    throw "缺少运营后台账号认证实施前设计文件: $path"
  }
}

$contract = Get-Content -LiteralPath (Join-Path $repo "spec\admin\authentication-session.yaml") -Raw
foreach ($rule in @(
  'status: "design_frozen"',
  "implementation_approved: true",
  'id: "synthetic_admin_authentication"',
  "default_enabled: false",
  '"internal_sandbox"',
  '"synthetic_admin_multi_organization"',
  "public_registration_allowed: false",
  "shared_account_allowed: false",
  'type: "work_email"',
  'method: "totp"',
  'password_digest_algorithm: "Argon2id"',
  'access_token_ttl: "PT15M"',
  'absolute_ttl: "PT8H"',
  'idle_timeout: "PT30M"',
  "refresh_token_replay_revokes_family: true",
  "one_work_identity_per_session: true",
  "switch_requires_new_session: true",
  "operator_cross_switch_forbidden: true",
  "runtime_code_forbidden_before_approval: false",
  "production_enablement_allowed: false"
)) {
  if ($contract -notmatch [regex]::Escape($rule)) {
    throw "运营后台账号认证契约缺少: $rule"
  }
}

$scenarios = Get-Content -LiteralPath (Join-Path $repo "spec\tests\admin-authentication-scenarios.yaml") -Raw
$scenarioCount = ([regex]::Matches($scenarios, '(?m)^\s{2}- id: "ADMIN-AUTH-[0-9]{3}"\s*$')).Count
if ($scenarioCount -ne 32) {
  throw "运营后台账号认证验收场景应为 32 项，实际为 $scenarioCount"
}

foreach ($category in @(
  "feature_gate",
  "implementation_gate",
  "invitation",
  "activation",
  "authentication",
  "mfa",
  "session",
  "work_identity",
  "membership",
  "revocation",
  "recovery",
  "organization_scope",
  "audit"
)) {
  if ($scenarios -notmatch [regex]::Escape("category: $category")) {
    throw "运营后台账号认证验收场景缺少类别: $category"
  }
}

foreach ($rule in @(
  "无邀请不能注册后台账号",
  "运营公司管理员不能邀请其他运营公司人员",
  "密码正确但未通过 MFA 不签发业务会话",
  "同一时间窗口内 TOTP 验证码不能重放",
  "刷新令牌重放撤销整个会话族",
  "单个会话不能合并平台和运营公司权限",
  "运营公司身份不能切换到其他运营公司",
  "工作身份切换后旧访问令牌立即失效",
  "成员关系失效后不能继续选择或使用该身份",
  "认证审计不得记录密码或令牌原文"
)) {
  if ($scenarios -notmatch [regex]::Escape($rule)) {
    throw "运营后台账号认证验收场景缺少关键规则: $rule"
  }
}

$errorSpec = Get-Content -LiteralPath (Join-Path $repo "spec\api\error-codes.yaml") -Raw
$scenarioErrors = @(
  [regex]::Matches($scenarios, 'expected_error:\s+"([A-Z][A-Z0-9_]+)"') |
    ForEach-Object { $_.Groups[1].Value } |
    Sort-Object -Unique
)
foreach ($errorCode in $scenarioErrors) {
  if ($errorSpec -notmatch [regex]::Escape("id: `"$errorCode`"")) {
    throw "运营后台账号认证场景引用了未注册错误码: $errorCode"
  }
}

$gates = Get-Content -LiteralPath (Join-Path $repo "spec\platform\feature-gates.yaml") -Raw
foreach ($rule in @(
  "synthetic_admin_authentication: false",
  'synthetic_admin_authentication: ["internal_sandbox", "synthetic_admin_multi_organization"]',
  "real_admin_organization_accounts: false",
  "production_authentication: false",
  "production_admin_enabled: false"
)) {
  if ($gates -notmatch [regex]::Escape($rule)) {
    throw "运营后台账号认证功能门禁缺少: $rule"
  }
}

$decision = Get-Content -LiteralPath (Join-Path $repo "docs\decisions\0020-运营后台账号认证与工作身份会话.md") -Raw
foreach ($rejected in @(
  "公众注册",
  "独立账号系统",
  "前端切换当前组织",
  "短信验证码作为后台 MFA",
  "共享账号"
)) {
  if ($decision -notmatch [regex]::Escape($rejected)) {
    throw "运营后台账号认证决策缺少否决方案: $rejected"
  }
}

Write-Host "运营后台账号认证与工作身份实施前契约检查通过。"
Write-Host "认证验收场景: $scenarioCount"
Write-Host "认证错误码引用: $($scenarioErrors.Count)"
