export type QuotaPolicyName = "base" | "flex";

export interface QuotaHistoryItem {
  readonly occurredAt: Date;
}

export interface QuotaEvaluation {
  readonly ok: boolean;
  readonly policy: QuotaPolicyName;
  readonly counts: Readonly<{ hours24: number; days7: number; days30: number }>;
  readonly errorCode?: "QUOTA_24H_EXCEEDED" | "QUOTA_7D_EXCEEDED" | "QUOTA_30D_EXCEEDED";
}

const limits = {
  base: { hours24: 3, days7: 10, days30: 15 },
  flex: { hours24: 4, days7: 12, days30: 18 },
} as const;

export function evaluateQuota(
  policy: QuotaPolicyName,
  history: readonly QuotaHistoryItem[],
  now: Date,
): QuotaEvaluation {
  const counts = {
    hours24: countSince(history, now, 24 * 60 * 60 * 1000),
    days7: countSince(history, now, 7 * 24 * 60 * 60 * 1000),
    days30: countSince(history, now, 30 * 24 * 60 * 60 * 1000),
  };
  const selected = limits[policy];

  if (counts.hours24 >= selected.hours24) return { ok: false, policy, counts, errorCode: "QUOTA_24H_EXCEEDED" };
  if (counts.days7 >= selected.days7) return { ok: false, policy, counts, errorCode: "QUOTA_7D_EXCEEDED" };
  if (counts.days30 >= selected.days30) return { ok: false, policy, counts, errorCode: "QUOTA_30D_EXCEEDED" };
  return { ok: true, policy, counts };
}

function countSince(history: readonly QuotaHistoryItem[], now: Date, durationMs: number): number {
  const start = now.getTime() - durationMs;
  return history.filter((item) => item.occurredAt.getTime() > start && item.occurredAt <= now).length;
}
