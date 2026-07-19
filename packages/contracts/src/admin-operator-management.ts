import type { AdminOrganizationContext } from "./admin-access.js";

export type AdminOperatorLifecycleState =
  | "candidate"
  | "onboarding_review"
  | "pending_activation"
  | "active"
  | "restricted"
  | "suspended"
  | "exit_pending"
  | "exited";

export type AdminOperatorCapabilityType =
  | "driver_operations"
  | "vehicle_operations"
  | "trip_coordination"
  | "support_coordination"
  | "safety_collaboration";

export type AdminOperatorCityCapability = Readonly<{
  capabilityId: string;
  cityCode: string;
  cityName: string;
  capabilityType: AdminOperatorCapabilityType;
  state: "pending" | "active" | "restricted" | "suspended" | "expired" | "revoked";
  effectiveFrom: string;
  ruleVersion: string;
  approvalCaseId: string;
  synthetic: true;
}>;

export type AdminOperator360 = Readonly<{
  context: AdminOrganizationContext;
  operatorId: string;
  operatorName: string;
  syntheticReference: string;
  contactMasked: string;
  lifecycleState: AdminOperatorLifecycleState;
  resourceVersion: number;
  updatedAt: string;
  capabilities: readonly AdminOperatorCityCapability[];
  metrics: Readonly<{
    activeDrivers: number;
    activeVehicles: number;
    pendingTasks: number;
  }>;
  blockers: readonly Readonly<{
    blockerType: "onboarding" | "vehicle_document" | "reconciliation" | "fund_case";
    summary: string;
    blocking: boolean;
  }>[];
  financeReadOnly: true;
  sensitiveFieldsMasked: true;
  realAccountsEnabled: false;
  productionEnabled: false;
  synthetic: true;
}>;

export type AdminOperatorOnboardingCase = Readonly<{
  context: AdminOrganizationContext;
  onboardingCaseId: string;
  operatorId: string;
  operatorName: string;
  state:
    | "draft"
    | "submitted"
    | "under_review"
    | "changes_requested"
    | "awaiting_independent_review"
    | "approved"
    | "rejected"
    | "cancelled";
  resourceVersion: number;
  handledByInternalUserId: string;
  checks: readonly Readonly<{
    checkId: string;
    label: string;
    state: "passed" | "pending" | "failed";
    summary: string;
  }>[];
  realMaterialsAllowed: false;
  synthetic: true;
}>;

export type AdminPrimaryOperatorRelationship = Readonly<{
  relationshipId: string;
  driverAccountId: string;
  vehicleId: string;
  cityCode: string;
  operatorId: string;
  operatorName: string;
  state: "active" | "ended";
  effectiveFrom: string;
  effectiveTo?: string;
  authoritativeSource: "pollycar_finance.driver_operator_memberships";
  synthetic: true;
}>;

export type AdminDriver360 = Readonly<{
  context: AdminOrganizationContext;
  driverAccountId: string;
  displayNameMasked: string;
  phoneMasked: string;
  eligibilityState: "serviceable" | "restricted";
  quotaSummary: string;
  primaryOperatorRelationship: AdminPrimaryOperatorRelationship;
  relationshipHistory: readonly AdminPrimaryOperatorRelationship[];
  vehicles: readonly Readonly<{
    vehicleId: string;
    plateMasked: string;
    reviewState: "approved" | "under_review" | "changes_requested" | "rejected";
  }>[];
  sensitiveFieldsMasked: true;
  synthetic: true;
}>;

export type AdminVehicle360 = Readonly<{
  context: AdminOrganizationContext;
  vehicleId: string;
  plateMasked: string;
  vehicleSummary: string;
  driverAccountId: string;
  driverNameMasked: string;
  review: Readonly<{
    state: "approved" | "under_review" | "changes_requested" | "rejected";
    resourceVersion: number;
    authoritativeSource: "spec/domain/vehicle-review.yaml";
  }>;
  primaryOperatorRelationship: AdminPrimaryOperatorRelationship;
  expiringDocumentCount: number;
  directReviewMutationAllowed: false;
  sensitiveFieldsMasked: true;
  synthetic: true;
}>;

export type AdminPrimaryOperatorMigrationCase = Readonly<{
  context: AdminOrganizationContext;
  migrationCaseId: string;
  driverAccountId: string;
  vehicleId: string;
  cityCode: string;
  sourceOperatorId: string;
  sourceOperatorName: string;
  targetOperatorId: string;
  targetOperatorName: string;
  state:
    | "draft"
    | "checks_pending"
    | "awaiting_source_acknowledgement"
    | "awaiting_target_acknowledgement"
    | "awaiting_independent_review"
    | "scheduled"
    | "effective"
    | "cancelled"
    | "rejected";
  resourceVersion: number;
  sourceAcknowledged: boolean;
  targetAcknowledged: boolean;
  independentlyReviewed: boolean;
  effectiveAt?: string;
  blockers: readonly Readonly<{
    blockerType: "target_capability" | "eligibility" | "vehicle_review" | "active_trip" | "safety_handoff" | "reconciliation" | "payout_unknown" | "fund_case";
    summary: string;
    blocking: boolean;
  }>[];
  rollbackAllowed: false;
  synthetic: true;
}>;

export type AdminOperatorManagementCommand =
  | Readonly<{
      type: "request_onboarding_changes";
      onboardingCaseId: string;
      reason: string;
      resourceVersion: number;
    }>
  | Readonly<{
      type: "approve_onboarding";
      onboardingCaseId: string;
      resourceVersion: number;
    }>
  | Readonly<{
      type: "grant_city_capability";
      operatorId: string;
      cityCode: string;
      capabilityType: AdminOperatorCapabilityType;
      resourceVersion: number;
    }>
  | Readonly<{
      type: "change_operator_lifecycle";
      operatorId: string;
      targetState: AdminOperatorLifecycleState;
      reason: string;
      resourceVersion: number;
    }>
  | Readonly<{
      type: "acknowledge_primary_operator_migration";
      migrationCaseId: string;
      side: "source" | "target";
      resourceVersion: number;
    }>
  | Readonly<{
      type: "review_primary_operator_migration";
      migrationCaseId: string;
      resourceVersion: number;
    }>
  | Readonly<{
      type: "schedule_primary_operator_migration";
      migrationCaseId: string;
      effectiveAt: string;
      resourceVersion: number;
    }>
  | Readonly<{
      type: "apply_primary_operator_migration";
      migrationCaseId: string;
      resourceVersion: number;
    }>;

export type AdminOperatorManagementCommandResult = Readonly<{
  commandType: AdminOperatorManagementCommand["type"];
  resourceType: "operator" | "onboarding_case" | "migration_case";
  resourceId: string;
  resourceVersion: number;
  state: string;
  synthetic: true;
}>;

export interface AdminOperatorManagementClient {
  getOperator360(operatorId: string): Promise<AdminOperator360>;
  getOnboardingCase(onboardingCaseId: string): Promise<AdminOperatorOnboardingCase>;
  getDriver360(driverAccountId: string): Promise<AdminDriver360>;
  getVehicle360(vehicleId: string): Promise<AdminVehicle360>;
  getMigrationCase(migrationCaseId: string): Promise<AdminPrimaryOperatorMigrationCase>;
  executeOperatorManagementCommand(
    command: AdminOperatorManagementCommand,
  ): Promise<AdminOperatorManagementCommandResult>;
}
