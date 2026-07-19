import type {
  FinancialAction,
  ReconciliationDifference,
  ReconciliationEvaluation,
  ReconciliationRecoveryAction,
  ReconciliationRepository,
  ReconciliationRun,
  ReconciliationRunState,
  ReconciliationRecordType,
  ReconciliationDifferenceType,
  ReconciliationRecoveryActionType,
} from "../application/financial-reconciliation-service.js";
import type { PostgresTransaction } from "./postgres-transaction.js";

type RunRow = Readonly<{
  reconciliation_run_id: string;
  provider: string;
  merchant_id: string;
  business_date: string;
  record_type: ReconciliationRecordType;
  source_file_id: string;
  source_file_digest: string;
  state: ReconciliationRunState;
  expected_count: string;
  expected_amount_minor: string;
  actual_count: string;
  actual_amount_minor: string;
  difference_count: string;
  difference_amount_minor: string;
  statement_signature_verified: boolean;
  control_totals_verified: boolean;
  sources_complete: boolean;
}>;

type DifferenceRow = Readonly<{
  reconciliation_item_id: string;
  reconciliation_run_id: string;
  difference_type: ReconciliationDifferenceType;
  internal_reference: string;
  provider_reference: string;
  internal_amount_minor: string;
  provider_amount_minor: string;
  difference_amount_minor: string;
  currency: "CNY";
  state: "open" | "resolved";
  risk_level: "medium" | "high" | "critical";
  details: unknown;
  resolution_type: string | null;
  resolved_by: string | null;
  reviewed_by: string | null;
  resolution_evidence_reference: string | null;
}>;

type RecoveryRow = Readonly<{
  recovery_action_id: string;
  reconciliation_run_id: string;
  reconciliation_item_id: string;
  action_type: ReconciliationRecoveryActionType;
  state: "pending" | "failed" | "completed";
  attempts: number;
  last_error_code: string | null;
}>;

export class PostgresReconciliationRepository implements ReconciliationRepository {
  public constructor(private readonly transaction: PostgresTransaction) {}

  public async saveEvaluation(
    evaluation: ReconciliationEvaluation,
  ): Promise<ReconciliationRun> {
    const client = this.transaction.requireCurrentClient();
    await client.query(
      "SELECT * FROM pollycar_finance.record_reconciliation_evaluation($1::jsonb)",
      [JSON.stringify(toDatabaseEvaluation(evaluation))],
    );
    const run = await this.getRun(evaluation.run.reconciliationRunId);
    if (run) return run;
    const replayed = await client.query<{ reconciliation_run_id: string }>(
      `SELECT reconciliation_run_id
         FROM pollycar_finance.reconciliation_runs
        WHERE source_file_digest = $1`,
      [evaluation.run.sourceFileDigest],
    );
    const replayedId = replayed.rows[0]?.reconciliation_run_id;
    if (!replayedId) throw new Error("RECONCILIATION_RUN_RESULT_MISSING");
    const existing = await this.getRun(replayedId);
    if (!existing) throw new Error("RECONCILIATION_RUN_RESULT_MISSING");
    return existing;
  }

  public async getRun(reconciliationRunId: string): Promise<ReconciliationRun | undefined> {
    const result = await this.transaction.currentClient().query<RunRow>(
      `SELECT reconciliation_run_id, provider, merchant_id, business_date::text,
              record_type, source_file_id, source_file_digest, state,
              expected_count::text, expected_amount_minor::text,
              actual_count::text, actual_amount_minor::text,
              difference_count::text, difference_amount_minor::text,
              statement_signature_verified, control_totals_verified, sources_complete
         FROM pollycar_finance.reconciliation_runs
        WHERE reconciliation_run_id = $1`,
      [reconciliationRunId],
    );
    return result.rows[0] ? mapRun(result.rows[0]) : undefined;
  }

  public async listDifferences(
    reconciliationRunId: string,
  ): Promise<readonly ReconciliationDifference[]> {
    const result = await this.transaction.currentClient().query<DifferenceRow>(
      `SELECT reconciliation_item_id, reconciliation_run_id, difference_type,
              internal_reference, provider_reference, internal_amount_minor::text,
              provider_amount_minor::text, difference_amount_minor::text,
              currency, state, risk_level, details, resolution_type,
              resolved_by, reviewed_by, resolution_evidence_reference
         FROM pollycar_finance.reconciliation_items
        WHERE reconciliation_run_id = $1
        ORDER BY reconciliation_item_id`,
      [reconciliationRunId],
    );
    return result.rows.map((row) => ({
      reconciliationItemId: row.reconciliation_item_id,
      reconciliationRunId: row.reconciliation_run_id,
      differenceType: row.difference_type,
      internalReference: row.internal_reference,
      providerReference: row.provider_reference,
      internalAmountMinor: row.internal_amount_minor,
      providerAmountMinor: row.provider_amount_minor,
      differenceAmountMinor: row.difference_amount_minor,
      currency: row.currency,
      state: row.state,
      riskLevel: row.risk_level,
      details: row.details as Readonly<Record<string, string | boolean>>,
      ...(row.resolution_type ? { resolutionType: row.resolution_type } : {}),
      ...(row.resolved_by ? { resolvedBy: row.resolved_by } : {}),
      ...(row.reviewed_by ? { reviewedBy: row.reviewed_by } : {}),
      ...(row.resolution_evidence_reference
        ? { resolutionEvidenceReference: row.resolution_evidence_reference }
        : {}),
      synthetic: true,
    }));
  }

