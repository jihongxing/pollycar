import type {
  GoodwillCancellationActor,
  GoodwillCancellationEligibility,
  GoodwillCancellationRecordState,
} from "@pollycar/contracts";
import type { Repository, Transaction } from "../ports/storage.js";

export type GoodwillCancellationRecord = Readonly<{
  recordId: string;
  accountId: string;
  tripId: string;
  actor: GoodwillCancellationActor;
  state: GoodwillCancellationRecordState;
  reservedAt: string;
  consumedAt?: string;
  restoredAt?: string;
  idempotencyKey: string;
  synthetic: true;
}>;

const limits = {
  passenger: { hours24: 1, days7: 1, days30: 2 },
  driver: { hours24: 1, days7: 2, days30: 3 },
} as const;

export class GoodwillCancellationService {
  public constructor(
    private readonly repository: Repository<GoodwillCancellationRecord>,
    private readonly transaction: Transaction,
    private readonly now: () => Date,
  ) {}

  public async evaluate(
    accountId: string,
    actor: GoodwillCancellationActor,
    tripState: string,
  ): Promise<GoodwillCancellationEligibility> {
    const usage = await this.usage(accountId, actor);
    const selected = limits[actor];
    const blockedBy =
      !["accepted", "reserved", "preparing", "driver_en_route"].includes(tripState)
        ? "trip_state"
        : usage.hours24 >= selected.hours24
          ? "hours24"
          : usage.days7 >= selected.days7
            ? "days7"
            : usage.days30 >= selected.days30
              ? "days30"
              : undefined;
    return {
      actor,
      eligible: blockedBy === undefined,
      reasonRequired: true,
      usage,
      limits: selected,
      ...(blockedBy ? { blockedBy } : {}),
      serverTime: this.now().toISOString(),
      determinedByServer: true,
      productionEnabled: false,
    };
  }

  public reserve(
    accountId: string,
    tripId: string,
    actor: GoodwillCancellationActor,
    tripState: string,
    idempotencyKey: string,
  ): Promise<GoodwillCancellationRecord> {
    return this.transaction.run(async () => {
      const existing = (await this.repository.list()).find(
        ({ value }) => value.accountId === accountId && value.idempotencyKey === idempotencyKey,
      );
      if (existing) return existing.value;
      const eligibility = await this.evaluate(accountId, actor, tripState);
      if (!eligibility.eligible) throw new Error(`GOODWILL_CANCELLATION_${eligibility.blockedBy?.toUpperCase()}_EXCEEDED`);
      const record: GoodwillCancellationRecord = {
        recordId: `goodwill-${actor}-${tripId}-${idempotencyKey}`,
        accountId,
        tripId,
        actor,
        state: "reserved",
        reservedAt: this.now().toISOString(),
        idempotencyKey,
        synthetic: true,
      };
      return (await this.repository.put(record.recordId, record, 0)).value;
    });
  }

  public transition(
    recordId: string,
    state: "consumed" | "restored",
  ): Promise<GoodwillCancellationRecord> {
    return this.transaction.run(async () => {
      const stored = await this.repository.get(recordId);
      if (!stored) throw new Error("GOODWILL_CANCELLATION_RECORD_NOT_FOUND");
      if (stored.value.state === state) return stored.value;
      if (stored.value.state !== "reserved") throw new Error("GOODWILL_CANCELLATION_INVALID_STATE");
      const occurredAt = this.now().toISOString();
      const next: GoodwillCancellationRecord = {
        ...stored.value,
        state,
        ...(state === "consumed" ? { consumedAt: occurredAt } : { restoredAt: occurredAt }),
      };
      return (await this.repository.put(recordId, next, stored.version)).value;
    });
  }

  private async usage(accountId: string, actor: GoodwillCancellationActor) {
    const nowMs = this.now().getTime();
    const consumed = (await this.repository.list())
      .map(({ value }) => value)
      .filter((record) => record.accountId === accountId && record.actor === actor && record.state === "consumed")
      .map((record) => new Date(record.consumedAt!).getTime());
    return {
      hours24: consumed.filter((occurredAt) => occurredAt > nowMs - 24 * 60 * 60 * 1000).length,
      days7: consumed.filter((occurredAt) => occurredAt > nowMs - 7 * 24 * 60 * 60 * 1000).length,
      days30: consumed.filter((occurredAt) => occurredAt > nowMs - 30 * 24 * 60 * 60 * 1000).length,
    };
  }
}
