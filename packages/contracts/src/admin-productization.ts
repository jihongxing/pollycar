import type {
  AdminAuditEvent,
  AdminDataClassification,
  AdminOrganizationContext,
} from "./admin-access.js";

export type AdminProductRole =
  | "platform_access_administrator"
  | "operations_officer"
  | "operations_lead"
  | "operator_management_officer"
  | "reviewer"
  | "senior_reviewer"
  | "customer_support"
  | "support_lead"
  | "safety_officer"
  | "safety_lead"
  | "finance_officer"
  | "finance_lead"
  | "privacy_compliance"
  | "data_analyst"
  | "auditor"
  | "technical_operations"
  | "executive_sponsor"
  | "operator_account_administrator"
  | "operator_operations_lead"
  | "operator_fleet_officer"
  | "operator_customer_support"
  | "operator_safety_liaison"
  | "operator_finance_officer"
  | "operator_finance_lead"
  | "operator_auditor"
  | "operator_executive";

export type AdminNavigationDomain =
  | "workbench"
  | "organization_accounts"
  | "operator_management"
  | "driver_vehicle"
  | "trip_operations"
  | "support_safety"
  | "finance_operations"
  | "data_reports"
  | "executive_dashboard"
  | "audit_system";

export type AdminNavigationItem = Readonly<{
  id: AdminNavigationDomain;
  label: string;
  route: string;
  availability: "available" | "unavailable";
  unavailableReason?: "not_implemented";
  badge?: number;
  children: readonly Readonly<{
    id: string;
    label: string;
    route: string;
  }>[];
}>;

export type AdminNavigationManifest = Readonly<{
  navigationVersion: string;
  workIdentityId: string;
  organizationContext: AdminOrganizationContext;
  roleIds: readonly AdminProductRole[];
  items: readonly AdminNavigationItem[];
  routePermissions: readonly string[];
  operationPermissions: readonly string[];
  fieldProfiles: readonly string[];
  exportProfiles: readonly string[];
  scopeDigest: string;
  expiresAt: string;
  synthetic: true;
}>;

export type AdminWorkIdentitySummary = Readonly<{
  workIdentityId: string;
  legacyAccessToken: string;
  type: "platform" | "operator";
  organizationId: string;
  organizationName: string;
  productRole: AdminProductRole;
  productRoleName: string;
  cityScopes: readonly string[];
  recentUsedAt?: string;
  maximumDataClassification: AdminDataClassification;
  synthetic: true;
}>;

export type AdminLoginChallenge = Readonly<{
  challengeId: string;
  expiresAt: string;
  factor: "totp";
  synthetic: true;
}>;

export type AdminMfaVerification = Readonly<{
  selectionToken: string;
  workIdentities: readonly AdminWorkIdentitySummary[];
  expiresAt: string;
  synthetic: true;
}>;

export type AdminProductSession = Readonly<{
  accessToken: string;
  refreshToken: string;
  sessionFamilyId: string;
  workIdentity: AdminWorkIdentitySummary;
  navigation: AdminNavigationManifest;
  accessTokenExpiresAt: string;
  absoluteExpiresAt: string;
  idleExpiresAt: string;
  synthetic: true;
}>;

export type AdminInvitationSummary = Readonly<{
  invitationToken: string;
  workEmailMasked: string;
  organizationName: string;
  productRoleName: string;
  cityScopes: readonly string[];
  expiresAt: string;
  state: "pending";
  synthetic: true;
}>;

export type AdminCursorPageInfo = Readonly<{
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
  approximateTotal: number | null;
}>;

export type AdminOperationsTask = Readonly<{
  taskId: string;
  title: string;
  operatorName: string;
  domain: "operator" | "driver_vehicle" | "trip" | "support_safety";
  assigneeName: string;
  dueAt: string;
  status: "unassigned" | "processing" | "waiting_review" | "blocked" | "completed";
  priority: "normal" | "attention" | "high";
  version: number;
  updatedAt: string;
  completedAt?: string;
  synthetic: true;
}>;

export type AdminOperationsTaskPage = Readonly<{
  items: readonly AdminOperationsTask[];
  pageInfo: AdminCursorPageInfo;
  queryDigest: string;
  scopeDigest: string;
  asOf: string;
  synthetic: true;
}>;

export type AdminOperationsTaskQuery = Readonly<{
  pageSize?: 25 | 50 | 100;
  after?: string;
  before?: string;
  search?: string;
  status?: AdminOperationsTask["status"];
  sort?: "due_at_asc" | "updated_at_desc";
}>;

export type AdminOperationsTaskDetail = Readonly<{
  task: AdminOperationsTask;
  organizationScope: Readonly<{
    organizationId: string;
    organizationName: string;
    cityScopes: readonly string[];
  }>;
  allowedActions: readonly AdminOperationsTaskAction[];
  auditTrail: readonly Readonly<{
    eventId: string;
    action:
      | "task_created"
      | "scope_checked"
      | "task_assigned"
      | "task_processed"
      | "task_reviewed";
    actorLabel: string;
    actorRole?: string;
    occurredAt: string;
    previousStatus?: AdminOperationsTask["status"];
    nextStatus?: AdminOperationsTask["status"];
    note?: string;
  }>[];
  synthetic: true;
}>;

export type AdminOperationsTaskAction = "assign" | "process" | "review";

export type AdminOperationsTaskActionCommand = Readonly<{
  action: AdminOperationsTaskAction;
  expectedVersion: number;
  idempotencyKey: string;
  note?: string;
}>;

export type AdminOperationsTaskActionResult = Readonly<{
  operationId: string;
  resultState: "confirmed";
  idempotentReplay: boolean;
  detail: AdminOperationsTaskDetail;
  synthetic: true;
}>;

