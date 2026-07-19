import type {
  DriverOperatorMembership,
  DriverPayoutBatch,
  FinancialAllocation,
  OperatorFundCase,
  OperatorFundsRepository,
  OperatorSettlementBatch,
} from "../application/synthetic-operator-funds-service.js";
import type { PostgresTransaction } from "./postgres-transaction.js";

type MembershipRow = Readonly<{
  membership_id: string;
  driver_account_id: string;
  operator_entity_id: string;
  city_code: string;
  vehicle_id: string;
  state: "active" | "ended";
  effective_from: string;
  effective_to: string | null;
}>;

type AllocationRow = Readonly<{
  allocation_id: string;
  payment_order_id: string;
  trip_id: string;
  driver_account_id: string;
  operator_entity_id: string;
  business_date: string;
  allocable_fare_minor: string;
  platform_share_minor: string;
  operator_share_minor: string;
  driver_share_minor: string;
  rule_version: "allocation-15-45-40-v1";
  ledger_transaction_id: string;
}>;

type SettlementBatchRow = Readonly<{
  settlement_batch_id: string;
  operator_entity_id: string;
  business_date: string;
  reconciliation_run_id: string;
  state: "ready" | "succeeded";
  allocation_ids: unknown;
  gross_amount_minor: string;
  prepared_by: string;
  reviewed_by: string | null;
  provider_batch_id: string | null;
}>;

type PayoutBatchRow = Readonly<{
  payout_batch_id: string;
  operator_entity_id: string;
  driver_account_id: string;
  business_date: string;
  reconciliation_run_id: string;
  state: "awaiting_review" | "approved" | "processing" | "succeeded";
  allocation_ids: unknown;
  gross_payable_minor: string;
  payout_fee_minor: string;
  prepared_by: string;
  reviewed_by: string | null;
  requested_ledger_transaction_id: string | null;
  completed_ledger_transaction_id: string | null;
}>;

export class PostgresOperatorFundsRepository implements OperatorFundsRepository {
  public constructor(private readonly transaction: PostgresTransaction) {}

  public createMembership(
    input: Omit<DriverOperatorMembership, "state" | "synthetic">,
  ): Promise<void> {
    return this.command({
      command_type: "create_membership",
      membership_id: input.membershipId,
      driver_account_id: input.driverAccountId,
      operator_entity_id: input.operatorEntityId,
      city_code: input.cityCode,
      vehicle_id: input.vehicleId,
      effective_from: input.effectiveFrom,
    });
  }

  public async findActiveMembership(input: Readonly<{
    driverAccountId: string;
    cityCode: string;
    vehicleId: string;
    effectiveAt: string;
  }>): Promise<DriverOperatorMembership | undefined> {
    const result = await this.transaction.currentClient().query<MembershipRow>(
      `SELECT membership_id, driver_account_id, operator_entity_id, city_code,
              vehicle_id, state, effective_from::text, effective_to::text
         FROM pollycar_finance.driver_operator_memberships
        WHERE driver_account_id = $1
          AND city_code = $2
          AND vehicle_id = $3
          AND state = 'active'
          AND effective_from <= $4::timestamptz`,
      [input.driverAccountId, input.cityCode, input.vehicleId, input.effectiveAt],
    );
    const row = result.rows[0];
    return row
      ? {
          membershipId: row.membership_id,
          driverAccountId: row.driver_account_id,
          operatorEntityId: row.operator_entity_id,
          cityCode: row.city_code,
          vehicleId: row.vehicle_id,
          state: row.state,
          effectiveFrom: row.effective_from,
          ...(row.effective_to ? { effectiveTo: row.effective_to } : {}),
          synthetic: true,
        }
      : undefined;
  }

