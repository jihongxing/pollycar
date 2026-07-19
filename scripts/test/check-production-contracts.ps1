$ErrorActionPreference = "Stop"

$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$files = @(
  "spec\data\data-lifecycle.yaml",
  "spec\domain\vehicle-review.yaml",
  "spec\experiments\free-flex-trial.yaml",
  "spec\payments\zero-money-payment.yaml",
  "spec\platform\feature-gates.yaml",
  "spec\platform\persistence.yaml",
  "spec\finance\ledger.yaml",
  "spec\finance\reconciliation.yaml",
  "spec\finance\operator-funds.yaml"
)

foreach ($path in $files) {
  $full = Join-Path $repo $path
  if (-not (Test-Path -LiteralPath $full)) {
    throw "缺少生产准备契约: $path"
  }
  $content = Get-Content -LiteralPath $full -Raw
  if ($content -notmatch 'production_enabled: false') {
    throw "契约必须默认禁止生产启用: $path"
  }
}

$lifecycle = Get-Content -LiteralPath (Join-Path $repo $files[0]) -Raw
foreach ($required in @("P90D", "P30D", "P35D", "real_data_ingestion: false", "shanghai_pilot: false")) {
  if ($lifecycle -notmatch [regex]::Escape($required)) { throw "数据生命周期契约缺少: $required" }
}

$vehicle = Get-Content -LiteralPath (Join-Path $repo $files[1]) -Raw
foreach ($required in @("first_approval_max_age_years: 6", "automatic_exit_age_years: 8", "max_active_drivers_per_vehicle: 1", "real_vehicle_documents: false")) {
  if ($vehicle -notmatch [regex]::Escape($required)) { throw "车辆审核契约缺少: $required" }
}

$trial = Get-Content -LiteralPath (Join-Path $repo $files[2]) -Raw
foreach ($required in @("maximum_invited_drivers: 30", "paid_flex_trial: false", "real_user_invitation: false", "awaiting_payment_enabled: false")) {
  if ($trial -notmatch [regex]::Escape($required)) { throw "免费试验契约缺少: $required" }
}

$payment = Get-Content -LiteralPath (Join-Path $repo $files[3]) -Raw
foreach ($required in @("amount_minor: 0", "zero_money_payment: true", "real_payment: false", "production_credentials_allowed: false", 'required_state: "paid_pending_match"', "internal_sandbox_only: true", "production_enablement: false")) {
  if ($payment -notmatch [regex]::Escape($required)) { throw "零金额支付契约缺少: $required" }
}

$gates = Get-Content -LiteralPath (Join-Path $repo $files[4]) -Raw
foreach ($required in @("synthetic_admin_multi_organization: false", "synthetic_admin_operator_management: false", "synthetic_admin_trip_operations: false", "synthetic_admin_case_management: false", "synthetic_admin_finance_operations: false", "synthetic_admin_executive_dashboard: false", "synthetic_admin_audit_system: false", "synthetic_admin_data_reports: false", "real_admin_organization_accounts: false", "real_admin_finance_operations: false", "production_admin_enabled: false", "synthetic_financial_ledger: false", "synthetic_financial_reconciliation: false", "synthetic_operator_funds: false", "real_payment: false", "paid_flex_trial: false", "real_user_invitation: false", "shanghai_pilot: false", "real_data_ingestion: false", "real_sms_delivery: false", "real_phone_data: false", "production_authentication: false", "deny_on_missing: true")) {
  if ($gates -notmatch [regex]::Escape($required)) { throw "平台门禁契约缺少: $required" }
}

$reconciliation = Get-Content -LiteralPath (Join-Path $repo $files[7]) -Raw
foreach ($required in @(
  'id: "synthetic_financial_reconciliation"',
  "default_enabled: false",
  "real_provider_statement_allowed: false",
  "remote_database_allowed: false",
  "nonzero_difference_blocks_all_actions: true",
  "runtime_direct_write_allowed: false",
  'stage_7_status: "completed"',
  "stage_8_synthetic_implementation_allowed: true",
  "real_settlement_allowed: false",
  "real_payout_allowed: false",
  "production_enablement_allowed: false"
)) {
  if ($reconciliation -notmatch [regex]::Escape($required)) { throw "资金对账契约缺少: $required" }
}