export type AdminOperatorDirectoryItem = Readonly<{
  operatorId: string;
  operatorName: string;
  syntheticReference: string;
  lifecycleState: AdminOperatorLifecycleState;
  cityNames: readonly string[];
  activeDrivers: number;
  activeVehicles: number;
  pendingTasks: number;
  resourceVersion: number;
  updatedAt: string;
  synthetic: true;
}>;

export type AdminOperatorDirectoryQuery = Readonly<{
  pageSize?: 25 | 50 | 100;
  after?: string;
  before?: string;
  search?: string;
  lifecycleState?: AdminOperatorLifecycleState;
  sort?: "operator_name_asc" | "updated_at_desc";
}>;

export type AdminOperatorDirectoryPage = Readonly<{
  summary: Readonly<{
    totalOperators: number;
    activeOperators: number;
    attentionOperators: number;
    activeDrivers: number;
    activeVehicles: number;
  }>;
  items: readonly AdminOperatorDirectoryItem[];
  pageInfo: AdminCursorPageInfo;
  queryDigest: string;
  scopeDigest: string;
  asOf: string;
  synthetic: true;
}>;

export type AdminOperatorAction = "restrict" | "reactivate";

export type AdminOperatorDetail = Readonly<{
  operator: AdminOperatorDirectoryItem & Readonly<{
    contactMasked: string;
    capabilities: readonly AdminOperatorCityCapability[];
    blockers: readonly Readonly<{
      blockerType: "onboarding" | "vehicle_document" | "reconciliation" | "fund_case";
      summary: string;
      blocking: boolean;
    }>[];
  }>;
  organizationScope: Readonly<{
    organizationId: string;
    organizationName: string;
    cityScopes: readonly string[];
  }>;
  allowedActions: readonly AdminOperatorAction[];
  auditTrail: readonly Readonly<{
    eventId: string;
    action: "operator_profile_viewed" | "operator_restricted" | "operator_reactivated";
    actorLabel: string;
    actorRole: string;
    occurredAt: string;
    previousState?: AdminOperatorLifecycleState;
    nextState?: AdminOperatorLifecycleState;
    note?: string;
  }>[];
  synthetic: true;
}>;

export type AdminOperatorActionCommand = Readonly<{
  action: AdminOperatorAction;
  expectedVersion: number;
  idempotencyKey: string;
  note: string;
}>;

export type AdminOperatorActionResult = Readonly<{
  operationId: string;
  resultState: "confirmed";
  idempotentReplay: boolean;
  detail: AdminOperatorDetail;
  synthetic: true;
}>;

export type AdminDriverDirectoryItem = Readonly<{
  driverAccountId: string;
  displayNameMasked: string;
  phoneMasked: string;
  operatorId: string;
  operatorName: string;
  eligibilityState: AdminDriver360["eligibilityState"];
  vehicleCount: number;
  reviewAttentionCount: number;
  updatedAt: string;
  synthetic: true;
}>;

export type AdminDriverDirectoryQuery = Readonly<{
  pageSize?: 25 | 50 | 100;
  after?: string;
  before?: string;
  search?: string;
  eligibilityState?: AdminDriver360["eligibilityState"];
  sort?: "driver_name_asc" | "updated_at_desc";
}>;

export type AdminDriverDirectoryPage = Readonly<{
  summary: Readonly<{
    totalDrivers: number;
    serviceableDrivers: number;
    restrictedDrivers: number;
    reviewAttentionDrivers: number;
  }>;
  items: readonly AdminDriverDirectoryItem[];
  pageInfo: AdminCursorPageInfo;
  queryDigest: string;
  scopeDigest: string;
  asOf: string;
  synthetic: true;
}>;

export type AdminDriverDetail = Readonly<{
  driver: AdminDriverDirectoryItem;
  profile: AdminDriver360;
  organizationScope: Readonly<{
    organizationId: string;
    organizationName: string;
    cityScopes: readonly string[];
  }>;
  linkedVehicles: readonly AdminVehicleDirectoryItem[];
  auditTrail: readonly Readonly<{
    eventId: string;
    action: "driver_profile_viewed";
    actorLabel: string;
    actorRole: string;
    occurredAt: string;
  }>[];
  synthetic: true;
}>;

export type AdminVehicleDirectoryItem = Readonly<{
  vehicleId: string;
  plateMasked: string;
  vehicleSummary: string;
  driverAccountId: string;
  driverNameMasked: string;
  operatorId: string;
  operatorName: string;
  reviewState: AdminVehicle360["review"]["state"];
  reviewTaskId?: string;
  reviewTaskStatus?: AdminReviewTaskStatus;
  resourceVersion: number;
  updatedAt: string;
  synthetic: true;
}>;

export type AdminVehicleDirectoryQuery = Readonly<{
  pageSize?: 25 | 50 | 100;
  after?: string;
  before?: string;
  search?: string;
  reviewState?: AdminVehicle360["review"]["state"];
  sort?: "plate_asc" | "updated_at_desc";
}>;

export type AdminVehicleDirectoryPage = Readonly<{
  summary: Readonly<{
    totalVehicles: number;
    approvedVehicles: number;
    underReviewVehicles: number;
    changesRequestedVehicles: number;
    rejectedVehicles: number;
    openReviewTasks: number;
  }>;
  items: readonly AdminVehicleDirectoryItem[];
  pageInfo: AdminCursorPageInfo;
  queryDigest: string;
  scopeDigest: string;
  asOf: string;
  synthetic: true;
}>;

export type AdminVehicleReviewAction =
  | "claim"
  | "request_material"
  | "approve"
  | "reject";

