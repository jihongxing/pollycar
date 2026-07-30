import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { loadPostgresIntegrationTestConfig } from "@pollycar/configuration";
import {
  FinancialReconciliationService,
  type ReconciliationFact,
} from "../application/financial-reconciliation-service.js";
import { runMigrations } from "./migrations.js";
import { PostgresReconciliationRepository } from "./postgres-reconciliation-repository.js";
import { PostgresTransaction } from "./postgres-transaction.js";

const databaseUrl =
  loadPostgresIntegrationTestConfig().reconciliationDatabaseUrl;
const describePostgres = databaseUrl ? describe.sequential : describe.skip;
const migrationsDirectory = fileURLToPath(new URL("../../migrations", import.meta.url));

describePostgres("阶段七资金对账、差异案件、关账和恢复", () => {
  const migrationPool = new Pool({
    connectionString: databaseUrl,
    application_name: "pollycar-reconciliation-migrations",
    max: 2,
  });
  let runtimePool: Pool;
  let service: FinancialReconciliationService;

  beforeAll(async () => {
    const applied = await runMigrations(migrationPool, migrationsDirectory);
    expect(applied).toContain("0008_financial_reconciliation");
    await migrationPool.query(
      "ALTER ROLE pollycar_ledger_runtime PASSWORD 'synthetic-reconciliation-runtime'",
    );
    const runtimeUrl = new URL(databaseUrl!);
    runtimeUrl.username = "pollycar_ledger_runtime";
    runtimeUrl.password = "synthetic-reconciliation-runtime";
    runtimePool = new Pool({
      connectionString: runtimeUrl.toString(),
      application_name: "pollycar-reconciliation-runtime",
      max: 4,
    });
    const transaction = new PostgresTransaction(runtimePool);
    service = new FinancialReconciliationService(
      new PostgresReconciliationRepository(transaction),
      transaction,
    );
  });

  afterAll(async () => {
    await runtimePool?.end();
    await migrationPool.end();
  });

  it("四方平衡批次允许三类资金动作并完成双人关账", async () => {
    const run = await service.evaluate(runInput("balanced", balancedFacts()));
    expect(run.state).toBe("balanced");
    await service.closeRun(run.reconciliationRunId);
    for (const action of ["settlement", "payout", "close"] as const) {
      await expect(
        service.assertActionAllowed(run.reconciliationRunId, action),
      ).resolves.toBeUndefined();
    }
    await service.closeBusinessDate({
      businessDate: "2026-07-14",
      preparedBy: "finance-maker-stage7",
      reviewedBy: "finance-reviewer-stage7",
    });
    const businessDay = await migrationPool.query<{
      state: string;
      prepared_by: string;
      reviewed_by: string;
    }>(
      `SELECT state, prepared_by, reviewed_by
         FROM pollycar_finance.financial_business_days
        WHERE business_date = '2026-07-14'`,
    );
    expect(businessDay.rows[0]).toEqual({
      state: "closed",
      prepared_by: "finance-maker-stage7",
      reviewed_by: "finance-reviewer-stage7",
    });
  });

  it("非零逐笔和汇总差异持久化并阻止清算、付款和关账", async () => {
    const facts = balancedFacts("2026-07-15").map((fact) =>
      fact.source === "provider_statement" ? { ...fact, amountMinor: "9900" } : fact,
    );
    const input = runInput("amount-mismatch", facts, "2026-07-15");
    const run = await service.evaluate(input);
    const replay = await service.evaluate({
      ...input,
      reconciliationRunId: "run-stage7-duplicate-file",
    });
    expect(replay.reconciliationRunId).toBe(run.reconciliationRunId);
    expect((await service.listDifferences(run.reconciliationRunId)).map(
      (item) => item.differenceType,
    )).toEqual(["aggregate_amount_mismatch", "payment_amount_mismatch"]);
    for (const action of ["settlement", "payout", "close"] as const) {
      await expect(service.assertActionAllowed(run.reconciliationRunId, action)).rejects.toThrow(
        "RECONCILIATION_ACTION_BLOCKED",
      );
    }
    await expect(
      service.closeBusinessDate({
        businessDate: "2026-07-15",
        preparedBy: "finance-maker-stage7",
        reviewedBy: "finance-reviewer-stage7",
      }),
    ).rejects.toThrow("RECONCILIATION_RUNS_NOT_CLOSED");
    const persisted = await migrationPool.query<{
      runs: string;
      items: string;
    }>(
      `SELECT
         (SELECT count(*)::text
            FROM pollycar_finance.reconciliation_runs
           WHERE source_file_digest = $1) AS runs,
         (SELECT count(*)::text
            FROM pollycar_finance.reconciliation_items
           WHERE reconciliation_run_id = $2) AS items`,
      [input.sourceFileDigest, run.reconciliationRunId],
    );
    expect(persisted.rows[0]).toEqual({ runs: "1", items: "2" });

    for (const difference of await service.listDifferences(run.reconciliationRunId)) {
      await service.resolveDifference(difference.reconciliationItemId, {
        resolutionType: "synthetic_corrected_statement",
        resolvedBy: "finance-maker-stage7",
        reviewedBy: "finance-reviewer-stage7",
        resolutionEvidenceReference: "case://stage7/corrected-provider-statement",
      });
    }
    await service.closeRun(run.reconciliationRunId);
    await expect(
      service.assertActionAllowed(run.reconciliationRunId, "settlement"),
    ).resolves.toBeUndefined();
    await service.closeBusinessDate({
      businessDate: "2026-07-15",
      preparedBy: "finance-maker-stage7",
      reviewedBy: "finance-reviewer-stage7",
    });
  });

  it("手续费、重复账单、迟到和未知结果创建恢复动作并持久化重试结果", async () => {
    const facts = [
      ...balancedFacts("2026-07-16").map((fact) =>
        fact.source === "payment_aggregate"
          ? { ...fact, feeMinor: "200", state: "unknown" }
          : fact.source === "provider_statement"
            ? { ...fact, feeMinor: "250", late: true }
            : fact,
      ),
      {
        ...balancedFacts("2026-07-16").find(
          (fact) => fact.source === "provider_statement",
        )!,
        reconciliationFactId: "provider-duplicate-stage7",
        providerEventId: "provider-event-duplicate-stage7",
        sourceDigest: "digest-provider-duplicate-stage7",
      },
    ];
    const run = await service.evaluate(runInput("recovery", facts, "2026-07-16"));
    const actions = await service.listRecoveryActions(run.reconciliationRunId);
    expect(actions.map((action) => action.actionType)).toEqual(
      expect.arrayContaining([
        "query_original_request",
        "recheck_next_batch",
        "create_duplicate_payment_refund_case",
      ]),
    );
    await service.recordRecoveryResult(actions[0]!.recoveryActionId, {
      succeeded: false,
      errorCode: "PROVIDER_TIMEOUT",
    });
    await service.recordRecoveryResult(actions[0]!.recoveryActionId, {
      succeeded: true,
    });
    expect((await service.listRecoveryActions(run.reconciliationRunId))[0]).toMatchObject({
      state: "completed",
      attempts: 2,
    });

    await expect(
      runtimePool.query(
        `INSERT INTO pollycar_finance.reconciliation_runs (
           reconciliation_run_id, provider, merchant_id, business_date, record_type,
           source_file_id, source_file_digest, state, expected_count, expected_amount_minor,
           actual_count, actual_amount_minor, difference_count, difference_amount_minor,
           statement_signature_verified, control_totals_verified, sources_complete, synthetic
         ) VALUES (
           'forbidden', 'provider', 'merchant', '2026-07-16', 'payment',
           'file', $1, 'balanced', 0, 0, 0, 0, 0, 0, true, true, true, true
         )`,
        ["a".repeat(64)],
      ),
    ).rejects.toThrow("permission denied");
  });
});

