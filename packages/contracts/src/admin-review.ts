export type AdminReviewTaskStatus =
  | "available"
  | "claimed"
  | "in_progress"
  | "waiting_user"
  | "released"
  | "expired"
  | "completed";

export type AdminReviewMaterialReason =
  | "insurance_expiry_incomplete"
  | "authorization_evidence_incomplete"
  | "synthetic_attachment_invalid";

export type AdminReviewLease = Readonly<{
  ownerId: string;
  claimedAt: string;
  expiresAt: string;
}>;

export type AdminReviewTaskSummary = Readonly<{
  taskId: string;
  applicationId: string;
  status: AdminReviewTaskStatus;
  submittedAt: string;
  vehicleCategory: string;
  queueLabel: string;
  taskVersion: number;
  synthetic: true;
}>;

export type AdminReviewTaskDetail = Readonly<{
  taskId: string;
  applicationId: string;
  accountReference: string;
  status: AdminReviewTaskStatus;
  submittedAt: string;
  vehicleCategory: string;
  insuranceExpiryStatus: "complete" | "incomplete";
  authorizationEvidenceStatus: "complete" | "incomplete";
  attachmentValidationStatus: "valid" | "invalid";
  taskVersion: number;
  vehicleReviewVersion: number;
  lease?: AdminReviewLease;
  synthetic: true;
}>;

export type AdminReviewAuditEntry = Readonly<{
  id: string;
  occurredAt: string;
  actorId: string;
  action:
    | "task_claimed"
    | "task_viewed"
    | "lease_renewed"
    | "task_released"
    | "material_previewed"
    | "material_requested"
    | "vehicle_approved"
    | "vehicle_rejected";
  outcome: "succeeded" | "denied";
  reasonCode: string;
  taskId: string;
  correlationId: string;
  synthetic: true;
}>;

export type AdminReviewMaterialPreview = Readonly<{
  reason: AdminReviewMaterialReason;
  title: string;
  body: string;
  templateVersion: string;
  synthetic: true;
}>;

export type ApiErrorResponse = Readonly<{
  error: Readonly<{
    code: string;
    message: string;
    retryable: boolean;
    correlationId: string;
  }>;
}>;

export type ClaimAdminReviewTaskCommand = Readonly<{
  reviewerId: string;
  taskId: string;
  expectedTaskVersion: number;
  idempotencyKey: string;
}>;

export type RenewAdminReviewTaskCommand = Readonly<{
  reviewerId: string;
  taskId: string;
  expectedTaskVersion: number;
  idempotencyKey: string;
}>;

export type ReleaseAdminReviewTaskCommand = Readonly<{
  reviewerId: string;
  taskId: string;
  reasonCode: "reviewer_unavailable" | "wrong_queue" | "needs_supervisor";
  expectedTaskVersion: number;
  idempotencyKey: string;
}>;

export type RequestVehicleMaterialAdminCommand = Readonly<{
  reviewerId: string;
  taskId: string;
  reason: AdminReviewMaterialReason;
  previewConfirmed: true;
  expectedTaskVersion: number;
  expectedVehicleReviewVersion: number;
  idempotencyKey: string;
}>;

export type ApproveVehicleReviewAdminCommand = Readonly<{
  reviewerId: string;
  taskId: string;
  reasonCode: "approved_standard";
  previewConfirmed: true;
  expectedTaskVersion: number;
  expectedVehicleReviewVersion: number;
  idempotencyKey: string;
}>;

export type RejectVehicleReviewAdminCommand = Readonly<{
  reviewerId: string;
  taskId: string;
  reasonCode:
    | "vehicle_age_exceeded"
    | "vehicle_mileage_exceeded"
    | "insurance_requirement_not_met"
    | "authorization_remaining_insufficient";
  previewConfirmed: true;
  expectedTaskVersion: number;
  expectedVehicleReviewVersion: number;
  idempotencyKey: string;
}>;

export interface AdminReviewClient {
  listTasks(): Promise<readonly AdminReviewTaskSummary[]>;
  claimTask(command: ClaimAdminReviewTaskCommand): Promise<AdminReviewTaskDetail>;
  getTask(taskId: string): Promise<AdminReviewTaskDetail>;
  renewTask(command: RenewAdminReviewTaskCommand): Promise<AdminReviewTaskDetail>;
  releaseTask(command: ReleaseAdminReviewTaskCommand): Promise<AdminReviewTaskDetail>;
  previewMaterial(taskId: string, reason: AdminReviewMaterialReason): Promise<AdminReviewMaterialPreview>;
  requestMaterial(command: RequestVehicleMaterialAdminCommand): Promise<AdminReviewTaskDetail>;
  approveVehicle(command: ApproveVehicleReviewAdminCommand): Promise<AdminReviewTaskDetail>;
  rejectVehicle(command: RejectVehicleReviewAdminCommand): Promise<AdminReviewTaskDetail>;
  listAudit(taskId: string): Promise<readonly AdminReviewAuditEntry[]>;
  recoverResult(idempotencyKey: string): Promise<AdminReviewTaskDetail | undefined>;
}
