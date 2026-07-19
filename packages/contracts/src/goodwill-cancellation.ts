export type GoodwillCancellationActor = "passenger" | "driver";

export type GoodwillCancellationRecordState = "reserved" | "consumed" | "restored";

export type GoodwillCancellationUsage = Readonly<{
  hours24: number;
  days7: number;
  days30: number;
}>;

export type GoodwillCancellationLimits = Readonly<{
  hours24: number;
  days7: number;
  days30: number;
}>;

export type GoodwillCancellationEligibility = Readonly<{
  actor: GoodwillCancellationActor;
  eligible: boolean;
  reasonRequired: true;
  usage: GoodwillCancellationUsage;
  limits: GoodwillCancellationLimits;
  blockedBy?: "trip_state" | "hours24" | "days7" | "days30";
  serverTime: string;
  determinedByServer: true;
  productionEnabled: false;
}>;

export type GoodwillCancellationConsumption = Readonly<{
  recordId: string;
  actor: GoodwillCancellationActor;
  state: GoodwillCancellationRecordState;
  consumedAt?: string;
  restoredAt?: string;
  synthetic: true;
}>;
