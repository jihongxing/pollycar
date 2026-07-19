export type TripCancellationReason =
  | "plans_changed"
  | "pickup_incorrect"
  | "wait_too_long"
  | "driver_or_vehicle_concern"
  | "other";

export type TripCancellationEligibility = Readonly<{
  eligible: boolean;
  policy: "accepted_cancellation_responsibility";
  mode: "free_window" | "responsibility_assessment" | "not_available";
  acceptedAt?: string;
  deadlineAt?: string;
  serverTime: string;
  reasonRequired: boolean;
  noteRequired: false;
  realFeeAmountMinor: 0;
  currency: "CNY";
  determinedByServer: true;
  goodwill?: import("./goodwill-cancellation.js").GoodwillCancellationEligibility;
}>;

export type TripCancellationResponsibility =
  | "passenger"
  | "driver"
  | "platform"
  | "shared"
  | "manual_review";

export type NonFinancialRemedy =
  | "none"
  | "priority_rematch"
  | "driver_quota_exemption"
  | "goodwill_cancellation"
  | "manual_review";

export type TripCancellationRequest = Readonly<{
  tripId: string;
  expectedVersion: number;
  reason?: TripCancellationReason;
  note?: string;
}>;

export type TripCancellationRecord = Readonly<{
  cancelledBy: "passenger" | "driver" | "system";
  reason?: TripCancellationReason;
  note?: string;
  cancelledAt: string;
  realFeeAmountMinor: 0;
  currency: "CNY";
  withinFreeWindow: boolean;
  responsibility: TripCancellationResponsibility;
  nonFinancialRemedy: NonFinancialRemedy;
  automaticallyDetermined: true;
  goodwill?: import("./goodwill-cancellation.js").GoodwillCancellationConsumption;
}>;
