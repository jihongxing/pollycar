export type EligibilityState =
  | "not_applied"
  | "under_review"
  | "rejected"
  | "awaiting_confirmation"
  | "awaiting_payment"
  | "payment_failed"
  | "pending_activation"
  | "activation_blocked"
  | "active"
  | "suspended"
  | "pending_restoration"
  | "appealing"
  | "revoked"
  | "expired"
  | "invalidated";

export interface EligibilityAggregate {
  readonly id: string;
  readonly state: EligibilityState;
  readonly version: number;
  readonly cycleEndsAt?: Date;
}

export type EligibilityCommand =
  | { readonly type: "submit_application"; readonly requestId: string }
  | { readonly type: "approve_application"; readonly requestId: string }
  | { readonly type: "reject_application"; readonly requestId: string }
  | { readonly type: "confirm_free_trial"; readonly requestId: string }
  | { readonly type: "confirm_paid_trial"; readonly requestId: string }
  | { readonly type: "activate"; readonly requestId: string; readonly cycleEndsAt: Date }
  | { readonly type: "suspend"; readonly requestId: string }
  | { readonly type: "request_restoration"; readonly requestId: string }
  | { readonly type: "restore"; readonly requestId: string }
  | { readonly type: "revoke"; readonly requestId: string }
  | { readonly type: "submit_appeal"; readonly requestId: string }
  | { readonly type: "expire"; readonly requestId: string };

export interface EligibilityContext {
  readonly expectedVersion: number;
  readonly activationDaysInLookback: number;
}