export type AdminVehicleDetail = Readonly<{
  vehicle: AdminVehicleDirectoryItem;
  profile: AdminVehicle360;
  driver: AdminDriverDirectoryItem;
  organizationScope: Readonly<{
    organizationId: string;
    organizationName: string;
    cityScopes: readonly string[];
  }>;
  reviewTask?: AdminReviewTaskDetail;
  allowedActions: readonly AdminVehicleReviewAction[];
  auditTrail: readonly AdminReviewAuditEntry[];
  synthetic: true;
}>;

export type AdminVehicleReviewActionCommand = Readonly<{
  action: AdminVehicleReviewAction;
  expectedTaskVersion: number;
  expectedVehicleReviewVersion: number;
  idempotencyKey: string;
  reasonCode?: AdminReviewMaterialReason | RejectVehicleReviewAdminCommand["reasonCode"];
}>;

export type AdminVehicleReviewActionResult = Readonly<{
  operationId: string;
  resultState: "confirmed";
  idempotentReplay: boolean;
  detail: AdminVehicleDetail;
  synthetic: true;
}>;

export type AdminTripDirectoryItem = Readonly<{
  tripId: string;
  operatorId: string;
  operatorName: string;
  authoritativeState: AdminTrip360["authoritativeState"];
  authoritativeVersion: number;
  routeSummary: string;
  passengerMasked: string;
  driverMasked: string;
  vehicleMasked: string;
  operationTaskId?: string;
  operationCategory?: AdminTripOperationTask["category"];
  operationState?: AdminTripOperationTask["state"];
  priority?: AdminTripOperationTask["priority"];
  relatedSupportCaseId?: string;
  relatedSafetyCaseId?: string;
  updatedAt: string;
  synthetic: true;
}>;

export type AdminTripDirectoryQuery = Readonly<{
  pageSize?: 25 | 50 | 100;
  after?: string;
  before?: string;
  search?: string;
  authoritativeState?: AdminTrip360["authoritativeState"];
  operationState?: AdminTripOperationTask["state"];
  sort?: "updated_at_desc" | "trip_id_asc";
}>;

export type AdminTripDirectoryPage = Readonly<{
  summary: Readonly<{
    totalTrips: number;
    activeTrips: number;
    attentionTrips: number;
    safetyFrozenTrips: number;
    awaitingAuthoritativeResultTrips: number;
  }>;
  items: readonly AdminTripDirectoryItem[];
  pageInfo: AdminCursorPageInfo;
  queryDigest: string;
  scopeDigest: string;
  asOf: string;
  synthetic: true;
}>;

export type AdminTripOperationAction =
  | "triage"
  | "request_domain_action";

export type AdminTripDetail = Readonly<{
  trip: AdminTripDirectoryItem;
  profile: AdminTrip360;
  operationTask?: AdminTripOperationTask;
  relatedCases: Readonly<{
    supportCaseId?: string;
    safetyCaseId?: string;
  }>;
  organizationScope: Readonly<{
    organizationId: string;
    organizationName: string;
    cityScopes: readonly string[];
  }>;
  allowedActions: readonly AdminTripOperationAction[];
  auditTrail: readonly Readonly<{
    eventId: string;
    action:
      | "trip_profile_viewed"
      | "trip_operation_triaged"
      | "trip_domain_action_requested";
    actorLabel: string;
    actorRole: string;
    occurredAt: string;
    previousState?: AdminTripOperationTask["state"];
    nextState?: AdminTripOperationTask["state"];
    reasonCode?: string;
  }>[];
  directTripMutationAllowed: false;
  synthetic: true;
}>;

export type AdminTripOperationActionCommand = Readonly<{
  action: AdminTripOperationAction;
  expectedTaskVersion: number;
  expectedTripVersion: number;
  idempotencyKey: string;
  reasonCode?: string;
}>;

export type AdminTripOperationActionResult = Readonly<{
  operationId: string;
  resultState: "confirmed";
  idempotentReplay: boolean;
  detail: AdminTripDetail;
  synthetic: true;
}>;

export type AdminCaseKind = "support" | "safety";

export type AdminCaseDirectoryItem = Readonly<{
  caseId: string;
  kind: AdminCaseKind;
  tripId: string;
  operatorId: string;
  operatorName: string;
  state: AdminSupportCase["state"] | AdminSafetyInvestigation["investigationState"];
  category?: AdminSupportCase["category"];
  severity?: AdminSafetyInvestigation["severity"];
  summary: string;
  resourceVersion: number;
  updatedAt: string;
  synthetic: true;
}>;

export type AdminCaseDirectoryQuery = Readonly<{
  pageSize?: 25 | 50 | 100;
  after?: string;
  before?: string;
  search?: string;
  kind?: AdminCaseKind;
  supportState?: AdminSupportCase["state"];
  safetyState?: AdminSafetyInvestigation["investigationState"];
  sort?: "updated_at_desc" | "case_id_asc";
}>;

export type AdminCaseDirectoryPage = Readonly<{
  summary: Readonly<{
    totalCases: number;
    supportCases: number;
    safetyCases: number;
    activeCases: number;
    severeSafetyCases: number;
    awaitingIndependentReviewCases: number;
  }>;
  items: readonly AdminCaseDirectoryItem[];
  pageInfo: AdminCursorPageInfo;
  queryDigest: string;
  scopeDigest: string;
  asOf: string;
  synthetic: true;
}>;

export type AdminSupportCaseAction =
  | "continue_investigation"
  | "await_user"
  | "await_internal"
  | "resolve"
  | "close"
  | "reopen"
  | "escalate_operations"
  | "escalate_safety"
  | "escalate_finance";

export type AdminSafetyCaseAction =
  | "submit_investigation"
  | "restore_access"
  | "uphold_freeze"
  | "request_evidence"
  | "approve_evidence"
  | "revoke_evidence";

