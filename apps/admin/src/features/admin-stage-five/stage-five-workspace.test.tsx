import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type {
  AdminExecutiveDashboardClient,
  AdminInternalSession,
} from "@pollycar/contracts";
import { StageFiveWorkspace } from "./stage-five-workspace";

describe("StageFiveWorkspace", () => {
  it("总览明确只读和未关账状态", async () => {
    render(<StageFiveWorkspace page="executive_overview" client={client} session={session} />);
    expect(await screen.findByText("高层总览")).toBeTruthy();
    expect(screen.getByText("包含未关账数据")).toBeTruthy();
    expect(screen.getByText(/任何业务动作仍回到原职责工作台/)).toBeTruthy();
  });

  it("资金页显示 L2 区间而非精确金额", async () => {
    render(<StageFiveWorkspace page="executive_finance_safety" client={client} session={session} />);
    expect(await screen.findByText("资金安全")).toBeTruthy();
    expect(screen.getByText("¥50 万—¥100 万")).toBeTruthy();
    expect(screen.getByText(/只显示 L2/)).toBeTruthy();
  });

  it("待决事项提供追加式意见且提示不执行命令", async () => {
    render(<StageFiveWorkspace page="executive_decisions_metrics" client={client} session={session} />);
    expect(await screen.findByText("待决事项与指标口径")).toBeTruthy();
    expect(screen.getAllByText("记录高层决策意见").length).toBeGreaterThan(0);
    expect(screen.getByText(/不执行批准、拒绝、付款、恢复或生产启用命令/)).toBeTruthy();
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
  internalUserId: "internal-executive-sponsor-001",
  displayName: "顾明远",
  membershipId: "membership-executive-sponsor-001",
  functionalRoles: ["executive_sponsor"],
  maximumDataClassification: "restricted",
  context,
  availableContexts: [context],
  visibleModules: ["executive_overview", "executive_finance_safety", "executive_decisions_metrics"],
  temporaryGrants: [],
  synthetic: true,
};

const base = {
  context,
  pageState: "unclosed" as const,
  asOf: "2026-07-14T08:00:00.000Z",
  dataWindow: { start: "2026-07-13T08:00:00.000Z", end: "2026-07-14T08:00:00.000Z", timezone: "Asia/Shanghai" as const },
  notices: ["资金指标包含未关账期间。"],
  clientRecalculationAllowed: false as const,
  containsRealData: false as const,
  synthetic: true as const,
};

const client: AdminExecutiveDashboardClient = {
  getExecutiveOverview: async () => ({
    ...base,
    metrics: [metric("trip_completion_rate", "行程完成率", "93.6%")],
    majorBlockers: [{ blockerId: "b1", domain: "finance", severity: "blocked", summary: "非零差异阻断", sourceWorkspace: "finance_reconciliation_cases" }],
    decisionItemCount: 1,
  }),
  getExecutiveOperationsHealth: async () => { throw new Error("unused"); },
  getExecutiveOperatorHealth: async () => { throw new Error("unused"); },
  getExecutiveFinanceSafety: async () => ({
    ...base,
    disclosureLevel: "L2",
    metrics: [{ ...metric("allocated_amount_minor", "已分配金额", "¥50 万—¥100 万"), valueType: "money_band", value: "¥50 万—¥100 万", closeStatus: "unclosed", state: "unclosed" }],
    settlementStatus: "blocked",
    payoutStatus: "attention",
    exactAmountAccessAllowed: false,
  }),
  getExecutiveSafetyCompliance: async () => { throw new Error("unused"); },
  getExecutiveDecisionItems: async () => ({
    ...base,
    pageState: "ready",
    decisionItems: [{
      decisionItemId: "decision-1",
      domain: "operations",
      title: "主体限制状态复核",
      summary: "等待高层治理输入。",
      responsibleRole: "operations_lead",
      dueAt: "2026-07-20T10:00:00.000Z",
      state: "open",
      sourceWorkspace: "operator_management",
      opinions: [],
      directApprovalAllowed: false,
      synthetic: true,
    }],
    metrics: [metric("executive_decision_item_count", "待高层判断事项", "1")],
  }),
  getExecutiveMetricRegistry: async () => { throw new Error("unused"); },
  getExecutiveDrilldown: async () => { throw new Error("unused"); },
  recordExecutiveDecisionOpinion: async () => { throw new Error("unused"); },
  createExecutiveExportRequest: async () => { throw new Error("unused"); },
  reviewExecutiveExportPrivacy: async () => { throw new Error("unused"); },
  reviewExecutiveExportDomain: async () => { throw new Error("unused"); },
  revokeExecutiveExport: async () => { throw new Error("unused"); },
  downloadExecutiveExport: async () => { throw new Error("unused"); },
};

function metric(metricId: string, label: string, displayValue: string) {
  return {
    metricId,
    metricVersion: "v1",
    label,
    valueType: "basis_points" as const,
    value: 9360,
    displayValue,
    state: "ready" as const,
    asOf: base.asOf,
    sourceStatus: "available" as const,
    closeStatus: "not_required" as const,
    snapshotKey: {
      metricId,
      metricVersion: "v1",
      windowStart: base.dataWindow.start,
      windowEnd: base.dataWindow.end,
      dimensionKey: "all",
      organizationScopeDigest: "synthetic-test-scope",
      asOf: base.asOf,
    },
    synthetic: true as const,
  };
}
