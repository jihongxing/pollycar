import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { loadPostgresIntegrationTestConfig } from "@pollycar/configuration";
import { FinancialReconciliationService } from "../application/financial-reconciliation-service.js";
import { SyntheticLedgerTemplateService } from "../application/synthetic-ledger-template-service.js";
import { SyntheticOperatorFundsService } from "../application/synthetic-operator-funds-service.js";
import { runMigrations } from "./migrations.js";
import { PostgresLedgerRepository } from "./postgres-ledger-repository.js";
import { PostgresOperatorFundsRepository } from "./postgres-operator-funds-repository.js";
import { PostgresReconciliationRepository } from "./postgres-reconciliation-repository.js";
import { PostgresTransaction } from "./postgres-transaction.js";

const databaseUrl =
  loadPostgresIntegrationTestConfig().operatorFundsDatabaseUrl;
const describePostgres = databaseUrl ? describe.sequential : describe.skip;
const migrationsDirectory = fileURLToPath(new URL("../../migrations", import.meta.url));

describePostgres("阶段八多运营主体资金编排", () => {
  const migrationPool = new Pool({
    connectionString: databaseUrl,
    application_name: "pollycar-operator-funds-migrations",
    max: 2,
  });
  let runtimePool: Pool;
  let service: SyntheticOperatorFundsService;
  let templates: SyntheticLedgerTemplateService;

  beforeAll(async () => {
    const applied = await runMigrations(migrationPool, migrationsDirectory);
    expect(applied).toContain("0009_operator_funds_orchestration");
    await migrationPool.query(
      "ALTER ROLE pollycar_ledger_runtime PASSWORD 'synthetic-operator-funds-runtime'",
    );
    await seedClosedReconciliationRun(migrationPool);
    const runtimeUrl = new URL(databaseUrl!);
    runtimeUrl.username = "pollycar_ledger_runtime";
    runtimeUrl.password = "synthetic-operator-funds-runtime";
    runtimePool = new Pool({
      connectionString: runtimeUrl.toString(),
      application_name: "pollycar-operator-funds-runtime",
      max: 4,
    });
    const transaction = new PostgresTransaction(runtimePool);
    const ledger = new PostgresLedgerRepository(transaction);
    templates = new SyntheticLedgerTemplateService(ledger, transaction);
    const reconciliation = new FinancialReconciliationService(
      new PostgresReconciliationRepository(transaction),
      transaction,
    );
    service = new SyntheticOperatorFundsService(
      new PostgresOperatorFundsRepository(transaction),
      templates,
      reconciliation,
      transaction,
    );
  });

  afterAll(async () => {
    await runtimePool?.end();
    await migrationPool.end();
  });

  it("主运营快照、尾差分配、清算和付款均引用唯一复式账本", async () => {
    await templates.postPaymentSucceeded({
      paymentOrderId: "payment-stage8-1",
      tripId: "trip-stage8-1",
      passengerAccountId: "passenger-stage8-1",
      legalEntityId: "platform-legal-stage8",
      providerId: "provider-stage8",
      merchantAccountId: "merchant-stage8",
      amountMinor: "9999",
      sourceEventId: "payment-event-stage8-1",
      idempotencyKey: "payment-key-stage8-1",
      occurredAt: "2026-07-14T08:00:00.000Z",
    });
    await service.createPrimaryMembership({
      membershipId: "membership-stage8-1",
      driverAccountId: "driver-stage8-1",
      operatorEntityId: "operator-stage8-1",
      cityCode: "shanghai",
      vehicleId: "vehicle-stage8-1",
      effectiveFrom: "2026-07-14T00:00:00.000Z",
    });
    const allocation = await service.allocateTrip({
      allocationId: "allocation-stage8-1",
      reconciliationRunId: "reconciliation-stage8-closed",
      paymentOrderId: "payment-stage8-1",
      tripId: "trip-stage8-1",
      passengerAccountId: "passenger-stage8-1",
      driverAccountId: "driver-stage8-1",
      cityCode: "shanghai",
      vehicleId: "vehicle-stage8-1",
      businessDate: "2026-07-14",
      accountingPeriod: "2026-07",
      productCode: "ride",
      allocableFareMinor: "9999",
      sourceEventId: "allocation-event-stage8-1",
      idempotencyKey: "allocation-key-stage8-1",
      occurredAt: "2026-07-14T10:00:00.000Z",
    });
    expect(allocation).toMatchObject({
      platformShareMinor: "1499",
      operatorShareMinor: "4499",
      driverShareMinor: "4001",
    });

    await service.createSettlementBatch({
      settlementBatchId: "settlement-stage8-1",
      reconciliationRunId: "reconciliation-stage8-closed",
      operatorEntityId: "operator-stage8-1",
      businessDate: "2026-07-14",
      allocationIds: [allocation.allocationId],
      preparedBy: "finance-maker-stage8",
    });
    await service.completeSettlementBatch({
      settlementBatchId: "settlement-stage8-1",
      reviewedBy: "finance-reviewer-stage8",
      providerBatchId: "provider-settlement-stage8-1",
    });

    await service.createPayoutBatch({
      payoutBatchId: "payout-stage8-1",
      reconciliationRunId: "reconciliation-stage8-closed",
      operatorEntityId: "operator-stage8-1",
      driverAccountId: "driver-stage8-1",
      businessDate: "2026-07-15",
      allocationIds: [allocation.allocationId],
      preparedBy: "finance-maker-stage8",
    });
    await service.approvePayoutBatch("payout-stage8-1", "finance-reviewer-stage8");
    await service.requestPayout({
      payoutBatchId: "payout-stage8-1",
      sourceEventId: "payout-request-event-stage8-1",
      idempotencyKey: "payout-request-key-stage8-1",
      occurredAt: "2026-07-15T04:00:00.000Z",
    });
    await service.completePayout({
      payoutBatchId: "payout-stage8-1",
      legalEntityId: "operator-legal-stage8-1",
      bankAccountRef: "operator-bank-stage8-1",
      payoutProviderId: "payout-provider-stage8-1",
      payoutFeeMinor: "10",
      sourceEventId: "payout-complete-event-stage8-1",
      idempotencyKey: "payout-complete-key-stage8-1",
      occurredAt: "2026-07-15T06:00:00.000Z",
    });

    const persisted = await migrationPool.query<{
      allocations: string;
      ledger_transactions: string;
      payout_state: string;
      payout_fee_minor: string;
    }>(
      `SELECT
         (SELECT count(*)::text FROM pollycar_finance.financial_allocations) AS allocations,
         (SELECT count(*)::text FROM pollycar_finance.ledger_transactions
           WHERE transaction_type IN (
             'ALLOCATION_15_45_40', 'DRIVER_PAYOUT_REQUESTED',
             'DRIVER_PAYOUT_COMPLETED'
           )) AS ledger_transactions,
         (SELECT state FROM pollycar_finance.driver_payout_batches
           WHERE payout_batch_id = 'payout-stage8-1') AS payout_state,
         (SELECT payout_fee_minor::text FROM pollycar_finance.driver_payout_batches
           WHERE payout_batch_id = 'payout-stage8-1') AS payout_fee_minor`,
    );
    expect(persisted.rows[0]).toEqual({
      allocations: "1",
      ledger_transactions: "3",
      payout_state: "succeeded",
      payout_fee_minor: "10",
    });
  });

  it("数据库拒绝第二个有效主运营关系、重复入批和运行时直接写表", async () => {
    await expect(
      service.createPrimaryMembership({
        membershipId: "membership-stage8-conflict",
        driverAccountId: "driver-stage8-1",
        operatorEntityId: "operator-stage8-2",
        cityCode: "shanghai",
        vehicleId: "vehicle-stage8-1",
        effectiveFrom: "2026-07-14T01:00:00.000Z",
      }),
    ).rejects.toThrow();
    await expect(
      service.createPayoutBatch({
        payoutBatchId: "payout-stage8-duplicate",
        reconciliationRunId: "reconciliation-stage8-closed",
        operatorEntityId: "operator-stage8-1",
        driverAccountId: "driver-stage8-1",
        businessDate: "2026-07-16",
        allocationIds: ["allocation-stage8-1"],
        preparedBy: "finance-maker-stage8",
      }),
    ).rejects.toThrow();
    await expect(
      runtimePool.query(
        `INSERT INTO pollycar_finance.operator_fund_cases (
           fund_case_id, operator_entity_id, case_type, reference_type,
           reference_id, amount_minor, state, reason_code, evidence_reference
         ) VALUES (
           'forbidden', 'operator-stage8-1', 'payout_unknown', 'driver_payout',
           'payout-stage8-1', 1, 'open', 'forbidden', 'forbidden'
         )`,
      ),
    ).rejects.toThrow();
    await expect(
      runtimePool.query(
        "SELECT * FROM pollycar_finance.post_ledger_transaction($1::jsonb)",
        [{}],
      ),
    ).rejects.toThrow();
  });

  it("提前结算保持关闭且编排 Schema 不包含余额或钱包表", async () => {
    await expect(service.requestEarlySettlement()).rejects.toThrow(
      "DRIVER_EARLY_SETTLEMENT_DISABLED",
    );
    const forbiddenTables = await migrationPool.query<{ table_name: string }>(
      `SELECT table_name
         FROM information_schema.tables
        WHERE table_schema = 'pollycar_finance'
          AND table_name IN (
            'operator_balances', 'driver_balances', 'operator_wallets', 'driver_wallets'
          )`,
    );
    expect(forbiddenTables.rows).toEqual([]);
  });
});

async function seedClosedReconciliationRun(pool: Pool): Promise<void> {
  await pool.query(
    `INSERT INTO pollycar_finance.reconciliation_runs (
       reconciliation_run_id, provider, merchant_id, business_date, record_type,
       source_file_id, source_file_digest, state, expected_count,
       expected_amount_minor, actual_count, actual_amount_minor, difference_count,
       difference_amount_minor, statement_signature_verified,
       control_totals_verified, sources_complete, synthetic, completed_at
     ) VALUES (
       'reconciliation-stage8-closed', 'synthetic-provider-stage8',
       'synthetic-merchant-stage8', '2026-07-14', 'settlement',
       'source-stage8', repeat('a', 64), 'closed', 1, 9999, 1, 9999, 0, 0,
       true, true, true, true, now()
     )`,
  );
}
