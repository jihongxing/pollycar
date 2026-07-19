import { describe, expect, it } from "vitest";
import type { Transaction } from "../ports/storage.js";
import {
  FinancialReconciliationService,
  type FinancialAction,
  type ReconciliationEvaluation,
  type ReconciliationFact,
  type ReconciliationRecoveryAction,
  type ReconciliationRepository,
  type ReconciliationRun,
} from "./financial-reconciliation-service.js";

describe("资金对账与关账内核", () => {
  it("四方逐笔和汇总一致时允许关闭批次与账务日", async () => {
    const repository = new MemoryReconciliationRepository();
    const service = new FinancialReconciliationService(repository, memoryTransaction);
    const run = await service.evaluate(runInput(balancedFacts()));

    expect(run).toMatchObject({
      state: "balanced",
      expectedCount: "1",
      actualCount: "1",
      expectedAmountMinor: "10000",
      actualAmountMinor: "10000",
      differenceCount: "0",
      differenceAmountMinor: "0",
      sourcesComplete: true,
    });
    expect(await service.listDifferences(run.reconciliationRunId)).toEqual([]);

    await service.closeRun(run.reconciliationRunId);
    await expect(
      service.assertActionAllowed(run.reconciliationRunId, "settlement"),
    ).resolves.toBeUndefined();
    await service.closeBusinessDate({
      businessDate: "2026-07-14",
      preparedBy: "finance-maker-1",
      reviewedBy: "finance-reviewer-1",
    });
    expect(repository.closedBusinessDates).toEqual(["2026-07-14"]);
  });

  it("任意非零金额差异同时阻止清算、付款和关账", async () => {
    const repository = new MemoryReconciliationRepository();
    const service = new FinancialReconciliationService(repository, memoryTransaction);
    const facts = balancedFacts().map((fact) =>
      fact.source === "provider_statement" ? { ...fact, amountMinor: "9900" } : fact,
    );
    const run = await service.evaluate(runInput(facts));

    expect(run).toMatchObject({
      state: "differences_found",
      differenceAmountMinor: "-100",
    });
    expect(await service.listDifferences(run.reconciliationRunId)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          differenceType: "payment_amount_mismatch",
          differenceAmountMinor: "-100",
          state: "open",
        }),
        expect.objectContaining({
          differenceType: "aggregate_amount_mismatch",
          differenceAmountMinor: "-100",
          state: "open",
        }),
      ]),
    );
    for (const action of ["settlement", "payout", "close"] as const) {
      await expect(service.assertActionAllowed(run.reconciliationRunId, action)).rejects.toThrow(
        "RECONCILIATION_ACTION_BLOCKED",
      );
    }
    await expect(service.closeRun(run.reconciliationRunId)).rejects.toThrow(
      "RECONCILIATION_RUN_NOT_BALANCED",
    );

    for (const difference of await service.listDifferences(run.reconciliationRunId)) {
      await service.resolveDifference(difference.reconciliationItemId, {
        resolutionType: "synthetic_corrected_source",
        resolvedBy: "finance-maker",
        reviewedBy: "finance-reviewer",
        resolutionEvidenceReference: "case://stage7/payment-amount-correction",
      });
    }
    await service.closeRun(run.reconciliationRunId);
    await expect(
      service.assertActionAllowed(run.reconciliationRunId, "close"),
    ).resolves.toBeUndefined();
  });

  it("人工差异解决必须提供独立复核和证据引用", async () => {
    const repository = new MemoryReconciliationRepository();
    const service = new FinancialReconciliationService(repository, memoryTransaction);
    const facts = balancedFacts().map((fact) =>
      fact.source === "provider_statement" ? { ...fact, amountMinor: "9900" } : fact,
    );
    const run = await service.evaluate(runInput(facts));
    const difference = (await service.listDifferences(run.reconciliationRunId))[0]!;

    await expect(
      service.resolveDifference(difference.reconciliationItemId, {
        resolutionType: "synthetic_corrected_source",
        resolvedBy: "finance-maker",
        reviewedBy: "finance-reviewer",
        resolutionEvidenceReference: "",
      }),
    ).rejects.toThrow("RECONCILIATION_RESOLUTION_EVIDENCE_REQUIRED");
  });

  it("手续费、重复账单、迟到回调和未知结果均生成持久化案件与恢复动作", async () => {
    const repository = new MemoryReconciliationRepository();
    const service = new FinancialReconciliationService(repository, memoryTransaction);
    const facts = [
      ...balancedFacts().map((fact) =>
        fact.source === "payment_aggregate"
          ? { ...fact, feeMinor: "200", state: "unknown" }
          : fact.source === "provider_statement"
            ? { ...fact, feeMinor: "250", late: true }
            : fact,
      ),
      {
        ...balancedFacts().find((fact) => fact.source === "provider_statement")!,
        reconciliationFactId: "provider-duplicate",
        providerEventId: "provider-event-duplicate",
        sourceDigest: "digest-provider-duplicate",
      },
    ];

    const run = await service.evaluate(runInput(facts));
    const differences = await service.listDifferences(run.reconciliationRunId);
    expect(differences.map((item) => item.differenceType)).toEqual(
      expect.arrayContaining([
        "fee_mismatch",
        "duplicate_provider_payment",
        "late_provider_callback",
        "unknown_result",
        "aggregate_count_mismatch",
        "aggregate_amount_mismatch",
      ]),
    );
    const recoveries = await service.listRecoveryActions(run.reconciliationRunId);
    expect(recoveries.map((action) => action.actionType)).toEqual(
      expect.arrayContaining([
        "query_original_request",
        "recheck_next_batch",
        "create_duplicate_payment_refund_case",
      ]),
    );
  });

  it("恢复动作可失败后重试并完成，但未归零差异仍保持资金门禁", async () => {
    const repository = new MemoryReconciliationRepository();
    const service = new FinancialReconciliationService(repository, memoryTransaction);
    const facts = balancedFacts().map((fact) =>
      fact.source === "payment_aggregate" ? { ...fact, state: "unknown" } : fact,
    );
    const run = await service.evaluate(runInput(facts));
    const [recovery] = await service.listRecoveryActions(run.reconciliationRunId);
    expect(recovery).toBeDefined();

    await service.recordRecoveryResult(recovery!.recoveryActionId, {
      succeeded: false,
      errorCode: "PROVIDER_TIMEOUT",
    });
    await service.recordRecoveryResult(recovery!.recoveryActionId, { succeeded: true });
    expect((await service.listRecoveryActions(run.reconciliationRunId))[0]).toMatchObject({
      state: "completed",
      attempts: 2,
    });
    await expect(service.assertActionAllowed(run.reconciliationRunId, "close")).rejects.toThrow(
      "RECONCILIATION_ACTION_BLOCKED",
    );
  });

  it("同一账单摘要重复执行返回原批次且不重复创建差异", async () => {
    const repository = new MemoryReconciliationRepository();
    const service = new FinancialReconciliationService(repository, memoryTransaction);
    const input = runInput(
      balancedFacts().map((fact) =>
        fact.source === "provider_statement" ? { ...fact, amountMinor: "9000" } : fact,
      ),
    );

    const first = await service.evaluate(input);
    const replay = await service.evaluate({
      ...input,
      reconciliationRunId: "run-replayed-id-must-not-persist",
    });
    expect(replay).toEqual(first);
    expect(await service.listDifferences(first.reconciliationRunId)).toHaveLength(2);
  });

  it("关账强制经办复核分离且要求当日全部批次已关闭", async () => {
    const repository = new MemoryReconciliationRepository();
    const service = new FinancialReconciliationService(repository, memoryTransaction);
    const run = await service.evaluate(runInput(balancedFacts()));

    await expect(
      service.closeBusinessDate({
        businessDate: "2026-07-14",
        preparedBy: "finance-operator",
        reviewedBy: "finance-operator",
      }),
    ).rejects.toThrow("RECONCILIATION_REVIEWER_MUST_DIFFER");
    await expect(
      service.closeBusinessDate({
        businessDate: "2026-07-14",
        preparedBy: "finance-maker",
        reviewedBy: "finance-reviewer",
      }),
    ).rejects.toThrow("RECONCILIATION_RUNS_NOT_CLOSED");

    await service.closeRun(run.reconciliationRunId);
    await service.closeBusinessDate({
      businessDate: "2026-07-14",
      preparedBy: "finance-maker",
      reviewedBy: "finance-reviewer",
    });
  });

  it("退款和清算金额差异使用各自固定分类", async () => {
    const repository = new MemoryReconciliationRepository();
    const service = new FinancialReconciliationService(repository, memoryTransaction);
    const refundFacts = balancedFacts().map((fact) => ({
      ...fact,
      recordType: "refund" as const,
      ...(fact.source === "provider_statement" ? { amountMinor: "9000" } : {}),
    }));
    const refundRun = await service.evaluate({
      ...runInput(refundFacts),
      reconciliationRunId: "run-refund",
      sourceFileDigest: "e".repeat(64),
      recordType: "refund",
    });
    expect((await service.listDifferences(refundRun.reconciliationRunId)).map(
      (item) => item.differenceType,
    )).toContain("refund_amount_mismatch");

    const settlementFacts = balancedFacts().map((fact) => ({
      ...fact,
      recordType: "settlement" as const,
      ...(fact.source === "provider_statement" ? { amountMinor: "9000" } : {}),
    }));
    const settlementRun = await service.evaluate({
      ...runInput(settlementFacts),
      reconciliationRunId: "run-settlement",
      sourceFileDigest: "d".repeat(64),
      recordType: "settlement",
    });
    expect((await service.listDifferences(settlementRun.reconciliationRunId)).map(
      (item) => item.differenceType,
    )).toContain("settlement_mismatch");
  });
});

