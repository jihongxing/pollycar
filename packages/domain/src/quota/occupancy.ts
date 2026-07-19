export interface QuotaOccupancy {
  readonly orderId: string;
  readonly requestId: string;
  readonly version: number;
  readonly status: "occupied" | "released" | "finalized";
}

export type OccupancyResult =
  | { readonly ok: true; readonly occupancy: QuotaOccupancy; readonly eventType: string }
  | { readonly ok: false; readonly code: "QUOTA_CONCURRENT_MODIFICATION" | "QUOTA_DUPLICATE_REQUEST" };

export function occupyQuota(
  current: QuotaOccupancy | undefined,
  orderId: string,
  requestId: string,
  expectedVersion: number,
): OccupancyResult {
  if (current?.requestId === requestId) {
    return { ok: false, code: "QUOTA_DUPLICATE_REQUEST" };
  }
  if ((current?.version ?? 0) !== expectedVersion || current?.status === "occupied") {
    return { ok: false, code: "QUOTA_CONCURRENT_MODIFICATION" };
  }
  return {
    ok: true,
    occupancy: { orderId, requestId, version: expectedVersion + 1, status: "occupied" },
    eventType: "quota_slot_occupied",
  };
}

export function releaseOrFinalizeQuota(
  occupancy: QuotaOccupancy,
  outcome: "release" | "finalize",
): OccupancyResult {
  if (occupancy.status !== "occupied") {
    return { ok: false, code: "QUOTA_DUPLICATE_REQUEST" };
  }
  return {
    ok: true,
    occupancy: {
      ...occupancy,
      version: occupancy.version + 1,
      status: outcome === "release" ? "released" : "finalized",
    },
    eventType: outcome === "release" ? "quota_slot_released" : "quota_slot_finalized",
  };
}
