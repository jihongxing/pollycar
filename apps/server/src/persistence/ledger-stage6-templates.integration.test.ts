import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { loadPostgresIntegrationTestConfig } from "@pollycar/configuration";
import { SyntheticLedgerTemplateService } from "../application/synthetic-ledger-template-service.js";
import { runMigrations } from "./migrations.js";
import { PostgresLedgerRepository } from "./postgres-ledger-repository.js";
import { PostgresTransaction } from "./postgres-transaction.js";

const databaseUrl =
  loadPostgresIntegrationTestConfig().ledgerTemplatesDatabaseUrl;
const describePostgres = databaseUrl ? describe.sequential : describe.skip;
const migrationsDirectory = fileURLToPath(new URL("../../migrations", import.meta.url));

describePostgres("阶段六合成账本交易模板", () => {
  const pool = new Pool({
    connectionString: databaseUrl,
    application_name: "pollycar-ledger-stage6-templates",
    max: 4,
  });
  const transaction = new PostgresTransaction(pool);
  const repository = new PostgresLedgerRepository(transaction);
  const service = new SyntheticLedgerTemplateService(repository, transaction);

  beforeAll(async () => {
    const applied = await runMigrations(pool, migrationsDirectory);
    expect(applied).toContain("0007_financial_ledger");
  });

  afterAll(async () => {
    await pool.end();
  });

  it("五类模板通过唯一入口过账且不产生阶段八交易", async () => {
    const payment = await service.postPaymentSucceeded({
      paymentOrderId: "payment-stage6-settlement",
      tripId: "trip-stage6-settlement",
      passengerAccountId: "passenger-stage6-settlement",
      legalEntityId: "legal-entity-stage6",
      providerId: "provider-stage6",
      merchantAccountId: "merchant-stage6",
      amountMinor: "10000",
      sourceEventId: "payment-event-stage6-settlement",
      idempotencyKey: "payment-key-stage6-settlement",
      occurredAt: "2026-07-14T08:00:00.000Z",
    });
    await service.postProviderSettledWithFee({
      providerSettlementId: "settlement-stage6",
      legalEntityId: "legal-entity-stage6",
      providerId: "provider-stage6",
      providerProduct: "synthetic-acquiring",
      merchantAccountId: "merchant-stage6",
      bankAccountRef: "synthetic-bank-stage6",
      grossAmountMinor: "10000",
      netAmountMinor: "9800",
      feeAmountMinor: "200",
      sourceEventId: "settlement-event-stage6",
      idempotencyKey: "settlement-key-stage6",
      occurredAt: "2026-07-14T08:30:00.000Z",
    });
    await service.postPaymentSucceeded({
      paymentOrderId: "payment-stage6-refund",
      tripId: "trip-stage6-refund",
      passengerAccountId: "passenger-stage6-refund",
      legalEntityId: "legal-entity-stage6",
      providerId: "provider-stage6",
      merchantAccountId: "merchant-stage6",
      amountMinor: "5000",
      sourceEventId: "payment-event-stage6-refund",
      idempotencyKey: "payment-key-stage6-refund",
      occurredAt: "2026-07-14T09:00:00.000Z",
    });
    await service.postRefundLiabilityCreated({
      refundOrderId: "refund-stage6",
      paymentOrderId: "payment-stage6-refund",
      tripId: "trip-stage6-refund",
      passengerAccountId: "passenger-stage6-refund",
      amountMinor: "5000",
      sourceEventId: "refund-liability-event-stage6",
      idempotencyKey: "refund-liability-key-stage6",
      occurredAt: "2026-07-14T09:30:00.000Z",
    });
    await service.postRefundCompleted({
      refundOrderId: "refund-stage6",
      passengerAccountId: "passenger-stage6-refund",
      legalEntityId: "legal-entity-stage6",
      providerId: "provider-stage6",
      merchantAccountId: "merchant-stage6",
      originalPaymentSettlementState: "settled",
      amountMinor: "5000",
      sourceEventId: "refund-completed-event-stage6",
      idempotencyKey: "refund-completed-key-stage6",
      occurredAt: "2026-07-14T10:00:00.000Z",
    });
    const reversal = await service.postFullReversal({
      originalLedgerTransactionId: payment.ledgerTransactionId,
      sourceEventId: "reversal-event-stage6",
      idempotencyKey: "reversal-key-stage6",
      occurredAt: "2026-07-14T10:30:00.000Z",
      reasonCode: "synthetic_stage6_correction",
      reviewReference: "synthetic-stage6-review",
    });

    const transactionTypes = await pool.query<{
      transaction_type: string;
      transaction_count: string;
      entry_count: string;
      outbox_count: string;
    }>(
      `SELECT transaction.transaction_type,
              count(DISTINCT transaction.ledger_transaction_id)::text AS transaction_count,
              count(DISTINCT entry.ledger_entry_id)::text AS entry_count,
              count(DISTINCT outbox.event_id)::text AS outbox_count
         FROM pollycar_finance.ledger_transactions AS transaction
         JOIN pollycar_finance.ledger_entries AS entry
           ON entry.ledger_transaction_id = transaction.ledger_transaction_id
         JOIN public.pollycar_outbox AS outbox
           ON outbox.aggregate_id = transaction.ledger_transaction_id::text
        GROUP BY transaction.transaction_type
        ORDER BY transaction.transaction_type`,
    );
    expect(transactionTypes.rows).toEqual([
      {
        transaction_type: "FULL_REVERSAL",
        transaction_count: "1",
        entry_count: "2",
        outbox_count: "1",
      },
      {
        transaction_type: "PAYMENT_SUCCEEDED",
        transaction_count: "2",
        entry_count: "4",
        outbox_count: "2",
      },
      {
        transaction_type: "PROVIDER_SETTLED_WITH_FEE",
        transaction_count: "1",
        entry_count: "3",
        outbox_count: "1",
      },
      {
        transaction_type: "REFUND_COMPLETED",
        transaction_count: "1",
        entry_count: "2",
        outbox_count: "1",
      },
      {
        transaction_type: "REFUND_LIABILITY_CREATED",
        transaction_count: "1",
        entry_count: "2",
        outbox_count: "1",
      },
    ]);

    const reversalEntries = await pool.query<{
      entry_sequence: number;
      original_direction: string;
      reversal_direction: string;
      original_amount: string;
      reversal_amount: string;
      same_account: boolean;
    }>(
      `SELECT original.entry_sequence,
              original.direction AS original_direction,
              reversed.direction AS reversal_direction,
              original.amount_minor::text AS original_amount,
              reversed.amount_minor::text AS reversal_amount,
              original.ledger_account_id = reversed.ledger_account_id AS same_account
         FROM pollycar_finance.ledger_entries AS original
         JOIN pollycar_finance.ledger_entries AS reversed
           ON reversed.ledger_transaction_id = $2
          AND reversed.entry_sequence = original.entry_sequence
        WHERE original.ledger_transaction_id = $1
        ORDER BY original.entry_sequence`,
      [payment.ledgerTransactionId, reversal.ledgerTransactionId],
    );
    expect(reversalEntries.rows).toEqual([
      {
        entry_sequence: 1,
        original_direction: "debit",
        reversal_direction: "credit",
        original_amount: "10000",
        reversal_amount: "10000",
        same_account: true,
      },
      {
        entry_sequence: 2,
        original_direction: "credit",
        reversal_direction: "debit",
        original_amount: "10000",
        reversal_amount: "10000",
        same_account: true,
      },
    ]);

    const forbidden = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count
         FROM pollycar_finance.ledger_transactions
        WHERE transaction_type IN (
          'ALLOCATION_15_45_40',
          'DRIVER_PAYOUT_REQUESTED',
          'DRIVER_PAYOUT_COMPLETED'
        )`,
    );
    expect(forbidden.rows[0]?.count).toBe("0");
  });
});
