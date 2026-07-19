import { createHash } from "node:crypto";
import type { LedgerPostingCommand } from "../ports/ledger.js";

type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | Readonly<{ [key: string]: JsonValue }>;

export function createLedgerRequestDigest(command: LedgerPostingCommand): string {
  const payload: JsonValue = {
    transaction_type: command.transactionType,
    business_reference_type: command.businessReferenceType,
    business_reference_id: command.businessReferenceId,
    source_system: command.sourceSystem,
    source_event_id: command.sourceEventId,
    rule_version: command.ruleVersion,
    occurred_at: command.occurredAt,
    initiator_type: command.initiatorType,
    reversal_of_transaction_id: command.reversalOfTransactionId ?? null,
    reason_code: command.reasonCode ?? null,
    review_reference: command.reviewReference ?? null,
    ...(command.reconciliationRunId
      ? { reconciliation_run_id: command.reconciliationRunId }
      : {}),
    entries: [...command.entries]
      .sort((left, right) => left.entrySequence - right.entrySequence)
      .map((entry) => ({
        entry_sequence: entry.entrySequence,
        direction: entry.direction,
        amount_minor: entry.amountMinor,
        currency: entry.currency,
        account: {
          account_code: entry.account.accountCode,
          account_type: entry.account.accountType,
          currency: entry.account.currency,
          owner_type: entry.account.ownerType,
          owner_id: entry.account.ownerId,
          dimensions: entry.account.dimensions,
        },
      })),
  };
  return createHash("sha256").update(canonicalizeJson(payload), "utf8").digest("hex");
}

function canonicalizeJson(value: JsonValue): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value) || !Number.isSafeInteger(value)) {
      throw new Error("LEDGER_CANONICAL_JSON_NUMBER_INVALID");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalizeJson(item)).join(",")}]`;
  }
  const objectValue = value as Readonly<Record<string, JsonValue>>;
  return `{${Object.keys(objectValue)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalizeJson(objectValue[key]!)}`)
    .join(",")}}`;
}