export type AdminCaseAction = AdminSupportCaseAction | AdminSafetyCaseAction;

export type AdminCaseAuditEvent = Readonly<{
  eventId: string;
  action:
    | "case_profile_viewed"
    | "support_case_state_changed"
    | "support_case_escalated"
    | "safety_investigation_submitted"
    | "safety_restoration_reviewed"
    | "evidence_access_requested"
    | "evidence_access_approved"
    | "evidence_access_revoked";
  actorLabel: string;
  actorRole: string;
  occurredAt: string;
  previousState?: string;
  nextState?: string;
  note?: string;
}>;

export type AdminSupportCaseDetail = Readonly<{
  kind: "support";
  case: AdminCaseDirectoryItem;
  profile: AdminSupportCase;
  trip: AdminTrip360;
  organizationScope: Readonly<{
    organizationId: string;
    organizationName: string;
    cityScopes: readonly string[];
  }>;
  allowedActions: readonly AdminSupportCaseAction[];
  auditTrail: readonly AdminCaseAuditEvent[];
  synthetic: true;
}>;

export type AdminProductizedSafetyCaseDetail = Readonly<{
  kind: "safety";
  case: AdminCaseDirectoryItem;
  investigation: AdminSafetyInvestigation;
  trip: AdminTrip360;
  evidenceGrants: readonly AdminEvidenceGrant[];
  organizationScope: Readonly<{
    organizationId: string;
    organizationName: string;
    cityScopes: readonly string[];
  }>;
  allowedActions: readonly AdminSafetyCaseAction[];
  auditTrail: readonly AdminCaseAuditEvent[];
  synthetic: true;
}>;

export type AdminCaseDetail =
  | AdminSupportCaseDetail
  | AdminProductizedSafetyCaseDetail;

export type AdminCaseActionCommand = Readonly<{
  action: AdminCaseAction;
  expectedVersion: number;
  idempotencyKey: string;
  note?: string;
  evidenceGrantId?: string;
  ticketId?: string;
  purposeCode?: AdminEvidenceGrant["purposeCode"];
  requestedFields?: AdminEvidenceGrant["requestedFields"];
  ttlMinutes?: number;
}>;

export type AdminCaseActionResult = Readonly<{
  operationId: string;
  resultState: "confirmed";
  idempotentReplay: boolean;
  detail: AdminCaseDetail;
  synthetic: true;
}>;

export type AdminFinanceResourceKind =
  | "settlement"
  | "payout"
  | "refund_reversal"
  | "reconciliation"
  | "business_day"
  | "ledger";

export type AdminFinanceDirectoryState =
  | AdminFinanceOperationState
  | AdminRefundReversal["state"]
  | AdminReconciliationFundCases["state"]
  | AdminBusinessDayClose["state"]
  | "posted";

export type AdminFinanceDirectoryItem = Readonly<{
  resourceId: string;
  kind: AdminFinanceResourceKind;
  operatorId?: string;
  operatorName?: string;
  businessDate?: string;
  state: AdminFinanceDirectoryState;
  summary: string;
  blocking: boolean;
  resourceVersion: number;
  updatedAt: string;
  synthetic: true;
}>;

export type AdminFinanceDirectoryQuery = Readonly<{
  pageSize?: 25 | 50 | 100;
  after?: string;
  before?: string;
  search?: string;
  kind?: AdminFinanceResourceKind;
  state?: AdminFinanceDirectoryState;
  blocking?: boolean;
  sort?: "updated_at_desc" | "resource_id_asc";
}>;

export type AdminFinanceDirectoryPage = Readonly<{
  summary: Readonly<{
    totalResources: number;
    blockingResources: number;
    awaitingIndependentReview: number;
    unknownResults: number;
    openReconciliationRuns: number;
    readyBusinessDays: number;
  }>;
  items: readonly AdminFinanceDirectoryItem[];
  pageInfo: AdminCursorPageInfo;
  queryDigest: string;
  scopeDigest: string;
  asOf: string;
  synthetic: true;
}>;

export type AdminFinanceAction = AdminFinanceOperationsCommand["type"];

export type AdminFinanceAuditEvent = Readonly<{
  eventId: string;
  action:
    | "finance_profile_viewed"
    | "finance_operation_submitted"
    | "finance_review_recorded";
  actorLabel: string;
  actorRole: string;
  occurredAt: string;
  previousState?: string;
  nextState?: string;
  reasonCode?: string;
}>;

type AdminFinanceDetailBase<
  TKind extends AdminFinanceResourceKind,
  TRecord,
> = Readonly<{
  kind: TKind;
  item: AdminFinanceDirectoryItem;
  record: TRecord;
  organizationScope: Readonly<{
    organizationId: string;
    organizationName: string;
    cityScopes: readonly string[];
  }>;
  allowedActions: readonly AdminFinanceAction[];
  auditTrail: readonly AdminFinanceAuditEvent[];
  directBalanceMutationAllowed: false;
  realMoneyMovementAllowed: false;
  synthetic: true;
}>;

export type AdminFinanceSettlementDetail = AdminFinanceDetailBase<
  "settlement",
  AdminAllocationSettlement
>;

export type AdminFinancePayoutDetail = AdminFinanceDetailBase<
  "payout",
  AdminDriverPayout
>;

export type AdminFinanceRefundDetail = AdminFinanceDetailBase<
  "refund_reversal",
  AdminRefundReversal
>;

export type AdminFinanceReconciliationDetail = AdminFinanceDetailBase<
  "reconciliation",
  AdminReconciliationFundCases
> &
  Readonly<{
    actionResourceId?: string;
  }>;

export type AdminFinanceBusinessDayDetail = AdminFinanceDetailBase<
  "business_day",
  AdminBusinessDayClose
