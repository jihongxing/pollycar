import { describe, expect, it } from "vitest";
import { AdminAccessService, type AdminAccessActor } from "./admin-access-service.js";
import { AdminFinanceOperationsService } from "./admin-finance-operations-service.js";

const now = () => new Date("2026-07-14T08:00:00.000Z");

describe("AdminFinanceOperationsService", () => {
  it("默认关闭阶段四资金运营门禁", () => {
    const service = createService(false);
    expect(() => service.getOperationsCenter(actor("synthetic-finance-officer-001")))
      .toThrowError("FEATURE_DISABLED");
  });

  it("运营主体只能读取本主体付款和清算", () => {
    const service = createService(true);
    const operator = actor("synthetic-operator-finance-officer-001");
    expect(service.getDriverPayout(operator, "payout-synthetic-0714").operatorId)
      .toBe("operator-huhang");
    expect(() => service.getAllocationSettlement(operator, "settlement-synthetic-blocked"))
      .toThrowError("ADMIN_FINANCE_SCOPE_FORBIDDEN");
  });

  it("清算通过唯一入口准备、独立复核且幂等重放返回原结果", () => {
    const service = createService(true);
    const prepared = service.executeCommand(
      actor("synthetic-finance-officer-001"),
      "settlement-prepare-idempotency-001",
      {
        type: "prepare_operator_settlement",
        resourceId: "settlement-synthetic-184",
        resourceVersion: 1,
        reasonCode: "daily_settlement",
      },
    );
    const replay = service.executeCommand(
      actor("synthetic-finance-officer-001"),
      "settlement-prepare-idempotency-001",
      {
        type: "prepare_operator_settlement",
        resourceId: "settlement-synthetic-184",
        resourceVersion: 1,
        reasonCode: "daily_settlement",
      },
    );
    expect(replay).toEqual(prepared);
    const reviewed = service.executeCommand(
      actor("synthetic-finance-lead-001"),
      "settlement-review-idempotency-001",
      {
        type: "review_operator_settlement",
        resourceId: "settlement-synthetic-184",
        resourceVersion: 2,
        reasonCode: "independent_review",
      },
    );
    expect(reviewed.state).toBe("succeeded");
  });

  it("同一幂等键不同摘要由服务端拒绝", () => {
    const service = createService(true);
    const finance = actor("synthetic-finance-officer-001");
    service.executeCommand(finance, "finance-digest-conflict-001", {
      type: "prepare_operator_settlement",
      resourceId: "settlement-synthetic-184",
      resourceVersion: 1,
      reasonCode: "daily_settlement",
    });
    expect(() => service.executeCommand(finance, "finance-digest-conflict-001", {
      type: "request_refund",
      resourceId: "finance-case-synthetic-071",
      resourceVersion: 1,
      reasonCode: "refund_liability",
    })).toThrowError("CONFLICT_IDEMPOTENCY_KEY_REUSED");
  });

  it("同一幂等键不得跨内部身份重放原结果", () => {
    const service = createService(true);
    const command = {
      type: "prepare_operator_settlement" as const,
      resourceId: "settlement-synthetic-184",
      resourceVersion: 1,
      reasonCode: "daily_settlement",
    };
    service.executeCommand(
      actor("synthetic-finance-officer-001"),
      "finance-cross-actor-replay-001",
      command,
    );
    expect(() => service.executeCommand(
      actor("synthetic-finance-lead-001"),
      "finance-cross-actor-replay-001",
      command,
    )).toThrowError("CONFLICT_IDEMPOTENCY_KEY_REUSED");
  });

  it("非零差异阻止清算和日终关账", () => {
    const service = createService(true);
    expect(() => service.executeCommand(
      actor("synthetic-finance-officer-001"),
      "blocked-settlement-001",
      {
        type: "prepare_operator_settlement",
        resourceId: "settlement-synthetic-blocked",
        resourceVersion: 3,
        reasonCode: "daily_settlement",
      },
    )).toThrowError("ADMIN_FINANCE_SETTLEMENT_BLOCKED");
    expect(() => service.executeCommand(
      actor("synthetic-finance-officer-001"),
      "blocked-close-001",
      {
        type: "prepare_business_day_close",
        resourceId: "2026-07-13",
        resourceVersion: 1,
        reasonCode: "daily_close",
      },
    )).toThrowError("ADMIN_FINANCE_DAY_CLOSE_BLOCKED");
  });

  it("运营主体完成 T+1 付款准备和独立复核", () => {
    const service = createService(true);
    const prepared = service.executeCommand(
      actor("synthetic-operator-finance-officer-001"),
      "payout-prepare-001",
      {
        type: "prepare_driver_payout",
        resourceId: "payout-synthetic-0714",
        resourceVersion: 1,
        reasonCode: "t_plus_one",
      },
    );
    expect(prepared.state).toBe("awaiting_review");
    const reviewed = service.executeCommand(
      actor("synthetic-operator-finance-lead-001"),
      "payout-review-001",
      {
        type: "review_driver_payout",
        resourceId: "payout-synthetic-0714",
        resourceVersion: 2,
        reasonCode: "independent_review",
      },
    );
    expect(reviewed.state).toBe("approved");
    expect(() => service.executeCommand(
      actor("synthetic-operator-finance-officer-001"),
      "payout-request-officer-001",
      {
        type: "request_driver_payout",
        resourceId: "payout-synthetic-0714",
        resourceVersion: 3,
        reasonCode: "send_approved_payout",
      },
    )).toThrowError("AUTHORIZATION_DENIED");
    const requested = service.executeCommand(
      actor("synthetic-operator-finance-lead-001"),
      "payout-request-lead-001",
      {
        type: "request_driver_payout",
        resourceId: "payout-synthetic-0714",
        resourceVersion: 3,
        reasonCode: "send_approved_payout",
      },
    );
    expect(requested.state).toBe("processing");
  });

  it("未知付款结果禁止创建第二笔付款请求", () => {
    const service = createService(true);
    expect(() => service.executeCommand(
      actor("synthetic-operator-finance-lead-001"),
      "payout-unknown-second-request-001",
      {
        type: "request_driver_payout",
        resourceId: "payout-synthetic-unknown",
        resourceVersion: 4,
        reasonCode: "retry_unknown",
      },
    )).toThrowError("ADMIN_FINANCE_UNKNOWN_RESULT_IN_PROGRESS");
  });

  it("差异解决要求证据并由不同职责角色复核", () => {
    const service = createService(true);
    expect(() => service.executeCommand(
      actor("synthetic-finance-officer-001"),
      "reconciliation-no-evidence-001",
      {
        type: "submit_reconciliation_resolution",
        resourceId: "reconciliation-item-synthetic-205",
        resourceVersion: 1,
        reasonCode: "late_callback",
        evidenceReference: "",
      },
    )).toThrowError("ADMIN_FINANCE_RESOLUTION_EVIDENCE_REQUIRED");
    const submitted = service.executeCommand(
      actor("synthetic-finance-officer-001"),
      "reconciliation-submit-001",
      {
        type: "submit_reconciliation_resolution",
        resourceId: "reconciliation-item-synthetic-205",
        resourceVersion: 1,
        reasonCode: "late_callback",
        evidenceReference: "EVD-SYN-205",
      },
    );
    expect(submitted.state).toBe("awaiting_review");
    const reviewed = service.executeCommand(
      actor("synthetic-finance-lead-001"),
      "reconciliation-review-001",
      {
        type: "review_reconciliation_resolution",
        resourceId: "reconciliation-item-synthetic-205",
        resourceVersion: 2,
        reasonCode: "evidence_confirmed",
      },
    );
    expect(reviewed.state).toBe("resolved");
  });

  it("读取对账差异金额会记录金额披露审计", () => {
    const access = new AdminAccessService(true, false, false, false, true, now);
    const service = new AdminFinanceOperationsService(true, access);
    const finance = actor("synthetic-finance-officer-001");
    service.getReconciliationFundCases(finance, "reconciliation-synthetic-0714");
    expect(access.listAuditEvents(finance).some((event) =>
      event.eventType === "finance_amount_viewed" &&
      event.resourceId === "reconciliation-synthetic-0714"
    )).toBe(true);
  });

  it("技术运维只能查询原未知结果恢复任务", () => {
    const service = createService(true);
    const result = service.executeCommand(
      actor("synthetic-technical-ops-001"),
      "finance-recovery-query-001",
      {
        type: "query_finance_command_recovery",
        resourceId: "payout-synthetic-unknown",
        resourceVersion: 1,
        reasonCode: "query_original_command",
      },
    );
    expect(result.state).toBe("reconciling_authoritative_state");
    expect(() => service.executeCommand(
      actor("synthetic-technical-ops-001"),
      "finance-recovery-business-decision-001",
      {
        type: "review_driver_payout",
        resourceId: "payout-synthetic-unknown",
        resourceVersion: 4,
        reasonCode: "force_review",
      },
    )).toThrowError("AUTHORIZATION_DENIED");
  });

  it("账本交易和余额投影保持只读且借贷平衡", () => {
    const service = createService(true);
    const ledger = service.getLedgerTransaction(
      actor("synthetic-auditor-001"),
      "ledger-transaction-synthetic-19341",
    );
    expect(ledger.debitTotalMinor).toBe(ledger.creditTotalMinor);
    expect(ledger.balanceProjectionReadOnly).toBe(true);
    expect(ledger.entryEditAllowed).toBe(false);
    expect(ledger.directReversalAllowed).toBe(false);
  });
});

function createService(enabled: boolean) {
  const access = new AdminAccessService(true, false, false, false, enabled, now);
  return new AdminFinanceOperationsService(enabled, access);
}

function actor(token: string): AdminAccessActor {
  return {
    token,
    correlationId: `correlation-${token}`,
    requestId: `request-${token}`,
  };
}