  public saveAllocation(allocation: FinancialAllocation): Promise<void> {
    return this.command({
      command_type: "save_allocation",
      allocation_id: allocation.allocationId,
      payment_order_id: allocation.paymentOrderId,
      trip_id: allocation.tripId,
      driver_account_id: allocation.driverAccountId,
      operator_entity_id: allocation.operatorEntityId,
      business_date: allocation.businessDate,
      allocable_fare_minor: allocation.allocableFareMinor,
      platform_share_minor: allocation.platformShareMinor,
      operator_share_minor: allocation.operatorShareMinor,
      driver_share_minor: allocation.driverShareMinor,
      rule_version: allocation.ruleVersion,
      ledger_transaction_id: allocation.ledgerTransactionId,
    });
  }

  public async getAllocation(allocationId: string): Promise<FinancialAllocation | undefined> {
    const result = await this.transaction.currentClient().query<AllocationRow>(
      `SELECT allocation_id, payment_order_id, trip_id, driver_account_id,
              operator_entity_id, business_date::text, allocable_fare_minor::text,
              platform_share_minor::text, operator_share_minor::text,
              driver_share_minor::text, rule_version, ledger_transaction_id::text
         FROM pollycar_finance.financial_allocations
        WHERE allocation_id = $1`,
      [allocationId],
    );
    const row = result.rows[0];
    return row ? mapAllocation(row) : undefined;
  }

  public createSettlementBatch(batch: OperatorSettlementBatch): Promise<void> {
    return this.command({
      command_type: "create_settlement_batch",
      settlement_batch_id: batch.settlementBatchId,
      operator_entity_id: batch.operatorEntityId,
      business_date: batch.businessDate,
      reconciliation_run_id: batch.reconciliationRunId,
      allocation_ids: batch.allocationIds,
      gross_amount_minor: batch.grossAmountMinor,
      prepared_by: batch.preparedBy,
    });
  }

  public async getSettlementBatch(
    settlementBatchId: string,
  ): Promise<OperatorSettlementBatch | undefined> {
    const result = await this.transaction.currentClient().query<SettlementBatchRow>(
      `SELECT settlement_batch_id, operator_entity_id, business_date::text,
              reconciliation_run_id, state, allocation_ids, gross_amount_minor::text,
              prepared_by, reviewed_by, provider_batch_id
         FROM pollycar_finance.operator_settlement_batches
        WHERE settlement_batch_id = $1`,
      [settlementBatchId],
    );
    const row = result.rows[0];
    return row
      ? {
          settlementBatchId: row.settlement_batch_id,
          operatorEntityId: row.operator_entity_id,
          businessDate: row.business_date,
          reconciliationRunId: row.reconciliation_run_id,
          state: row.state,
          allocationIds: toStringArray(row.allocation_ids),
          grossAmountMinor: row.gross_amount_minor,
          preparedBy: row.prepared_by,
          ...(row.reviewed_by ? { reviewedBy: row.reviewed_by } : {}),
          ...(row.provider_batch_id ? { providerBatchId: row.provider_batch_id } : {}),
          synthetic: true,
        }
      : undefined;
  }

  public completeSettlementBatch(input: Readonly<{
    settlementBatchId: string;
    reviewedBy: string;
    providerBatchId: string;
  }>): Promise<void> {
    return this.command({
      command_type: "complete_settlement_batch",
      settlement_batch_id: input.settlementBatchId,
      reviewed_by: input.reviewedBy,
      provider_batch_id: input.providerBatchId,
    });
  }

  public createPayoutBatch(batch: DriverPayoutBatch): Promise<void> {
    return this.command({
      command_type: "create_payout_batch",
      payout_batch_id: batch.payoutBatchId,
      operator_entity_id: batch.operatorEntityId,
      driver_account_id: batch.driverAccountId,
      business_date: batch.businessDate,
      reconciliation_run_id: batch.reconciliationRunId,
      allocation_ids: batch.allocationIds,
      gross_payable_minor: batch.grossPayableMinor,
      prepared_by: batch.preparedBy,
    });
  }

