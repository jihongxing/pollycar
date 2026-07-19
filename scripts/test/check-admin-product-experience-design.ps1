$ErrorActionPreference = "Stop"
$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")

$required = @(
  "docs\product\admin\29-运营后台产品化高保真方案.md",
  "docs\product\admin\30-运营后台产品化实施前设计评审.md",
  "spec\admin\admin-product-experience.yaml",
  "spec\tests\admin-product-experience-scenarios.yaml",
  "spec\meta\admin-product-experience.schema.json",
  "spec\meta\admin-product-experience-scenarios.schema.json",
  "docs\product\prototypes\admin-productization\index.html",
  "docs\product\prototypes\admin-productization\styles.css",
  "docs\product\prototypes\admin-productization\prototype.js",
  "docs\product\prototypes\admin-productization\finalized.json"
)
foreach ($path in $required) {
  if (-not (Test-Path -LiteralPath (Join-Path $repo $path))) { throw "缺少运营后台产品化设计文件: $path" }
}

$contract = Get-Content -LiteralPath (Join-Path $repo "spec\admin\admin-product-experience.yaml") -Raw
foreach ($rule in @(
  'status: "design_frozen"',
  "implementation_approved: true",
  'method: "signed_cursor"',
  "default_page_size: 25",
  "maximum_page_size: 100",
  "cursor_binds_query_digest: true",
  "cursor_binds_scope_digest: true",
  "return_state_restoration_required: true",
  "select_all_results_forbidden: true",
  "resource_version_required: true",
  "idempotency_key_required: true",
  "organization_scope_reauthorization_required: true",
  "role_action_reauthorization_required: true",
  'result_states: ["confirming", "confirmed", "error"]',
  "duplicate_submit_forbidden_while_confirming: true",
  "append_only_audit_required: true",
  "completed_task_write_forbidden: true",
  'feature_gate: "synthetic_admin_operator_management"',
  'list: "/admin/operators"',
  'detail: "/admin/operators/:operator_id"',
  'feature_gate: "synthetic_admin_driver_vehicle"',
  'driver_list: "/admin/fleet/drivers"',
  'vehicle_list: "/admin/fleet/vehicles"',
  'feature_gate: "synthetic_admin_trip_operations"',
  'list: "/admin/trips"',
  'detail: "/admin/trips/:trip_id"',
  'feature_gates: ["synthetic_admin_case_management", "synthetic_admin_trip_operations"]',
  'list: "/admin/cases"',
  'support_detail: "/admin/cases/support/:case_id"',
  'safety_detail: "/admin/cases/safety/:case_id"',
  'feature_gate: "synthetic_admin_executive_dashboard"',
  'list: "/admin/executive"',
  'detail: "/admin/executive/:kind/:resource_id"',
  'resource_kinds: ["decision_item", "export_request", "operator_health", "metric"]',
  'feature_gate: "synthetic_admin_audit_system"',
  'list: "/admin/governance"',
  'detail: "/admin/governance/:kind/:resource_id"',
  'resource_kinds: ["event", "investigation"]',
  'feature_gate: "synthetic_admin_data_reports"',
  'list: "/admin/reports"',
  'detail: "/admin/reports/:report_id"',
  'report_domains: ["operations", "finance", "safety_compliance", "audit"]',
  "person_level_data_available: false",
  "real_data_available: false",
  "export_available: false",
  "duplicate_business_audit_copy_forbidden: true",
  "original_event_update_allowed: false",
  "privacy_and_domain_dual_review_required: true",
  "direct_business_approval_allowed: false",
  'role_and_state_intersection_required: true',
  "operator_role_read_own_scope_only: true",
  "auditor_read_only: true",
  "action_reason_required: true",
  "server_authoritative: true",
  "client_role_menu_mapping_forbidden: true",
  "authentication_code_forbidden_before_approval: false",
  "navigation_api_forbidden_before_approval: false",
  "pagination_api_forbidden_before_approval: false"
)) {
  if ($contract -notmatch [regex]::Escape($rule)) { throw "运营后台产品化契约缺少: $rule" }
}

$scenarios = Get-Content -LiteralPath (Join-Path $repo "spec\tests\admin-product-experience-scenarios.yaml") -Raw
$scenarioCount = ([regex]::Matches($scenarios, '(?m)^\s{2}- id: "ADMIN-UX-[0-9]{3}"\s*$')).Count
if ($scenarioCount -ne 88) { throw "运营后台产品化验收场景应为 88 项，实际为 $scenarioCount" }
foreach ($category in @("entry", "identity", "navigation", "shell", "pagination", "language", "responsive", "accessibility", "recovery", "operations_task", "operator_management", "driver_vehicle", "trip_operations", "support_safety", "finance_operations", "executive_dashboard", "audit_system", "data_reports")) {
  if ($scenarios -notmatch [regex]::Escape("category: $category")) { throw "运营后台产品化场景缺少类别: $category" }
}

$prototype = Get-Content -LiteralPath (Join-Path $repo "docs\product\prototypes\admin-productization\index.html") -Raw
$viewCount = ([regex]::Matches($prototype, 'data-view="(login|activation|identity|platform|operator|list|states|language)"')).Count
if ($viewCount -ne 8) { throw "运营后台产品化高保真视图应为 8 个，实际为 $viewCount" }
foreach ($term in @(
  "登录运营工作台",
  "设置多因素验证",
  "今天以哪个身份工作",
  "平台运营工作台",
  "本公司运营工作台",
  "统一搜索、筛选、排序和游标分页",
  "权限、会话与异常状态",
  "让运营人员看到业务，不是架构图"
)) {
  if ($prototype -notmatch [regex]::Escape($term)) { throw "运营后台产品化高保真原型缺少: $term" }
}

$gates = Get-Content -LiteralPath (Join-Path $repo "spec\platform\feature-gates.yaml") -Raw
foreach ($rule in @(
  "synthetic_admin_authentication: false",
  "synthetic_admin_role_access_matrix: false",
  "real_admin_organization_accounts: false",
  "production_authentication: false",
  "production_admin_enabled: false"
)) {
  if ($gates -notmatch [regex]::Escape($rule)) { throw "运营后台产品化设计门禁缺少: $rule" }
}

Write-Host "运营后台产品化高保真方案与实施前评审检查通过。"
Write-Host "高保真视图: $viewCount"
Write-Host "验收场景: $scenarioCount"