function runInput(
  suffix: string,
  facts: readonly ReconciliationFact[],
  businessDate = "2026-07-14",
) {
  return {
    reconciliationRunId: `run-stage7-${suffix}`,
    provider: "synthetic-provider",
    merchantId: "synthetic-merchant",
    businessDate,
    recordType: "payment" as const,
    sourceFileId: `synthetic-file-${suffix}`,
    sourceFileDigest: digestFor(suffix),
    statementSignatureVerified: true,
    controlTotalsVerified: true,
    facts,
  };
}

function balancedFacts(businessDate = "2026-07-14"): readonly ReconciliationFact[] {
  const suffix = businessDate.replaceAll("-", "");
  const common = {
    recordType: "payment" as const,
    businessDate,
    merchantId: "synthetic-merchant",
    internalOrderId: `payment-order-${suffix}`,
    providerOrderId: `provider-order-${suffix}`,
    providerEventId: `provider-event-${suffix}`,
    amountMinor: "10000",
    feeMinor: "200",
    currency: "CNY" as const,
    state: "succeeded",
    occurredAt: `${businessDate}T08:00:00.000Z`,
    settledAt: `${businessDate}T09:00:00.000Z`,
    late: false,
    synthetic: true as const,
  };
  return [
    {
      ...common,
      reconciliationFactId: `fact-business-${suffix}`,
      source: "business_order",
      sourceDigest: `digest-business-${suffix}`,
    },
    {
      ...common,
      reconciliationFactId: `fact-payment-${suffix}`,
      source: "payment_aggregate",
      sourceDigest: `digest-payment-${suffix}`,
    },
    {
      ...common,
      reconciliationFactId: `fact-ledger-${suffix}`,
      source: "ledger",
      sourceDigest: `digest-ledger-${suffix}`,
    },
    {
      ...common,
      reconciliationFactId: `fact-provider-${suffix}`,
      source: "provider_statement",
      sourceDigest: `digest-provider-${suffix}`,
    },
  ];
}

function digestFor(value: string): string {
  return Buffer.from(value, "utf8").toString("hex").padEnd(64, "0").slice(0, 64);
}
