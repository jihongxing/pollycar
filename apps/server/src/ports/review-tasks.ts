import type {
  AdminReviewMaterialReason,
  AdminReviewTaskDetail,
  AdminReviewTaskStatus,
  RejectVehicleReviewAdminCommand,
} from "@pollycar/contracts";

export type ReviewTaskRecord = Readonly<{
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
  ownerId?: string;
  claimedAt?: string;
  leaseExpiresAt?: string;
  synthetic: true;
}>;

export interface ReviewTaskRepository {
  list(): Promise<readonly ReviewTaskRecord[]>;
  get(taskId: string): Promise<ReviewTaskRecord | undefined>;
  create(record: ReviewTaskRecord): Promise<boolean>;
  compareAndSet(taskId: string, expectedVersion: number, next: ReviewTaskRecord): Promise<boolean>;
}

export interface VehicleMaterialRequester {
  requestMaterial(input: Readonly<{
    reviewerId: string;
    applicationId: string;
    reason: AdminReviewMaterialReason;
    expectedVehicleReviewVersion: number;
    idempotencyKey: string;
  }>): Promise<Readonly<{ vehicleReviewVersion: number }>>;
}

export interface VehicleReviewDecisionExecutor extends VehicleMaterialRequester {
  approve(input: Readonly<{
    reviewerId: string;
    applicationId: string;
    expectedVersion: number;
    idempotencyKey: string;
  }>): Promise<Readonly<{ version: number }>>;
  reject(input: Readonly<{
    reviewerId: string;
    applicationId: string;
    reasonCode: RejectVehicleReviewAdminCommand["reasonCode"];
    userMessage: Readonly<{ title: string; body: string }>;
    expectedVersion: number;
    idempotencyKey: string;
  }>): Promise<Readonly<{ version: number }>>;
}

export function toAdminReviewTaskDetail(record: ReviewTaskRecord): AdminReviewTaskDetail {
  return {
    taskId: record.taskId,
    applicationId: record.applicationId,
    accountReference: record.accountReference,
    status: record.status,
    submittedAt: record.submittedAt,
    vehicleCategory: record.vehicleCategory,
    insuranceExpiryStatus: record.insuranceExpiryStatus,
    authorizationEvidenceStatus: record.authorizationEvidenceStatus,
    attachmentValidationStatus: record.attachmentValidationStatus,
    taskVersion: record.taskVersion,
    vehicleReviewVersion: record.vehicleReviewVersion,
    ...(record.ownerId && record.claimedAt && record.leaseExpiresAt
      ? {
          lease: {
            ownerId: record.ownerId,
            claimedAt: record.claimedAt,
            expiresAt: record.leaseExpiresAt,
          },
        }
      : {}),
    synthetic: true,
  };
}
