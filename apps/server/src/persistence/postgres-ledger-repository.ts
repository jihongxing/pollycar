import { randomUUID } from "node:crypto";
import type {
  LedgerBalanceProjection,
  LedgerEntryRecord,
  LedgerPostResult,
  LedgerPostingCommand,
  LedgerRepository,
  LedgerTransactionRecord,
  LedgerTransactionType,
  LedgerSourceSystem,
  LedgerInitiatorType,
  LedgerDirection,
  LedgerCurrency,
} from "../ports/ledger.js";
import { createLedgerRequestDigest } from "./ledger-request-digest.js";
import type { PostgresTransaction } from "./postgres-transaction.js";

type PostRow = Readonly<{
  ledger_transaction_id: string;
  transaction_sequence: string;
  replayed: boolean;
}>;

type TransactionRow = Readonly<{
  ledger_transaction_id: string;
  transaction_sequence: string;
  transaction_type: LedgerTransactionType;
  business_reference_type: string;
  business_reference_id: string;
  source_system: LedgerSourceSystem;
  source_event_id: string;
  idempotency_key: string;
  request_digest: string;
  rule_version: string;
  occurred_at: string;
  posted_at: string;
  reversal_of_transaction_id: string | null;
  initiator_type: LedgerInitiatorType;
  reason_code: string | null;
  review_reference: string | null;
}>;

type EntryRow = Readonly<{
  ledger_entry_id: string;
  ledger_transaction_id: string;
  ledger_account_id: string;
  direction: LedgerDirection;
  amount_minor: string;
  currency: LedgerCurrency;
  entry_sequence: number;
}>;

type BalanceRow = Readonly<{
  ledger_account_id: string;
  debit_total_minor: string;
  credit_total_minor: string;
  balance_minor: string;
  last_transaction_sequence: string;
  updated_at: string;
}>;

export class PostgresLedgerRepository implements LedgerRepository {
  public constructor(private readonly transaction: PostgresTransaction) {}

  public async post(command: LedgerPostingCommand): Promise<LedgerPostResult> {
    const client = this.transaction.requireCurrentClient();
    const requestDigest = createLedgerRequestDigest(command);
    const request = {
      ledger_transaction_id: randomUUID(),
      transaction_type: command.transactionType,
      business_reference_type: command.businessReferenceType,
      business_reference_id: command.businessReferenceId,
      source_system: command.sourceSystem,
      source_event_id: command.sourceEventId,
      idempotency_key: command.idempotencyKey,
      request_digest: requestDigest,
      rule_version: command.ruleVersion,
      occurred_at: command.occurredAt,
      initiator_type: command.initiatorType,
      reversal_of_transaction_id: command.reversalOfTransactionId ?? null,
      reason_code: command.reasonCode ?? null,
      review_reference: command.reviewReference ?? null,
      reconciliation_run_id: command.reconciliationRunId ?? null,
      entries: [...command.entries]
        .sort((left, right) => left.entrySequence - right.entrySequence)
        .map((entry) => ({
          ledger_entry_id: randomUUID(),
          entry_sequence: entry.entrySequence,
          direction: entry.direction,
          amount_minor: entry.amountMinor,
          currency: entry.currency,
          account: {
            ledger_account_id: randomUUID(),
            account_code: entry.account.accountCode,
            account_type: entry.account.accountType,
            currency: entry.account.currency,
            owner_type: entry.account.ownerType,
            owner_id: entry.account.ownerId,
            dimensions: entry.account.dimensions,
          },
        })),
    };
    const result = await client.query<PostRow>(
      "SELECT * FROM pollycar_finance.post_runtime_ledger_transaction($1::jsonb)",
      [JSON.stringify(request)],
    );
    const row = result.rows[0];
    if (!row) throw new Error("LEDGER_POST_RESULT_MISSING");
    return {
      ledgerTransactionId: row.ledger_transaction_id,
      transactionSequence: row.transaction_sequence,
      replayed: row.replayed,
    };
  }

  public async getTransaction(
    ledgerTransactionId: string,
  ): Promise<LedgerTransactionRecord | undefined> {
    const result = await this.transaction.currentClient().query<TransactionRow>(
      `SELECT ledger_transaction_id, transaction_sequence::text, transaction_type,
              business_reference_type, business_reference_id, source_system,
              source_event_id, idempotency_key, request_digest, rule_version,
              occurred_at::text, posted_at::text, reversal_of_transaction_id::text,
              initiator_type, reason_code, review_reference
         FROM pollycar_finance.ledger_transactions
        WHERE ledger_transaction_id = $1`,
      [ledgerTransactionId],
    );
    const row = result.rows[0];
    if (!row) return undefined;
    return {
      ledgerTransactionId: row.ledger_transaction_id,
      transactionSequence: row.transaction_sequence,
      transactionType: row.transaction_type,
      businessReferenceType: row.business_reference_type,
      businessReferenceId: row.business_reference_id,
      sourceSystem: row.source_system,
      sourceEventId: row.source_event_id,
      idempotencyKey: row.idempotency_key,
      requestDigest: row.request_digest,
      ruleVersion: row.rule_version,
      occurredAt: row.occurred_at,
      postedAt: row.posted_at,
      ...(row.reversal_of_transaction_id
        ? { reversalOfTransactionId: row.reversal_of_transaction_id }
        : {}),
      initiatorType: row.initiator_type,
      ...(row.reason_code ? { reasonCode: row.reason_code } : {}),
      ...(row.review_reference ? { reviewReference: row.review_reference } : {}),
    };
  }

  public async listEntries(ledgerTransactionId: string): Promise<readonly LedgerEntryRecord[]> {
    const result = await this.transaction.currentClient().query<EntryRow>(
      `SELECT ledger_entry_id, ledger_transaction_id, ledger_account_id,
              direction, amount_minor::text, currency, entry_sequence
         FROM pollycar_finance.ledger_entries
        WHERE ledger_transaction_id = $1
        ORDER BY entry_sequence`,
      [ledgerTransactionId],
    );
    return result.rows.map((row) => ({
      ledgerEntryId: row.ledger_entry_id,
      ledgerTransactionId: row.ledger_transaction_id,
      ledgerAccountId: row.ledger_account_id,
      direction: row.direction,
      amountMinor: row.amount_minor,
      currency: row.currency,
      entrySequence: row.entry_sequence,
    }));
  }

  public async getBalance(
    ledgerAccountId: string,
  ): Promise<LedgerBalanceProjection | undefined> {
    const result = await this.transaction.currentClient().query<BalanceRow>(
      `SELECT ledger_account_id, debit_total_minor::text, credit_total_minor::text,
              balance_minor::text, last_transaction_sequence::text, updated_at::text
         FROM pollycar_finance.ledger_balance_projections
        WHERE ledger_account_id = $1`,
      [ledgerAccountId],
    );
    const row = result.rows[0];
    if (!row) return undefined;
    return {
      ledgerAccountId: row.ledger_account_id,
      debitTotalMinor: row.debit_total_minor,
      creditTotalMinor: row.credit_total_minor,
      balanceMinor: row.balance_minor,
      lastTransactionSequence: row.last_transaction_sequence,
      updatedAt: row.updated_at,
    };
  }
}