const memoryTransaction: Transaction = {
  run: async <TResult>(operation: () => Promise<TResult>) => operation(),
};

class MemoryReconciliationRepository implements ReconciliationRepository {
  private readonly runs = new Map<string, ReconciliationRun>();
  private readonly runByDigest = new Map<string, string>();
  private readonly evaluations = new Map<string, ReconciliationEvaluation>();
  private readonly recoveries = new Map<string, ReconciliationRecoveryAction>();
  public readonly closedBusinessDates: string[] = [];

  public async saveEvaluation(
    evaluation: ReconciliationEvaluation,
  ): Promise<ReconciliationRun> {
    const existingId = this.runByDigest.get(evaluation.run.sourceFileDigest);
    if (existingId) return this.runs.get(existingId)!;
    this.runs.set(evaluation.run.reconciliationRunId, evaluation.run);
    this.runByDigest.set(evaluation.run.sourceFileDigest, evaluation.run.reconciliationRunId);
    this.evaluations.set(evaluation.run.reconciliationRunId, evaluation);
    for (const recovery of evaluation.recoveryActions) {
      this.recoveries.set(recovery.recoveryActionId, recovery);
    }
    return evaluation.run;
  }

  public async getRun(reconciliationRunId: string): Promise<ReconciliationRun | undefined> {
    return this.runs.get(reconciliationRunId);
  }

