import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { AdminFinanceOperationsClient, AdminInternalSession } from "@pollycar/contracts";
import { StageFourWorkspace } from "./stage-four-workspace";

describe("StageFourWorkspace", () => {
  it("显示资金运营硬门摘要", async () => {
    render(<StageFourWorkspace page="finance_operations" client={client} session={session} />);
    expect(await screen.findByText("资金运营中心")).toBeTruthy();
    expect(screen.getByText("非零差异阻断")).toBeTruthy();
    expect(screen.getByText("未知结果")).toBeTruthy();
  });

  it("分配与清算金额保持只读", async () => {
    render(<StageFourWorkspace page="finance_allocation_settlement" client={client} session={session} />);
    expect(await screen.findByText("分配与运营主体清算")).toBeTruthy();
    expect(screen.getAllByText("金额不可编辑").length).toBeGreaterThan(0);
    expect(screen.getByText("allocation-15-45-40-v1")).toBeTruthy();
  });

  it("账本页面明确禁止编辑分录", async () => {
    render(<StageFourWorkspace page="finance_ledger" client={client} session={session} />);
    expect(await screen.findByText("账本查询")).toBeTruthy();
    expect(screen.getByText("全局交易序列")).toBeTruthy();
    expect(screen.getByText("禁止")).toBeTruthy();
  });
});

const context = {
  organizationType: "platform",
  organizationId: "platform-pollycar",
  organizationName: "PollyCar 平台",
  cityScopes: ["上海"],
  operatorScopes: ["operator-huhang", "operator-haiwan"],
  purpose: "platform_operations",
  fixed: false,
} as const;

const session: AdminInternalSession = {
  internalUserId: "internal-finance-officer-001",
  displayName: "周敏",
  membershipId: "membership-finance-officer-001",
  functionalRoles: ["finance_officer"],
  maximumDataClassification: "restricted",
  context,
  availableContexts: [context],
  visibleModules: ["finance_operations", "finance_allocation_settlement", "finance_ledger"],
  temporaryGrants: [],
  synthetic: true,
};

const client: AdminFinanceOperationsClient = {
  getFinanceOperationsCenter: async () => ({
    context,
    businessDate: "2026-07-13",
    metrics: { nonzeroDifferenceBlockers: 1, awaitingIndependentReview: 2, unknownResults: 1, openFundCases: 1 },
    tasks: [{ taskId: "task-1", operatorId: "operator-huhang", operatorName: "沪行出行服务", category: "recovery", state: "unknown", summary: "车主付款未知结果", blocking: true, resourceVersion: 1, synthetic: true }],
    clientAmountEditAllowed: false,
    directBalanceMutationAllowed: false,
    synthetic: true,
  }),
  getAllocationSettlement: async () => ({
    context,
    settlementBatchId: "settlement-1",
    operatorId: "operator-huhang",
    operatorName: "沪行出行服务",
    businessDate: "2026-07-13",
    state: "ready",
    allocationRuleVersion: "allocation-15-45-40-v1",
    allocationRates: { platform: 15, operator: 45, driver: 40 },
    allocationCount: 3,
    platformShareMinor: "1500",
    operatorShareMinor: "4500",
    driverShareMinor: "4000",
    grossSettlementMinor: "8500",
    reconciliationRunId: "reconciliation-1",
    blockers: [],
    resourceVersion: 1,
    amountEditable: false,
    synthetic: true,
  }),
  getDriverPayout: async () => { throw new Error("unused"); },
  getRefundReversal: async () => { throw new Error("unused"); },
  getReconciliationFundCases: async () => { throw new Error("unused"); },
  getBusinessDayClose: async () => { throw new Error("unused"); },
  getLedgerTransaction: async () => ({
    context,
    ledgerTransactionId: "ledger-1",
    globalSequence: "18",
    sourceNamespace: "payment_aggregate",
    sourceEventId: "payment-1",
    requestDigest: "sha256:test",
    operatorId: "operator-huhang",
    currency: "CNY",
    debitTotalMinor: "1000",
    creditTotalMinor: "1000",
    entries: [],
    balanceProjectionReadOnly: true,
    entryEditAllowed: false,
    entryDeleteAllowed: false,
    directReversalAllowed: false,
    synthetic: true,
  }),
  executeFinanceOperationsCommand: async () => { throw new Error("unused"); },
};
