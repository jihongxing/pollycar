import type { AdminOrganizationContext } from "./admin-access.js";
import type { SyntheticTripState } from "./synthetic-trip.js";
import type { SafetyCaseState } from "./safety-case.js";

export type AdminTripOperationTask = Readonly<{
  taskId: string;
  tripId: string;
  operatorId: string;
  operatorName: string;
  category: "schedule" | "matching" | "pickup" | "location" | "cross_operator" | "unknown_result";
  state: "detected" | "triaged" | "coordinating" | "awaiting_authoritative_result" | "resolved" | "closed";
  priority: "normal" | "high" | "urgent";
  summary: string;
  resourceVersion: number;
  synthetic: true;
}>;

export type AdminTripOperationsCenter = Readonly<{
  context: AdminOrganizationContext;
  tasks: readonly AdminTripOperationTask[];
  metrics: Readonly<{
    detected: number;
    awaitingAuthoritativeResult: number;
    crossOperator: number;
    safetyFrozen: number;
  }>;
  directTripMutationAllowed: false;
  synthetic: true;
}>;

export type AdminTrip360 = Readonly<{
  context: AdminOrganizationContext;
  tripId: string;
  operatorId: string;
  operatorName: string;
  authoritativeState: SyntheticTripState;
  authoritativeVersion: number;
  routeSummary: string;
  passengerMasked: string;
  driverMasked: string;
  vehicleMasked: string;
  relatedSupportCaseId?: string;
  relatedSafetyCaseId?: string;
  financeReadOnly: true;
  operatorSnapshotImmutable: true;
  directTripMutationAllowed: false;
  synthetic: true;
}>;

export type AdminSupportCase = Readonly<{
  context: AdminOrganizationContext;
  supportCaseId: string;
  tripId: string;
  operatorId: string;
  category: "trip_service" | "schedule" | "cancellation" | "communication" | "operator_coordination" | "eligibility" | "safety_referral" | "finance_referral";
  state: "open" | "assigned" | "investigating" | "awaiting_user" | "awaiting_internal" | "escalated" | "resolved" | "closed" | "reopened";
  resourceVersion: number;
  ownerInternalUserId: string;
  userSummary: string;
  investigationSummary: string;
  safetyEvidenceAvailable: false;
  financeMutationAllowed: false;
  synthetic: true;
}>;

export type AdminSafetyInvestigation = Readonly<{
  context: AdminOrganizationContext;
  safetyCaseId: string;
  tripId: string;
  authoritativeState: SafetyCaseState;
  investigationState: "unassigned" | "assigned" | "investigating" | "awaiting_independent_review" | "completed";
  severity: "sev4" | "sev3" | "sev2" | "sev1";
  resourceVersion: number;
  freezeActorInternalUserId: string;
  investigationOwnerInternalUserId: string;
  blockers: readonly Readonly<{
    blockerType: "emergency_response" | "evidence_hold" | "eligibility_sync" | "open_risk";
    summary: string;
    blocking: boolean;
  }>[];
  independentReviewRequired: true;
  synthetic: true;
}>;

export type AdminEvidenceGrant = Readonly<{
  context: AdminOrganizationContext;
  grantId: string;
  safetyCaseId: string;
  ticketId: string;
  purposeCode: "safety_investigation" | "appeal_review" | "emergency_response";
  requestedFields: readonly ("chat_reference" | "raw_chat" | "location_window" | "full_location_trace")[];
  state: "requested" | "approved" | "active" | "expired" | "revoked" | "denied";
  requestedByInternalUserId: string;
  approvedByInternalUserId?: string;
  expiresAt: string;
  resourceVersion: number;
  dualApprovalSatisfied: boolean;
  realEvidenceAllowed: false;
  synthetic: true;
}>;

export type AdminEvidenceFieldResult = Readonly<{
  grantId: string;
  field: "chat_reference" | "raw_chat" | "location_window" | "full_location_trace";
  value: string;
  expiresAt: string;
  synthetic: true;
}>;

export type AdminCommandRecoveryTask = Readonly<{
  context: AdminOrganizationContext;
  recoveryTaskId: string;
  originalCommandType: string;
  targetResourceId: string;
  idempotencyKeyDigest: string;
  state: "open" | "querying_idempotency_result" | "reconciling_authoritative_state" | "awaiting_outbox_confirmation" | "recovered_succeeded" | "recovered_failed" | "escalated";
  resourceVersion: number;
  duplicateCommandAllowed: false;
  businessDecisionAllowedForTechnicalOperations: false;
  synthetic: true;
}>;

export type AdminTripCaseManagementCommand =
  | Readonly<{ type: "triage_trip_operation"; taskId: string; resourceVersion: number }>
  | Readonly<{ type: "request_trip_domain_action"; taskId: string; expectedTripVersion: number; reasonCode: string; resourceVersion: number }>
  | Readonly<{ type: "update_support_case"; supportCaseId: string; targetState: AdminSupportCase["state"]; resourceVersion: number }>
  | Readonly<{ type: "escalate_support_case"; supportCaseId: string; target: "operations" | "safety" | "finance"; resourceVersion: number }>
  | Readonly<{ type: "submit_safety_investigation"; safetyCaseId: string; resourceVersion: number }>
  | Readonly<{ type: "review_safety_restoration"; safetyCaseId: string; outcome: "restore_access" | "uphold_freeze"; resourceVersion: number }>
  | Readonly<{ type: "request_evidence_access"; safetyCaseId: string; ticketId: string; purposeCode: AdminEvidenceGrant["purposeCode"]; requestedFields: AdminEvidenceGrant["requestedFields"]; ttlMinutes: number }>
  | Readonly<{ type: "approve_evidence_access"; grantId: string; resourceVersion: number }>
  | Readonly<{ type: "revoke_evidence_access"; grantId: string; resourceVersion: number }>
  | Readonly<{ type: "query_command_recovery"; recoveryTaskId: string; resourceVersion: number }>;

export type AdminTripCaseManagementCommandResult = Readonly<{
  commandType: AdminTripCaseManagementCommand["type"];
  resourceType: "trip_operation_task" | "support_case" | "safety_case" | "evidence_grant" | "recovery_task";
  resourceId: string;
  resourceVersion: number;
  state: string;
  synthetic: true;
}>;

export interface AdminTripCaseManagementClient {
  getTripOperationsCenter(): Promise<AdminTripOperationsCenter>;
  getTrip360(tripId: string): Promise<AdminTrip360>;
  getSupportCase(supportCaseId: string): Promise<AdminSupportCase>;
  getSafetyInvestigation(safetyCaseId: string): Promise<AdminSafetyInvestigation>;
  getEvidenceGrant(grantId: string): Promise<AdminEvidenceGrant>;
  readEvidenceField(grantId: string, field: AdminEvidenceFieldResult["field"]): Promise<AdminEvidenceFieldResult>;
  getCommandRecoveryTask(recoveryTaskId: string): Promise<AdminCommandRecoveryTask>;
  executeTripCaseManagementCommand(
    command: AdminTripCaseManagementCommand,
  ): Promise<AdminTripCaseManagementCommandResult>;
}