  public async listDifferences(reconciliationRunId: string) {
    return this.evaluations.get(reconciliationRunId)?.differences ?? [];
  }

  public async listRecoveryActions(reconciliationRunId: string) {
    return [...this.recoveries.values()].filter(
      (action) => action.reconciliationRunId === reconciliationRunId,
    );
  }

  public async closeRun(reconciliationRunId: string): Promise<void> {
    const run = this.runs.get(reconciliationRunId);
    if (!run || run.state !== "balanced" || run.differenceAmountMinor !== "0") {
      throw new Error("RECONCILIATION_RUN_NOT_BALANCED");
    }
    this.runs.set(reconciliationRunId, { ...run, state: "closed" });
  }

  public async assertActionAllowed(
    reconciliationRunId: string,
    _action: FinancialAction,
  ): Promise<void> {
    const run = this.runs.get(reconciliationRunId);
    const differences = this.evaluations.get(reconciliationRunId)?.differences ?? [];
    if (
      run?.state !== "closed" ||
      run.differenceAmountMinor !== "0" ||
      differences.some((item) => item.state !== "resolved")
    ) {
      throw new Error("RECONCILIATION_ACTION_BLOCKED");
    }
  }

  public async closeBusinessDate(
    businessDate: string,
    _preparedBy: string,
    _reviewedBy: string,
  ): Promise<void> {
    const runs = [...this.runs.values()].filter((run) => run.businessDate === businessDate);
    if (runs.length === 0 || runs.some((run) => run.state !== "closed")) {
      throw new Error("RECONCILIATION_RUNS_NOT_CLOSED");
    }
    this.closedBusinessDates.push(businessDate);
  }