>;

export type AdminFinanceLedgerDetail = AdminFinanceDetailBase<
  "ledger",
  AdminLedgerTransaction
>;

export type AdminFinanceDetail =
  | AdminFinanceSettlementDetail
  | AdminFinancePayoutDetail
  | AdminFinanceRefundDetail
  | AdminFinanceReconciliationDetail
  | AdminFinanceBusinessDayDetail
  | AdminFinanceLedgerDetail;

export type AdminFinanceActionCommand = Readonly<{
  action: AdminFinanceAction;
  expectedVersion: number;
  idempotencyKey: string;
  reasonCode: string;
  evidenceReference?: string;
}>;

export type AdminFinanceActionResult = Readonly<{
  operationId: string;
  resultState: "confirmed";
  idempotentReplay: boolean;
  detail: AdminFinanceDetail;
  synthetic: true;
}>;

export type AdminExecutiveResourceKind =
  | "decision_item"
  | "export_request"
  | "operator_health"
  | "metric";

export type AdminExecutiveDirectoryState =
  | "open"
  | ExecutiveExportState
  | "healthy"
  | "attention"
  | "blocked"
  | "unavailable"
  | ExecutiveDashboardPageState;

export type AdminExecutiveDirectoryItem = Readonly<{
  resourceId: string;
  kind: AdminExecutiveResourceKind;
  domain?: ExecutiveExportDomain;
  operatorId?: string;
  operatorName?: string;
  state: AdminExecutiveDirectoryState;
  title: string;
  summary: string;
  blocking: boolean;
  resourceVersion: number;
  updatedAt: string;
  synthetic: true;
}>;

export type AdminExecutiveDirectoryQuery = Readonly<{
  pageSize?: 25 | 50 | 100;
  after?: string;
  before?: string;
  search?: string;
  kind?: AdminExecutiveResourceKind;
  state?: AdminExecutiveDirectoryState;
  domain?: ExecutiveExportDomain;
  blocking?: boolean;
  sort?: "updated_at_desc" | "resource_id_asc";
}>;

export type AdminExecutiveDirectoryPage = Readonly<{
  summary: Readonly<{
    totalResources: number;
    openDecisionItems: number;
    blockingOperators: number;
    exportsAwaitingReview: number;
    unavailableMetrics: number;
    pageState: ExecutiveDashboardPageState;
  }>;
  headlineMetrics: readonly ExecutiveMetricValue[];
  notices: readonly string[];
  items: readonly AdminExecutiveDirectoryItem[];
  pageInfo: AdminCursorPageInfo;
  queryDigest: string;
  scopeDigest: string;
  asOf: string;
  synthetic: true;
}>;

export type AdminExecutiveAction =
  | "record_decision_opinion"
  | "create_export_request"
  | "privacy_approve_export"
  | "privacy_reject_export"
  | "domain_approve_export"
  | "domain_reject_export"
  | "revoke_export"
  | "download_export";

export type AdminExecutiveAuditEvent = Readonly<{
  eventId: string;
  action:
    | "executive_resource_viewed"
    | "executive_decision_opinion_recorded"
    | "executive_export_requested"
    | "executive_export_privacy_reviewed"
    | "executive_export_domain_reviewed"
    | "executive_export_revoked"
    | "executive_export_downloaded";
  actorLabel: string;
  actorRole: string;
  occurredAt: string;
  reasonCode?: string;
}>;

type AdminExecutiveDetailBase<
  TKind extends AdminExecutiveResourceKind,
  TRecord,
> = Readonly<{
  kind: TKind;
  item: AdminExecutiveDirectoryItem;
  record: TRecord;
  organizationScope: Readonly<{
    organizationId: string;
    organizationName: string;
    cityScopes: readonly string[];
  }>;
  allowedActions: readonly AdminExecutiveAction[];
  auditTrail: readonly AdminExecutiveAuditEvent[];
  directBusinessApprovalAllowed: false;
  personLevelDrilldownAllowed: false;
  containsRealData: false;
  synthetic: true;
}>;

export type AdminExecutiveDecisionDetail = AdminExecutiveDetailBase<
  "decision_item",
  AdminExecutiveDecisionItem
>;

export type AdminExecutiveExportDetail = AdminExecutiveDetailBase<
  "export_request",
  ExecutiveExportRequest
>;

export type AdminExecutiveOperatorHealthDetail = AdminExecutiveDetailBase<
  "operator_health",
  AdminExecutiveOperatorHealth["operators"][number]
>;

export type AdminExecutiveMetricDetail = AdminExecutiveDetailBase<
  "metric",
  Readonly<{
    definition: AdminExecutiveMetricRegistry["metrics"][number];
    snapshot?: ExecutiveMetricValue;
  }>
>;

export type AdminExecutiveDetail =
  | AdminExecutiveDecisionDetail
  | AdminExecutiveExportDetail
  | AdminExecutiveOperatorHealthDetail
  | AdminExecutiveMetricDetail;

export type AdminExecutiveActionCommand = Readonly<{
  action: AdminExecutiveAction;
  idempotencyKey: string;
  expectedVersion?: number;
  reasonCode?: string;
  decisionCode?: string;
  responsibleRole?: string;
  dueAt?: string;
  supersedesOpinionId?: string;
  domain?: ExecutiveExportDomain;
  purpose?: string;
  fieldSet?: readonly string[];
  windowStart?: string;
  windowEnd?: string;
}>;

export type AdminExecutiveActionResult = Readonly<{
  operationId: string;
  resultState: "confirmed";
  idempotentReplay: boolean;
  detail: AdminExecutiveDetail;
  download?: ExecutiveExportDownload;
  synthetic: true;
}>;

