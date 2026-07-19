export type LedgerAccountType = "asset" | "liability" | "revenue" | "expense" | "equity";
export type LedgerDirection = "debit" | "credit";
export type LedgerCurrency = "CNY";
export type LedgerInitiatorType = "system" | "finance_manual";
export type LedgerSourceSystem =
  | "payment_aggregate"
  | "trip_fulfillment"
  | "refund_aggregate"
  | "provider_settlement"
  | "payout_aggregate"
  | "reconciliation"
  | "manual_finance";
export type LedgerTransactionType =
  | "PAYMENT_SUCCEEDED"
  | "PROVIDER_SETTLED_WITH_FEE"
  | "REFUND_LIABILITY_CREATED"
  | "REFUND_COMPLETED"
  | "FULL_REVERSAL"
  | "ALLOCATION_15_45_40"
  | "DRIVER_PAYOUT_REQUESTED"
  | "DRIVER_PAYOUT_COMPLETED";

export interface LedgerAccountReference {
  readonly accountCode: string;
  readonly accountType: LedgerAccountType;
  readonly currency: LedgerCurrency;
  readonly ownerType: string;
  readonly ownerId: string;
  readonly dimensions: Readonly<Record<string, string>>;
}

export interface LedgerEntryCommand {
  readonly entrySequence: number;
  readonly direction: LedgerDirection;
  readonly amountMinor: string;
  readonly currency: LedgerCurrency;
  readonly account: LedgerAccountReference;
}

export interface LedgerPostingCommand {
  readonly transactionType: LedgerTransactionType;
  readonly businessReferenceType: string;
  readonly businessReferenceId: string;
  readonly sourceSystem: LedgerSourceSystem;
  readonly sourceEventId: string;
  readonly idempotencyKey: string;
  readonly ruleVersion: string;
  readonly occurredAt: string;
  readonly initiatorType: LedgerInitiatorType;
  readonly reversalOfTransactionId?: string;
  readonly reasonCode?: string;
  readonly reviewReference?: string;
  readonly reconciliationRunId?: string;
  readonly entries: readonly LedgerEntryCommand[];
}

export interface LedgerPostResult {
  readonly ledgerTransactionId: string;
  readonly transactionSequence: string;
  readonly replayed: boolean;
}

export interface LedgerTransactionRecord {
  readonly ledgerTransactionId: string;
  readonly transactionSequence: string;
  readonly transactionType: LedgerTransactionType;
  readonly businessReferenceType: string;
  readonly businessReferenceId: string;
  readonly sourceSystem: LedgerSourceSystem;
  readonly sourceEventId: string;
  readonly idempotencyKey: string;
  readonly requestDigest: string;
  readonly ruleVersion: string;
  readonly occurredAt: string;
  readonly postedAt: string;
  readonly reversalOfTransactionId?: string;
  readonly initiatorType: LedgerInitiatorType;
  readonly reasonCode?: string;
  readonly reviewReference?: string;
}

export interface LedgerEntryRecord {
  readonly ledgerEntryId: string;
  readonly ledgerTransactionId: string;
  readonly ledgerAccountId: string;
  readonly direction: LedgerDirection;
  readonly amountMinor: string;
  readonly currency: LedgerCurrency;
  readonly entrySequence: number;
}

export interface LedgerBalanceProjection {
  readonly ledgerAccountId: string;
  readonly debitTotalMinor: string;
  readonly creditTotalMinor: string;
  readonly balanceMinor: string;
  readonly lastTransactionSequence: string;
  readonly updatedAt: string;
}

export interface LedgerRepository {
  post(command: LedgerPostingCommand): Promise<LedgerPostResult>;
  getTransaction(ledgerTransactionId: string): Promise<LedgerTransactionRecord | undefined>;
  listEntries(ledgerTransactionId: string): Promise<readonly LedgerEntryRecord[]>;
  getBalance(ledgerAccountId: string): Promise<LedgerBalanceProjection | undefined>;
}