  public async recordRecoveryResult(
    recoveryActionId: string,
    result: Readonly<{ succeeded: boolean; errorCode?: string }>,
  ): Promise<void> {
    const action = this.recoveries.get(recoveryActionId);
    if (!action) throw new Error("RECONCILIATION_RECOVERY_NOT_FOUND");
    this.recoveries.set(recoveryActionId, {
      ...action,
      state: result.succeeded ? "completed" : "failed",
      attempts: action.attempts + 1,
      ...(result.errorCode ? { lastErrorCode: result.errorCode } : {}),
    });
  }

  public async resolveDifference(
    reconciliationItemId: string,
    input: Readonly<{
      resolutionType: string;
      resolvedBy: string;
      reviewedBy: string;
      resolutionEvidenceReference: string;
    }>,
  ): Promise<void> {
    const evaluation = [...this.evaluations.values()].find((candidate) =>
      candidate.differences.some(
        (difference) => difference.reconciliationItemId === reconciliationItemId,
      ),
    );
    if (!evaluation) throw new Error("RECONCILIATION_ITEM_NOT_FOUND");
    const differences = evaluation.differences.map((difference) =>
      difference.reconciliationItemId === reconciliationItemId
        ? {
            ...difference,
            state: "resolved" as const,
            details: {
              ...difference.details,
              resolution_type: input.resolutionType,
              resolved_by: input.resolvedBy,
              reviewed_by: input.reviewedBy,
            },
            resolutionType: input.resolutionType,
            resolvedBy: input.resolvedBy,
            reviewedBy: input.reviewedBy,
            resolutionEvidenceReference: input.resolutionEvidenceReference,
          }
        : difference,
    );
    const allResolved = differences.every((difference) => difference.state === "resolved");
    const run = allResolved
      ? {
          ...evaluation.run,
          state: "balanced" as const,
          differenceCount: "0",
          differenceAmountMinor: "0",
        }
      : evaluation.run;
    this.evaluations.set(run.reconciliationRunId, {
      ...evaluation,
      run,
      differences,
    });
    this.runs.set(run.reconciliationRunId, run);
  }
}

function runInput(facts: readonly ReconciliationFact[]) {
  return {
    reconciliationRunId: "run-2026-07-14-payment",
    provider: "synthetic-provider",
    merchantId: "synthetic-merchant",
    businessDate: "2026-07-14",
    recordType: "payment" as const,
    sourceFileId: "synthetic-file-2026-07-14",
    sourceFileDigest: "f".repeat(64),
    statementSignatureVerified: true,
    controlTotalsVerified: true,
    facts,
  };
}

function balancedFacts(): readonly ReconciliationFact[] {
  const common = {
    recordType: "payment" as const,
    businessDate: "2026-07-14",
    merchantId: "synthetic-merchant",
    internalOrderId: "payment-order-1",
    providerOrderId: "provider-order-1",
    providerEventId: "provider-event-1",
    amountMinor: "10000",
    feeMinor: "200",
    currency: "CNY" as const,
    state: "succeeded",
    occurredAt: "2026-07-14T08:00:00.000Z",
    settledAt: "2026-07-14T09:00:00.000Z",
    late: false,
    synthetic: true as const,
  };
  return [
    {
      ...common,
      reconciliationFactId: "fact-business",
      source: "business_order",
      sourceDigest: "digest-business",
    },
    {
      ...common,
      reconciliationFactId: "fact-payment",
      source: "payment_aggregate",
      sourceDigest: "digest-payment",
    },
    {
      ...common,
      reconciliationFactId: "fact-ledger",
      source: "ledger",
      sourceDigest: "digest-ledger",
    },
    {
      ...common,
      reconciliationFactId: "fact-provider",
      source: "provider_statement",
      sourceDigest: "digest-provider",
    },
  ];
}
