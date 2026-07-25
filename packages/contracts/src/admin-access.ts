export type AdminOrganizationType = "platform" | "operator" | "governance";

export type AdminFunctionalRole =
  | "platform_operations_lead"
  | "operator_administrator"
  | "operator_operations_lead"
  | "customer_support_agent"
  | "safety_officer"
  | "safety_lead"
  | "finance_officer"
  | "finance_lead"
  | "operator_finance_officer"
  | "operator_finance_lead"
  | "executive_sponsor"
  | "operations_lead"
  | "privacy_compliance"
  | "operator_executive"
  | "data_analyst"
  | "auditor"
  | "technical_operations"
  | "governance_observer";

export type AdminDataClassification = "internal" | "sensitive" | "restricted";

export type AdminModuleId =
  | "platform_workbench"
  | "operator_workbench"
  | "operator_directory"
  | "operator_management"
  | "operator_onboarding"
  | "driver_directory"
  | "vehicle_directory"
  | "primary_operator_relationships"
  | "trip_operations"
  | "trip_directory"
  | "support_cases"
  | "safety_cases"
  | "evidence_access"
  | "command_recovery"
  | "finance_operations"
  | "finance_allocation_settlement"
  | "finance_driver_payouts"
  | "finance_refund_reversals"
  | "finance_reconciliation_cases"
  | "finance_business_day_close"
  | "finance_ledger"
  | "executive_overview"
  | "executive_operations_health"
  | "executive_operator_health"
  | "executive_finance_safety"
  | "executive_safety_compliance"
  | "executive_decisions_metrics"
  | "data_reports"
  | "notifications"
  | "audit";

export type AdminOrganizationContext = Readonly<{
  organizationType: AdminOrganizationType;
  organizationId: string;
  organizationName: string;
  cityScopes: readonly string[];
  operatorScopes: readonly string[];
  purpose: "platform_operations" | "operator_operations" | "governance_observation";
  fixed: boolean;
}>;

export type AdminInternalSession = Readonly<{
  internalUserId: string;
  displayName: string;
  membershipId: string;
  functionalRoles: readonly AdminFunctionalRole[];
  maximumDataClassification: AdminDataClassification;
  context: AdminOrganizationContext;
  availableContexts: readonly AdminOrganizationContext[];
  visibleModules: readonly AdminModuleId[];
  temporaryGrants: readonly AdminTemporaryGrant[];
  synthetic: true;
}>;

export type AdminTemporaryGrant = Readonly<{
  grantId: string;
  ticketId: string;
  purpose: string;
  scopeLabel: string;
  expiresAt: string;
  state: "active";
  synthetic: true;
}>;

export type AdminAccessDecision = Readonly<{
  accessDecisionId: string;
  result: "allow" | "deny";
  action: string;
  reasonCode: string;
  context: AdminOrganizationContext;
  occurredAt: string;
  synthetic: true;
}>;