export type AdminAuditResourceKind = "event" | "investigation";

export type AdminAuditDomain =
  | "authentication"
  | "access"
  | "operator"
  | "driver_vehicle"
  | "trip"
  | "support_safety"
  | "finance"
  | "executive"
  | "audit_system";

export type AdminAuditInvestigationState =
  | "open"
  | "in_review"
  | "resolved";

export type AdminAuditAction =
  | "open_investigation"
  | "assign_investigation"
  | "add_investigation_note"
  | "resolve_investigation"
  | "reopen_investigation";

export type AdminAuditDirectoryItem = Readonly<{
  resourceId: string;
  kind: AdminAuditResourceKind;
  domain: AdminAuditDomain;
  title: string;
  summary: string;
  organizationType: AdminAuditEvent["organizationType"];
  organizationId: string;
  organizationName: string;
  result: AdminAuditEvent["result"] | AdminAuditInvestigationState;
  actorRole?: string;
  correlationId?: string;
  blocking: boolean;
  resourceVersion: number;
  occurredAt: string;
  synthetic: true;
}>;

export type AdminAuditDirectoryQuery = Readonly<{
  pageSize?: 25 | 50 | 100;
  after?: string;
  before?: string;
  search?: string;
  kind?: AdminAuditResourceKind;
  domain?: AdminAuditDomain;
  result?: AdminAuditDirectoryItem["result"];
  sort?: "occurred_at_desc" | "resource_id_asc";
}>;

export type AdminAuditDirectoryPage = Readonly<{
  summary: Readonly<{
    totalResources: number;
    deniedEvents: number;
    highRiskEvents: number;
    openInvestigations: number;
    integrityWarnings: number;
  }>;
  items: readonly AdminAuditDirectoryItem[];
  pageInfo: AdminCursorPageInfo;
  queryDigest: string;
  scopeDigest: string;
  asOf: string;
  synthetic: true;
}>;

export type AdminAuditInvestigation = Readonly<{
  investigationId: string;
  sourceEventId: string;
  domain: AdminAuditDomain;
  state: AdminAuditInvestigationState;
  title: string;
  reasonCode: string;
  organizationType: AdminAuditEvent["organizationType"];
  organizationId: string;
  organizationName: string;
  assigneeWorkIdentityId?: string;
  notes: readonly Readonly<{
    noteId: string;
    authorWorkIdentityId: string;
    content: string;
    occurredAt: string;
  }>[];
  resourceVersion: number;
  createdAt: string;
  updatedAt: string;
  synthetic: true;
}>;

export type AdminAuditTrailEvent = Readonly<{
  eventId: string;
  action:
    | "audit_resource_viewed"
    | "audit_investigation_opened"
    | "audit_investigation_assigned"
    | "audit_investigation_note_added"
    | "audit_investigation_resolved"
    | "audit_investigation_reopened";
  actorLabel: string;
  actorRole: string;
  occurredAt: string;
  previousState?: AdminAuditInvestigationState;
  nextState?: AdminAuditInvestigationState;
  note?: string;
}>;

type AdminAuditDetailBase<
  TKind extends AdminAuditResourceKind,
  TRecord,
> = Readonly<{
  kind: TKind;
  item: AdminAuditDirectoryItem;
  record: TRecord;
  allowedActions: readonly AdminAuditAction[];
  auditTrail: readonly AdminAuditTrailEvent[];
  integrity: Readonly<{
    canonicalPayloadDigest: string;
    previousEventDigest?: string;
    appendOnly: true;
    rawSensitivePayloadAvailable: false;
  }>;
  synthetic: true;
}>;

export type AdminAuditEventDetail = AdminAuditDetailBase<
  "event",
  Readonly<{
    event: AdminAuditEvent;
    linkedInvestigationId?: string;
  }>
>;

export type AdminAuditInvestigationDetail = AdminAuditDetailBase<
  "investigation",
  AdminAuditInvestigation
>;

export type AdminAuditDetail =
  | AdminAuditEventDetail
  | AdminAuditInvestigationDetail;

export type AdminAuditActionCommand = Readonly<{
  action: AdminAuditAction;
  idempotencyKey: string;
  expectedVersion: number;
  reasonCode: string;
  note?: string;
  assigneeWorkIdentityId?: string;
}>;

export type AdminAuditActionResult = Readonly<{
  operationId: string;
  resultState: "confirmed";
  idempotentReplay: boolean;
  detail: AdminAuditDetail;
  synthetic: true;
}>;

export type AdminDataReportDomain =
  | "operations"
  | "finance"
  | "safety_compliance"
  | "audit";

export type AdminDataReportState = "ready" | "partial" | "stale";

export type AdminDataReportAction = "refresh_report";

export type AdminDataReportDirectoryItem = Readonly<{
  reportId: string;
  domain: AdminDataReportDomain;
  title: string;
  summary: string;
  state: AdminDataReportState;
  organizationId: string;
  organizationName: string;
  metricCount: number;
  resourceVersion: number;
  refreshedAt: string;
  synthetic: true;
}>;

export type AdminDataReportDirectoryQuery = Readonly<{
  pageSize?: 25 | 50 | 100;
  after?: string;
  before?: string;
  search?: string;
  domain?: AdminDataReportDomain;
  state?: AdminDataReportState;
  sort?: "refreshed_at_desc" | "report_id_asc";
}>;

export type AdminDataReportDirectoryPage = Readonly<{
  summary: Readonly<{
    totalReports: number;
    readyReports: number;
    partialReports: number;
    staleReports: number;
    totalMetrics: number;
  }>;
  items: readonly AdminDataReportDirectoryItem[];
  pageInfo: AdminCursorPageInfo;
  queryDigest: string;
  scopeDigest: string;
  asOf: string;
  synthetic: true;
}>;