  public async getPayoutBatch(payoutBatchId: string): Promise<DriverPayoutBatch | undefined> {
    const result = await this.transaction.currentClient().query<PayoutBatchRow>(
      `SELECT payout_batch_id, operator_entity_id, driver_account_id,
              business_date::text, reconciliation_run_id, state, allocation_ids,
              gross_payable_minor::text, payout_fee_minor::text, prepared_by,
              reviewed_by, requested_ledger_transaction_id::text,
              completed_ledger_transaction_id::text
         FROM pollycar_finance.driver_payout_batches
        WHERE payout_batch_id = $1`,
      [payoutBatchId],
    );
    const row = result.rows[0];
    return row
      ? {
          payoutBatchId: row.payout_batch_id,
          operatorEntityId: row.operator_entity_id,
          driverAccountId: row.driver_account_id,
          businessDate: row.business_date,
          reconciliationRunId: row.reconciliation_run_id,
          state: row.state,
          allocationIds: toStringArray(row.allocation_ids),
          grossPayableMinor: row.gross_payable_minor,
          payoutFeeMinor: row.payout_fee_minor,
          preparedBy: row.prepared_by,
          ...(row.reviewed_by ? { reviewedBy: row.reviewed_by } : {}),
          ...(row.requested_ledger_transaction_id
            ? { requestedLedgerTransactionId: row.requested_ledger_transaction_id }
            : {}),
          ...(row.completed_ledger_transaction_id
            ? { completedLedgerTransactionId: row.completed_ledger_transaction_id }
            : {}),
          synthetic: true,
        }
      : undefined;
  }

  public approvePayoutBatch(payoutBatchId: string, reviewedBy: string): Promise<void> {
    return this.command({
      command_type: "approve_payout_batch",
      payout_batch_id: payoutBatchId,
      reviewed_by: reviewedBy,
    });
  }

  public markPayoutRequested(
    payoutBatchId: string,
    ledgerTransactionId: string,
  ): Promise<void> {
    return this.command({
      command_type: "mark_payout_requested",
      payout_batch_id: payoutBatchId,
      ledger_transaction_id: ledgerTransactionId,
    });
  }

  public markPayoutCompleted(input: Readonly<{
    payoutBatchId: string;
    ledgerTransactionId: string;
    payoutFeeMinor: string;
  }>): Promise<void> {
    return this.command({
      command_type: "mark_payout_completed",
      payout_batch_id: input.payoutBatchId,
      ledger_transaction_id: input.ledgerTransactionId,
      payout_fee_minor: input.payoutFeeMinor,
    });
  }

  public createFundCase(fundCase: OperatorFundCase): Promise<void> {
    return this.command({
      command_type: "create_fund_case",
      fund_case_id: fundCase.fundCaseId,
      operator_entity_id: fundCase.operatorEntityId,
      case_type: fundCase.caseType,
      reference_type: fundCase.referenceType,
      reference_id: fundCase.referenceId,
      amount_minor: fundCase.amountMinor,
      reason_code: fundCase.reasonCode,
      evidence_reference: fundCase.evidenceReference,
    });
  }

  private async command(command: Readonly<Record<string, unknown>>): Promise<void> {
    await this.transaction
      .requireCurrentClient()
      .query("SELECT pollycar_finance.apply_operator_funds_command($1::jsonb)", [
        JSON.stringify(command),
      ]);
  }
}

function mapAllocation(row: AllocationRow): FinancialAllocation {
  return {
    allocationId: row.allocation_id,
    paymentOrderId: row.payment_order_id,
    tripId: row.trip_id,
    driverAccountId: row.driver_account_id,
    operatorEntityId: row.operator_entity_id,
    businessDate: row.business_date,
    allocableFareMinor: row.allocable_fare_minor,
    platformShareMinor: row.platform_share_minor,
    operatorShareMinor: row.operator_share_minor,
    driverShareMinor: row.driver_share_minor,
    ruleVersion: row.rule_version,
    ledgerTransactionId: row.ledger_transaction_id,
    synthetic: true,
  };
}

function toStringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error("OPERATOR_FUNDS_ALLOCATION_IDS_INVALID");
  }
  return value;
}
