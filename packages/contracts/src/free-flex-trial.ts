export type FreeFlexTrialState =
  | "invited"
  | "under_review"
  | "awaiting_confirmation"
  | "active"
  | "rejected"
  | "expired";

export type FreeFlexTrialView = Readonly<{
  eligibilityId: string;
  accountId: string;
  batchId: "batch_0";
  state: FreeFlexTrialState;
  version: number;
  qualificationFeeMinor: 0;
  paidPathEnabled: false;
  realInvitation: false;
  activationDaysInLookback: number;
  maximumActivationDays: 60;
  quota: Readonly<{
    hours24: 4;
    days7: 12;
    days30: 18;
  }>;
  cycleEndsAt?: string;
  synthetic: true;
}>;

export interface FreeFlexTrialClient {
  get(): Promise<FreeFlexTrialView>;
  submit(expectedVersion: number, idempotencyKey: string): Promise<FreeFlexTrialView>;
  confirm(expectedVersion: number, idempotencyKey: string): Promise<FreeFlexTrialView>;
}