export type AdminDataReportMetric = Readonly<{
  metricId: string;
  label: string;
  displayValue: string;
  state: string;
  asOf: string;
  source: string;
  synthetic: true;
}>;

export type AdminDataReportAuditEvent = Readonly<{
  eventId: string;
  action: "data_report_viewed" | "data_report_refreshed";
  actorLabel: string;
  actorRole: string;
  occurredAt: string;
  previousVersion?: number;
  nextVersion?: number;
  reasonCode?: string;
}>;

export type AdminDataReportDetail = Readonly<{
  item: AdminDataReportDirectoryItem;
  metrics: readonly AdminDataReportMetric[];
  allowedActions: readonly AdminDataReportAction[];
  auditTrail: readonly AdminDataReportAuditEvent[];
  sourceBoundary: Readonly<{
    aggregateOnly: true;
    personLevelDataAvailable: false;
    realDataAvailable: false;
    exportAvailable: false;
  }>;
  synthetic: true;
}>;

export type AdminDataReportActionCommand = Readonly<{
  action: AdminDataReportAction;
  idempotencyKey: string;
  expectedVersion: number;
  reasonCode: string;
}>;

export type AdminDataReportActionResult = Readonly<{
  operationId: string;
  resultState: "confirmed";
  idempotentReplay: boolean;
  detail: AdminDataReportDetail;
  synthetic: true;
}>;

export type AdminMembershipState = "active" | "suspended";

export type AdminMembershipAction =
  | "suspend_membership"
  | "restore_membership";

export type AdminMembershipDirectoryItem = Readonly<{
  membershipId: string;
  internalUserId: string;
  workIdentityId: string;
  displayName: string;
  workEmailMasked: string;
  organizationType: "platform" | "operator";
  organizationId: string;
  organizationName: string;
  productRole: AdminProductRole;
  productRoleName: string;
  state: AdminMembershipState;
  activeSessionCount: number;
  resourceVersion: number;
  updatedAt: string;
  synthetic: true;
}>;

export type AdminMembershipDirectoryQuery = Readonly<{
  pageSize?: 25 | 50 | 100;
  after?: string;
  before?: string;
  search?: string;
  organizationType?: "platform" | "operator";
  state?: AdminMembershipState;
  productRole?: AdminProductRole;
  sort?: "updated_at_desc" | "display_name_asc";
}>;

export type AdminMembershipDirectoryPage = Readonly<{
  summary: Readonly<{
    totalMemberships: number;
    activeMemberships: number;
    suspendedMemberships: number;
    activeSessions: number;
  }>;
  items: readonly AdminMembershipDirectoryItem[];
  pageInfo: AdminCursorPageInfo;
  queryDigest: string;
  scopeDigest: string;
  asOf: string;
  synthetic: true;
}>;

export type AdminMembershipAuditEvent = Readonly<{
  eventId: string;
  action:
    | "admin_membership_viewed"
    | "admin_membership_suspended"
    | "admin_membership_restored";
  actorLabel: string;
  actorRole: string;
  occurredAt: string;
  previousState?: AdminMembershipState;
  nextState?: AdminMembershipState;
  reasonCode?: string;
}>;

export type AdminMembershipDetail = Readonly<{
  item: AdminMembershipDirectoryItem;
  roleBinding: Readonly<{
    roleId: AdminProductRole;
    roleName: string;
    source: "authoritative_membership";
    mutable: false;
  }>;
  scopeBindings: Readonly<{
    organizationId: string;
    organizationName: string;
    cityScopes: readonly string[];
  }>;
  allowedActions: readonly AdminMembershipAction[];
  auditTrail: readonly AdminMembershipAuditEvent[];
  capabilityBoundary: Readonly<{
    realAccountAvailable: false;
    roleMutationAvailable: false;
    invitationAvailable: false;
    directPermissionBindingAvailable: false;
  }>;
  synthetic: true;
}>;

export type AdminMembershipActionCommand = Readonly<{
  action: AdminMembershipAction;
  idempotencyKey: string;
  expectedVersion: number;
  reasonCode: string;
}>;

export type AdminMembershipActionResult = Readonly<{
  operationId: string;
  resultState: "confirmed";
  idempotentReplay: boolean;
  detail: AdminMembershipDetail;
  synthetic: true;
}>;

