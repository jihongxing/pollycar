import type { FreeFlexTrialView } from "@pollycar/contracts";
import { decideEligibilityTransition, type EligibilityState } from "@pollycar/domain";
import type { AuditLog } from "../ports/audit.js";
import type { Repository, Transaction } from "../ports/storage.js";

export type FreeFlexTrialRecord = Readonly<{
  eligibilityId: string;
  accountId: string;
  batchId: "batch_0";
  state: EligibilityState | "invited";
  activationDaysInLookback: number;
  cycleEndsAt?: string;
  processedKeys: readonly string[];
  synthetic: true;
}>;

export class FreeFlexTrialService {
  public constructor(
    private readonly repository: Repository<FreeFlexTrialRecord>,
    private readonly transaction: Transaction,
    private readonly audit: AuditLog,
    private readonly now: () => Date,
  ) {}

  public async get(accountId: string): Promise<FreeFlexTrialView> {
    const current = await this.repository.get(accountId);
    return this.toView(current?.value ?? this.createInvitation(accountId), current?.version ?? 0);
  }

  public async submit(
    accountId: string,
    expectedVersion: number,
    idempotencyKey: string,
  ): Promise<FreeFlexTrialView> {
    return this.transition(accountId, expectedVersion, idempotencyKey, "submit_application");
  }

  public async approve(
    accountId: string,
    expectedVersion: number,
    idempotencyKey: string,
  ): Promise<FreeFlexTrialView> {
    return this.transition(accountId, expectedVersion, idempotencyKey, "approve_application");
  }

  public async confirmAndActivate(
    accountId: string,
    expectedVersion: number,
    idempotencyKey: string,
  ): Promise<FreeFlexTrialView> {
    return this.transaction.run(async () => {
      const confirmed = await this.applyTransition(
        accountId,
        expectedVersion,
        idempotencyKey,
        "confirm_free_trial",
      );
      const activated = await this.applyTransition(
        accountId,
        confirmed.version,
        `${idempotencyKey}:activate`,
        "activate",
      );
      return this.toView(activated.record, activated.version);
    });
  }

  private async transition(
    accountId: string,
    expectedVersion: number,
    idempotencyKey: string,
    command: "submit_application" | "approve_application",
  ): Promise<FreeFlexTrialView> {
    return this.transaction.run(async () => {
      const result = await this.applyTransition(accountId, expectedVersion, idempotencyKey, command);
      return this.toView(result.record, result.version);
    });
  }

  private async applyTransition(
    accountId: string,
    expectedVersion: number,
    idempotencyKey: string,
    command: "submit_application" | "approve_application" | "confirm_free_trial" | "activate",
  ): Promise<Readonly<{ record: FreeFlexTrialRecord; version: number }>> {
    const stored = await this.repository.get(accountId);
    const current = stored?.value ?? this.createInvitation(accountId);
    const currentVersion = stored?.version ?? 0;
    if (current.processedKeys.includes(idempotencyKey)) {
      return { record: current, version: currentVersion };
    }
    if (currentVersion !== expectedVersion) throw new Error("STORAGE_CONCURRENT_MODIFICATION");
    const aggregateState = current.state === "invited" ? "not_applied" : current.state;
    const cycleEndsAt = new Date(this.now().getTime() + 30 * 24 * 60 * 60 * 1000);
    const decision = decideEligibilityTransition(
      { id: current.eligibilityId, state: aggregateState, version: currentVersion },
      command === "activate"
        ? { type: "activate", requestId: idempotencyKey, cycleEndsAt }
        : { type: command, requestId: idempotencyKey },
      {
        expectedVersion: currentVersion,
        activationDaysInLookback: current.activationDaysInLookback,
      },
    );
    if (!decision.ok) throw new Error(decision.error.code);
    const next: FreeFlexTrialRecord = {
      ...current,
      state: decision.next.state,
      ...(decision.next.cycleEndsAt
        ? { cycleEndsAt: decision.next.cycleEndsAt.toISOString() }
        : {}),
      processedKeys: [...current.processedKeys, idempotencyKey],
    };
    const saved = await this.repository.put(accountId, next, currentVersion);
    await this.audit.append({
      id: `audit-free-flex-${accountId}-${saved.version}`,
      occurredAt: this.now().toISOString(),
      actorId: command === "approve_application" ? "synthetic-reviewer-001" : accountId,
      action: decision.eventType,
      subjectType: "free_flex_trial",
      subjectId: current.eligibilityId,
      outcome: "succeeded",
      reasonCode: decision.next.state,
      correlationId: idempotencyKey,
      synthetic: true,
    });
    return { record: saved.value, version: saved.version };
  }

  private createInvitation(accountId: string): FreeFlexTrialRecord {
    return {
      eligibilityId: `free-flex-${accountId}`,
      accountId,
      batchId: "batch_0",
      state: "invited",
      activationDaysInLookback: 0,
      processedKeys: [],
      synthetic: true,
    };
  }

  private toView(record: FreeFlexTrialRecord, version: number): FreeFlexTrialView {
    const state = record.state === "invited" ? "invited" : mapState(record.state);
    return {
      eligibilityId: record.eligibilityId,
      accountId: record.accountId,
      batchId: record.batchId,
      state,
      version,
      qualificationFeeMinor: 0,
      paidPathEnabled: false,
      realInvitation: false,
      activationDaysInLookback: record.activationDaysInLookback,
      maximumActivationDays: 60,
      quota: { hours24: 4, days7: 12, days30: 18 },
      ...(record.cycleEndsAt ? { cycleEndsAt: record.cycleEndsAt } : {}),
      synthetic: true,
    };
  }
}

function mapState(state: EligibilityState): FreeFlexTrialView["state"] {
  if (
    state === "under_review" ||
    state === "awaiting_confirmation" ||
    state === "active" ||
    state === "rejected" ||
    state === "expired"
  ) {
    return state;
  }
  throw new Error("ELIGIBILITY_INVALID_STATE");
}