export type AdminAuditEvent = Readonly<{
  eventId: string;
  eventType:
    | "internal_authentication_succeeded"
    | "organization_context_changed"
    | "access_allowed"
    | "access_denied"
    | "operator_profile_viewed"
    | "onboarding_decision_recorded"
    | "operator_lifecycle_changed"
    | "city_capability_changed"
    | "entity_360_viewed"
    | "migration_acknowledged"
    | "migration_reviewed"
    | "migration_scheduled"
    | "migration_effective"
    | "migration_blocked"
    | "trip_operation_task_changed"
    | "trip_domain_action_requested"
    | "support_case_changed"
    | "support_case_escalated"
    | "safety_investigation_submitted"
    | "safety_restoration_reviewed"
    | "safety_restoration_blocked"
    | "collaboration_task_changed"
    | "evidence_access_requested"
    | "evidence_access_approved"
    | "evidence_field_viewed"
    | "evidence_access_revoked"
    | "command_recovery_queried"
    | "finance_operation_changed"
    | "finance_review_recorded"
    | "finance_amount_viewed"
    | "finance_command_recovery_queried"
    | "executive_dashboard_viewed"
    | "executive_dashboard_filter_changed"
    | "executive_dashboard_drilldown_viewed"
    | "executive_metric_definition_viewed"
    | "executive_decision_opinion_recorded"
    | "executive_export_requested"
    | "executive_export_privacy_reviewed"
    | "executive_export_domain_reviewed"
    | "executive_export_revoked"
    | "executive_export_downloaded"
    | "audit_event_viewed"
    | "audit_investigation_opened"
    | "audit_investigation_assigned"
    | "audit_investigation_note_added"
    | "audit_investigation_resolved"
    | "audit_investigation_reopened"
    | "data_report_viewed"
    | "data_report_refreshed"
    | "admin_global_search_performed"
    | "admin_membership_viewed"
    | "admin_membership_suspended"
    | "admin_membership_restored";
  occurredAt: string;
  actorInternalUserId: string;
  actorMembershipId: string;
  organizationType: AdminOrganizationType;
  organizationId: string;
  requestId: string;
  correlationId: string;
  result: "succeeded" | "allowed" | "denied";
  action?: string;
  accessDecisionId?: string;
  resourceType?: string;
  resourceId?: string;
  reasonCode?: string;
  previousContextDigest?: string;
  nextContextDigest?: string;
  synthetic: true;
}>;

export type AdminTaskSummary = Readonly<{
  taskId: string;
  category: "operator" | "safety" | "mobility" | "support";
  title: string;
  description: string;
  dueLabel: string;
  priority: "high" | "medium" | "normal";
  operatorId?: string;
  synthetic: true;
}>;

export type AdminPlatformWorkbench = Readonly<{
  context: AdminOrganizationContext;
  metrics: Readonly<{
    pendingTasks: number;
    dueSoon: number;
    blockingCases: number;
    operatorsInScope: number;
  }>;
  tasks: readonly AdminTaskSummary[];
  operatorHealth: readonly Readonly<{
    operatorId: string;
    operatorName: string;
    status: "normal" | "attention" | "blocked";
    summary: string;
  }>[];
  realAccountsEnabled: false;
  financeOperationsEnabled: false;
  productionEnabled: false;
  synthetic: true;
}>;

export type AdminOperatorWorkbench = Readonly<{
  context: AdminOrganizationContext;
  operatorId: string;
  operatorName: string;
  metrics: Readonly<{
    pendingTasks: number;
    expiringDocuments: number;
    scheduledTrips: number;
    payoutAttention: number;
  }>;
  tasks: readonly AdminTaskSummary[];
  financeReadOnly: true;
  crossOperatorAccessAllowed: false;
  realAccountsEnabled: false;
  productionEnabled: false;
  synthetic: true;
}>;

export type AdminOperatorDirectoryEntry = Readonly<{
  operatorId: string;
  operatorName: string;
  syntheticReference: string;
  contactMasked: string;
  cities: readonly string[];
  capabilities: readonly string[];
  activeDrivers: number;
  activeVehicles: number;
  serviceStatus: "normal" | "attention" | "blocked";
  financeGateSummary: string;
  pendingTaskCount: number;
  lifecycleActionsAllowed: false;
  sensitiveFieldsMasked: true;
  synthetic: true;
}>;

export interface AdminAccessClient {
  getSession(): Promise<AdminInternalSession>;
  switchContext(organizationId: string): Promise<AdminInternalSession>;
  getPlatformWorkbench(): Promise<AdminPlatformWorkbench>;
  getOperatorWorkbench(): Promise<AdminOperatorWorkbench>;
  listOperatorDirectory(): Promise<readonly AdminOperatorDirectoryEntry[]>;
  listAuditEvents(): Promise<readonly AdminAuditEvent[]>;
}
