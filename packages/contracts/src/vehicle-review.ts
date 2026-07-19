import type { PassengerCount } from "./passenger-capacity.js";

export type VehicleReviewStatus =
  | "draft"
  | "under_review"
  | "needs_material"
  | "approved"
  | "suspended"
  | "appealing"
  | "revoked"
  | "expired";

export type VehicleReviewDecision =
  | "request_material"
  | "approve"
  | "reject"
  | "escalate"
  | "reconsider";

export type VehicleReviewTimelineItem = Readonly<{
  code: "submitted" | "review_started" | "material_requested" | "material_resubmitted" | "approved";
  label: string;
  occurredAt?: string;
  state: "complete" | "current" | "future";
}>;

export type VehicleReviewView = Readonly<{
  applicationId: string;
  accountId: string;
  status: VehicleReviewStatus;
  version: number;
  ownerIdentityAvailable: boolean;
  maxPassengerCount: PassengerCount;
  vehicleType?: string;
  insuranceExpiresOn?: string;
  syntheticAttachmentId?: string;
  requestedMaterialCodes: readonly string[];
  decisionCode?: string;
  escalationType?: string;
  userMessage?: Readonly<{ title: string; body: string }>;
  timeline: readonly VehicleReviewTimelineItem[];
  synthetic: true;
}>;

export type SaveVehicleDraftCommand = Readonly<{
  accountId: string;
  applicationId: string;
  vehicleType: string;
  maxPassengerCount: PassengerCount;
  insuranceExpiresOn: string;
  syntheticAttachmentId: string;
  expectedVersion: number;
  idempotencyKey: string;
}>;

export type SubmitVehicleReviewCommand = Readonly<{
  accountId: string;
  applicationId: string;
  expectedVersion: number;
  idempotencyKey: string;
}>;

export type RequestVehicleMaterialCommand = Readonly<{
  reviewerId: string;
  applicationId: string;
  materialCodes: readonly string[];
  expectedVersion: number;
  idempotencyKey: string;
}>;

export type ResubmitVehicleMaterialCommand = Readonly<{
  accountId: string;
  applicationId: string;
  insuranceExpiresOn: string;
  syntheticAttachmentId: string;
  expectedVersion: number;
  idempotencyKey: string;
}>;

export type ApproveVehicleReviewCommand = Readonly<{
  reviewerId: string;
  applicationId: string;
  expectedVersion: number;
  idempotencyKey: string;
}>;

export type RejectVehicleReviewCommand = Readonly<{
  reviewerId: string;
  applicationId: string;
  reasonCode: string;
  userMessage: Readonly<{ title: string; body: string }>;
  expectedVersion: number;
  idempotencyKey: string;
}>;

export type EscalateVehicleReviewCommand = Readonly<{
  reviewerId: string;
  applicationId: string;
  escalationType: string;
  reasonCode: string;
  expectedVersion: number;
  idempotencyKey: string;
}>;

export type ReconsiderVehicleReviewCommand = Readonly<{
  seniorReviewerId: string;
  originalReviewerId: string;
  applicationId: string;
  outcome: "uphold" | "overturn" | "return" | "escalate_safety";
  reasonCode: string;
  expectedVersion: number;
  idempotencyKey: string;
}>;

export interface VehicleReviewClient {
  get(applicationId: string, accountId: string): Promise<VehicleReviewView>;
  saveDraft(command: SaveVehicleDraftCommand): Promise<VehicleReviewView>;
  submit(command: SubmitVehicleReviewCommand): Promise<VehicleReviewView>;
  resubmitMaterial(command: ResubmitVehicleMaterialCommand): Promise<VehicleReviewView>;
}