  public async listRecoveryActions(
    reconciliationRunId: string,
  ): Promise<readonly ReconciliationRecoveryAction[]> {
    const result = await this.transaction.currentClient().query<RecoveryRow>(
      `SELECT recovery_action_id, reconciliation_run_id, reconciliation_item_id,
              action_type, state, attempts, last_error_code
         FROM pollycar_finance.reconciliation_recovery_actions
        WHERE reconciliation_run_id = $1
        ORDER BY recovery_action_id`,
      [reconciliationRunId],
    );
    return result.rows.map((row) => ({
      recoveryActionId: row.recovery_action_id,
      reconciliationRunId: row.reconciliation_run_id,
      reconciliationItemId: row.reconciliation_item_id,
      actionType: row.action_type,
      state: row.state,
      attempts: row.attempts,
      ...(row.last_error_code ? { lastErrorCode: row.last_error_code } : {}),
      synthetic: true,
    }));
  }

  public async closeRun(reconciliationRunId: string): Promise<void> {
    await this.transaction
      .requireCurrentClient()
      .query("SELECT pollycar_finance.close_reconciliation_run($1)", [
        reconciliationRunId,
      ]);
  }

  public async assertActionAllowed(
    reconciliationRunId: string,
    action: FinancialAction,
  ): Promise<void> {
    await this.transaction
      .currentClient()
      .query("SELECT pollycar_finance.assert_reconciliation_action_allowed($1, $2)", [
        reconciliationRunId,
        action,
      ]);
  }

  public async closeBusinessDate(
    businessDate: string,
    preparedBy: string,
    reviewedBy: string,
  ): Promise<void> {
    await this.transaction
      .requireCurrentClient()
      .query("SELECT pollycar_finance.close_financial_business_date($1, $2, $3)", [
        businessDate,
        preparedBy,
        reviewedBy,
      ]);
  }

  public async recordRecoveryResult(
    recoveryActionId: string,
    result: Readonly<{ succeeded: boolean; errorCode?: string }>,
  ): Promise<void> {
    await this.transaction
      .requireCurrentClient()
      .query(
        "SELECT pollycar_finance.record_reconciliation_recovery_result($1, $2, $3)",
        [recoveryActionId, result.succeeded, result.errorCode ?? null],
      );
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
    await this.transaction
      .requireCurrentClient()
      .query(
        "SELECT pollycar_finance.resolve_reconciliation_item($1, $2, $3, $4, $5)",
        [
          reconciliationItemId,
          input.resolutionType,
          input.resolvedBy,
          input.reviewedBy,
          input.resolutionEvidenceReference,
        ],
      );
  }
}

function mapRun(row: RunRow): ReconciliationRun {
  return {
    reconciliationRunId: row.reconciliation_run_id,
    provider: row.provider,
    merchantId: row.merchant_id,
    businessDate: row.business_date,
    recordType: row.record_type,
    sourceFileId: row.source_file_id,
    sourceFileDigest: row.source_file_digest,
    state: row.state,
    expectedCount: row.expected_count,
    expectedAmountMinor: row.expected_amount_minor,
    actualCount: row.actual_count,
    actualAmountMinor: row.actual_amount_minor,
    differenceCount: row.difference_count,
    differenceAmountMinor: row.difference_amount_minor,
    statementSignatureVerified: row.statement_signature_verified,
    controlTotalsVerified: row.control_totals_verified,
    sourcesComplete: row.sources_complete,
    synthetic: true,
  };
}

function toDatabaseEvaluation(evaluation: ReconciliationEvaluation) {
  return {
    run: {
      reconciliation_run_id: evaluation.run.reconciliationRunId,
      provider: evaluation.run.provider,
      merchant_id: evaluation.run.merchantId,
      business_date: evaluation.run.businessDate,
      record_type: evaluation.run.recordType,
      source_file_id: evaluation.run.sourceFileId,
      source_file_digest: evaluation.run.sourceFileDigest,
      state: evaluation.run.state,
      expected_count: evaluation.run.expectedCount,
      expected_amount_minor: evaluation.run.expectedAmountMinor,
      actual_count: evaluation.run.actualCount,
      actual_amount_minor: evaluation.run.actualAmountMinor,
      difference_count: evaluation.run.differenceCount,
      difference_amount_minor: evaluation.run.differenceAmountMinor,
      statement_signature_verified: evaluation.run.statementSignatureVerified,
      control_totals_verified: evaluation.run.controlTotalsVerified,
      sources_complete: evaluation.run.sourcesComplete,
    },
    facts: evaluation.facts.map((fact) => ({
      reconciliation_fact_id: fact.reconciliationFactId,
      source: fact.source,
      record_type: fact.recordType,
      business_date: fact.businessDate,
      merchant_id: fact.merchantId,
      internal_order_id: fact.internalOrderId,
      provider_order_id: fact.providerOrderId,
      provider_event_id: fact.providerEventId,
      amount_minor: fact.amountMinor,
      fee_minor: fact.feeMinor,
      currency: fact.currency,
      state: fact.state,
      occurred_at: fact.occurredAt,
      settled_at: fact.settledAt,
      source_digest: fact.sourceDigest,
      late: fact.late,
    })),
    differences: evaluation.differences.map((difference) => ({
      reconciliation_item_id: difference.reconciliationItemId,
      difference_type: difference.differenceType,
      internal_reference: difference.internalReference,
      provider_reference: difference.providerReference,
      internal_amount_minor: difference.internalAmountMinor,
      provider_amount_minor: difference.providerAmountMinor,
      difference_amount_minor: difference.differenceAmountMinor,
      currency: difference.currency,
      state: difference.state,
      risk_level: difference.riskLevel,
      details: difference.details,
    })),
    recovery_actions: evaluation.recoveryActions.map((action) => ({
      recovery_action_id: action.recoveryActionId,
      reconciliation_item_id: action.reconciliationItemId,
      action_type: action.actionType,
      state: action.state,
      attempts: action.attempts,
    })),
  };
}
