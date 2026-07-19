export type LifecycleResource = "temporary_chat" | "precise_location" | "realtime_location_cache";

export type LifecycleRecordView = Readonly<{
  resource: LifecycleResource;
  resourceId: string;
  deleteAfter: string;
  evidenceHold: boolean;
  deletionState: "not_due" | "eligible" | "blocked_by_hold" | "deleted";
  deletedAt?: string;
  realDataEnabled: false;
  synthetic: true;
}>;

export type LifecycleRunResult = Readonly<{
  inspected: number;
  deleted: number;
  blockedByHold: number;
  synthetic: true;
}>;