export interface AdminProductizationClient {
  getInvitation(invitationToken: string): Promise<AdminInvitationSummary>;
  activateInvitation(
    invitationToken: string,
    password: string,
    totpCode: string,
  ): Promise<Readonly<{ recoveryCodes: readonly string[]; synthetic: true }>>;
  startLogin(workEmail: string, password: string): Promise<AdminLoginChallenge>;
  verifyMfa(challengeId: string, totpCode: string): Promise<AdminMfaVerification>;
  selectWorkIdentity(
    selectionToken: string,
    workIdentityId: string,
  ): Promise<AdminProductSession>;
  refreshSession(refreshToken: string): Promise<AdminProductSession>;
  logout(accessToken: string): Promise<void>;
  getNavigation(accessToken: string): Promise<AdminNavigationManifest>;
  listOperationsTasks(
    accessToken: string,
    query: AdminOperationsTaskQuery,
  ): Promise<AdminOperationsTaskPage>;
  getOperationsTask(
    accessToken: string,
    taskId: string,
  ): Promise<AdminOperationsTaskDetail>;
  performOperationsTaskAction(
    accessToken: string,
    taskId: string,
    command: AdminOperationsTaskActionCommand,
  ): Promise<AdminOperationsTaskActionResult>;
  listOperators(
    accessToken: string,
    query: AdminOperatorDirectoryQuery,
  ): Promise<AdminOperatorDirectoryPage>;
  getOperator(
    accessToken: string,
    operatorId: string,
  ): Promise<AdminOperatorDetail>;
  performOperatorAction(
    accessToken: string,
    operatorId: string,
    command: AdminOperatorActionCommand,
  ): Promise<AdminOperatorActionResult>;
  listDrivers(
    accessToken: string,
    query: AdminDriverDirectoryQuery,
  ): Promise<AdminDriverDirectoryPage>;
  getDriver(
    accessToken: string,
    driverAccountId: string,
  ): Promise<AdminDriverDetail>;
  listVehicles(
    accessToken: string,
    query: AdminVehicleDirectoryQuery,
  ): Promise<AdminVehicleDirectoryPage>;
  getVehicle(
    accessToken: string,
    vehicleId: string,
  ): Promise<AdminVehicleDetail>;
  performVehicleReviewAction(
    accessToken: string,
    vehicleId: string,
    command: AdminVehicleReviewActionCommand,
  ): Promise<AdminVehicleReviewActionResult>;
  listTrips(
    accessToken: string,
    query: AdminTripDirectoryQuery,
  ): Promise<AdminTripDirectoryPage>;
  getTrip(
    accessToken: string,
    tripId: string,
  ): Promise<AdminTripDetail>;
  performTripOperationAction(
    accessToken: string,
    tripId: string,
    command: AdminTripOperationActionCommand,
  ): Promise<AdminTripOperationActionResult>;
  listCases(
    accessToken: string,
    query: AdminCaseDirectoryQuery,
  ): Promise<AdminCaseDirectoryPage>;
  getCase(
    accessToken: string,
    kind: AdminCaseKind,
    caseId: string,
  ): Promise<AdminCaseDetail>;
  performCaseAction(
    accessToken: string,
    kind: AdminCaseKind,
    caseId: string,
    command: AdminCaseActionCommand,
  ): Promise<AdminCaseActionResult>;
  listFinanceResources(
    accessToken: string,
    query: AdminFinanceDirectoryQuery,
  ): Promise<AdminFinanceDirectoryPage>;
  getFinanceResource(
    accessToken: string,
    kind: AdminFinanceResourceKind,
    resourceId: string,
  ): Promise<AdminFinanceDetail>;
  performFinanceAction(
    accessToken: string,
    kind: AdminFinanceResourceKind,
    resourceId: string,
    command: AdminFinanceActionCommand,
  ): Promise<AdminFinanceActionResult>;
  listExecutiveResources(
    accessToken: string,
    query: AdminExecutiveDirectoryQuery,
  ): Promise<AdminExecutiveDirectoryPage>;
  getExecutiveResource(
    accessToken: string,
    kind: AdminExecutiveResourceKind,
    resourceId: string,
  ): Promise<AdminExecutiveDetail>;
  performExecutiveAction(
    accessToken: string,
    kind: AdminExecutiveResourceKind,
    resourceId: string,
    command: AdminExecutiveActionCommand,
  ): Promise<AdminExecutiveActionResult>;
  listAuditResources(
    accessToken: string,
    query: AdminAuditDirectoryQuery,
  ): Promise<AdminAuditDirectoryPage>;
  getAuditResource(
    accessToken: string,
    kind: AdminAuditResourceKind,
    resourceId: string,
  ): Promise<AdminAuditDetail>;
  performAuditAction(
    accessToken: string,
    kind: AdminAuditResourceKind,
    resourceId: string,
    command: AdminAuditActionCommand,
  ): Promise<AdminAuditActionResult>;
  listDataReports(
    accessToken: string,
    query: AdminDataReportDirectoryQuery,
  ): Promise<AdminDataReportDirectoryPage>;
  getDataReport(
    accessToken: string,
    reportId: string,
  ): Promise<AdminDataReportDetail>;
  performDataReportAction(
    accessToken: string,
    reportId: string,
    command: AdminDataReportActionCommand,
  ): Promise<AdminDataReportActionResult>;
  listMemberships(
    accessToken: string,
    query: AdminMembershipDirectoryQuery,
  ): Promise<AdminMembershipDirectoryPage>;
  getMembership(
    accessToken: string,
    membershipId: string,
  ): Promise<AdminMembershipDetail>;
  performMembershipAction(
    accessToken: string,
    membershipId: string,
    command: AdminMembershipActionCommand,
  ): Promise<AdminMembershipActionResult>;
}
import type {
  AdminDriver360,
  AdminOperatorCityCapability,
  AdminOperatorLifecycleState,
  AdminVehicle360,
} from "./admin-operator-management.js";
import type {
  AdminReviewAuditEntry,
  AdminReviewMaterialReason,
  AdminReviewTaskDetail,
  AdminReviewTaskStatus,
  RejectVehicleReviewAdminCommand,
} from "./admin-review.js";
import type {
  AdminAllocationSettlement,
  AdminBusinessDayClose,
  AdminDriverPayout,
  AdminFinanceOperationState,
  AdminFinanceOperationsCommand,
  AdminLedgerTransaction,
  AdminReconciliationFundCases,
  AdminRefundReversal,
} from "./admin-finance-operations.js";
import type {
  AdminEvidenceGrant,
  AdminSafetyInvestigation,
  AdminSupportCase,
  AdminTrip360,
  AdminTripOperationTask,
} from "./admin-trip-case-management.js";
import type {
  AdminExecutiveDecisionItem,
  AdminExecutiveMetricRegistry,
  AdminExecutiveOperatorHealth,
  ExecutiveDashboardPageState,
  ExecutiveExportDomain,
  ExecutiveExportDownload,
  ExecutiveExportRequest,
  ExecutiveExportState,
  ExecutiveMetricValue,
} from "./admin-executive-dashboard.js";