$operatorFunds = Get-Content -LiteralPath (Join-Path $repo $files[8]) -Raw
foreach ($required in @(
  'id: "synthetic_operator_funds"',
  "default_enabled: false",
  "platform_rate_bps: 1500",
  "operator_rate_bps: 4500",
  "driver_rate_bps: 4000",
  'authoritative_source: "pollycar_finance.ledger_entries"',
  "operator_balance_table_allowed: false",
  "driver_balance_table_allowed: false",
  "wallet_table_allowed: false",
  'stage_8_status: "completed"',
  "real_settlement_allowed: false",
  "real_payout_allowed: false",
  "production_enablement_allowed: false"
)) {
  if ($operatorFunds -notmatch [regex]::Escape($required)) { throw "多运营主体资金契约缺少: $required" }
}

$persistence = Get-Content -LiteralPath (Join-Path $repo $files[5]) -Raw
foreach ($required in @(
  'default_adapter: "memory"',
  "local_database_only: true",
  "synthetic_data_only: true",
  "optimistic_concurrency: true",
  "same_transaction_as_aggregate: true",
  'claim_mode: "for_update_skip_locked"',
  "production_publisher_enabled: false"
)) {
  if ($persistence -notmatch [regex]::Escape($required)) { throw "持久化契约缺少: $required" }
}

$ledger = Get-Content -LiteralPath (Join-Path $repo $files[6]) -Raw
foreach ($required in @(
  "synthetic_data_only: true",
  'id: "synthetic_financial_ledger"',
  "default_enabled: false",
  "real_payment_required: false",
  "production_credentials_allowed: false",
  "remote_database_allowed: false",
  'dimension_key_algorithm: "postgres_jsonb_text_v1"',
  'sequence_definition: "bigint_generated_always_as_identity"',
  'canonicalization: "rfc8785_jcs_utf8"',
  'database_entrypoint: "post_runtime_ledger_transaction"',
  'function_signature: "pollycar_finance.post_runtime_ledger_transaction(p_request jsonb)"',
  'internal_core_function: "pollycar_finance.post_ledger_transaction(p_request jsonb)"',
  "runtime_internal_core_execute_allowed: false",
  'balance_constraint_timing: "deferrable_initially_deferred"',
  'outbox_table: "public.pollycar_outbox"',
  'search_path: "pg_catalog,pollycar_finance"',
  "public_execute_revoked: true",
  "direct_application_dml_allowed: false",
  "autocommit_posting_allowed: false",
  'reversal_entry_generation: "database_from_original_entries"',
  'stage_2_model_and_write_path_freeze: "completed"',
  'stage_3_database_invariant_prototype: "completed"',
  "formal_runtime_implementation_allowed: true",
  'proof_command: "pnpm test:ledger:stage3"',
  "real_postgresql_required: true",
  "mocked_database_proof_allowed: false"
)) {
  if ($ledger -notmatch [regex]::Escape($required)) { throw "账本契约缺少: $required" }
}

foreach ($path in @(
  "apps\server\migrations\0001_internal_sandbox.sql",
  "apps\server\src\persistence\postgres-transaction.ts",
  "apps\server\src\persistence\postgres-repository.ts",
  "apps\server\src\persistence\postgres-review-task-repository.ts",
  "apps\server\src\persistence\postgres-outbox.ts"
)) {
  if (-not (Test-Path -LiteralPath (Join-Path $repo $path))) {
    throw "缺少持久化实现: $path"
  }
}

Write-Host "生产准备机器契约检查通过。"
Write-Host "契约数量: $($files.Count)"
