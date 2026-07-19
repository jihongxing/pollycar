import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AdminAccessService, type AdminAccessActor } from "./admin-access-service.js";
import { ExecutiveDashboardQueryService } from "./executive-dashboard-query-service.js";
import {
  EncryptedFileExecutiveExportArtifactStore,
  FileAdminAuditEventStore,
  FileExecutiveGovernanceStateStore,
} from "../persistence/admin-governance-file-store.js";

const now = () => new Date("2026-07-14T08:00:00.000Z");

describe("ExecutiveDashboardQueryService", () => {
  it("默认关闭阶段五门禁", () => {
    const service = createService(false);
    expect(() => service.getExecutiveOverview(actor("synthetic-executive-sponsor-001")))
      .toThrowError("FEATURE_DISABLED");
  });

  it("运营主体负责人只能看到固定本主体健康数据", () => {
    const service = createService(true);
    const result = service.getExecutiveOperatorHealth(actor("synthetic-operator-executive-001"));
    expect(result.context.organizationType).toBe("operator");
    expect(result.operators.map((operator) => operator.operatorId)).toEqual(["operator-huhang"]);
  });

  it("项目决策人只读取 L2 区间，财务负责人读取 L3 精确聚合金额", () => {
    const { service, access } = createServiceWithAccess(true);
    const sponsor = service.getExecutiveFinanceSafety(actor("synthetic-executive-sponsor-001"));
    const finance = service.getExecutiveFinanceSafety(actor("synthetic-finance-lead-001"));
    expect(sponsor.disclosureLevel).toBe("L2");
    expect(sponsor.metrics.some((metric) => metric.valueType === "money_exact")).toBe(false);
    expect(finance.disclosureLevel).toBe("L3");
    expect(finance.metrics.some((metric) => metric.valueType === "money_exact")).toBe(true);
    expect(
      access
        .listAuditEvents(actor("synthetic-executive-sponsor-001"))
        .some(
          (event) =>
            event.actorInternalUserId === "internal-finance-lead-001" &&
            event.action === "admin_executive.finance.amount.read" &&
            event.result === "allowed",
        ),
    ).toBe(true);
  });

  it("高层意见追加写入且不改变业务状态", () => {
    const service = createService(true);
    const sponsor = actor("synthetic-executive-sponsor-001");
    const first = service.recordDecisionOpinion(sponsor, "executive-opinion-idem-001", {
      decisionItemId: "decision-operator-haiwan",
      decisionCode: "continue_controlled_review",
      reasonCode: "governance_input",
      responsibleRole: "operations_lead",
      dueAt: "2026-07-20T10:00:00.000Z",
      resourceVersion: 1,
    });
    const replay = service.recordDecisionOpinion(sponsor, "executive-opinion-idem-001", {
      decisionItemId: "decision-operator-haiwan",
      decisionCode: "continue_controlled_review",
      reasonCode: "governance_input",
      responsibleRole: "operations_lead",
      dueAt: "2026-07-20T10:00:00.000Z",
      resourceVersion: 1,
    });
    expect(replay).toEqual(first);
    expect(first.appendOnly).toBe(true);
    expect(first.businessStateChanged).toBe(false);
    expect(service.getExecutiveDecisionItems(sponsor).decisionItems[0]?.state).toBe("open");
  });

  it("导出必须经过隐私与职责域双人批准且只允许下载一次", () => {
    const service = createService(true);
    const requested = service.createExportRequest(
      actor("synthetic-executive-sponsor-001"),
      "executive-export-request-001",
      {
        domain: "operations",
        purpose: "周度治理复盘",
        fieldSet: ["trip_completion_rate"],
        windowStart: "2026-07-07T00:00:00.000Z",
        windowEnd: "2026-07-14T00:00:00.000Z",
      },
    );
    const privacy = service.reviewExportPrivacy(
      actor("synthetic-privacy-compliance-001"),
      requested.exportRequestId,
      "executive-export-privacy-001",
      { decision: "approve", reasonCode: "privacy_passed", resourceVersion: 1 },
    );
    const approved = service.reviewExportDomain(
      actor("synthetic-operations-lead-001"),
      requested.exportRequestId,
      "executive-export-domain-001",
      { decision: "approve", reasonCode: "operations_passed", resourceVersion: privacy.resourceVersion },
    );
    expect(approved.state).toBe("approved");
    const download = service.downloadExport(actor("synthetic-executive-sponsor-001"), requested.exportRequestId);
    expect(download.deletedAfterDownload).toBe(true);
    expect(() => service.downloadExport(actor("synthetic-executive-sponsor-001"), requested.exportRequestId))
      .toThrowError("ADMIN_EXECUTIVE_EXPORT_FORBIDDEN");
  });

  it("未关账资金导出申请失败关闭", () => {
    const service = createService(true);
    expect(() =>
      service.createExportRequest(
        actor("synthetic-finance-lead-001"),
        "executive-finance-export-001",
        {
          domain: "finance",
          purpose: "资金治理复盘",
          fieldSet: ["allocated_amount_minor"],
          windowStart: "2026-07-07T00:00:00.000Z",
          windowEnd: "2026-07-14T00:00:00.000Z",
        },
      ),
    ).toThrowError("ADMIN_EXECUTIVE_UNCLOSED_DATA_RESTRICTED");
  });

  it("治理状态、幂等结果和审计在服务重建后恢复", () => {
    const directory = mkdtempSync(join(tmpdir(), "pollycar-executive-state-"));
    try {
      const first = createPersistentService(directory);
      const sponsor = actor("synthetic-executive-sponsor-001");
      const opinion = first.service.recordDecisionOpinion(
        sponsor,
        "executive-opinion-restart-001",
        {
          decisionItemId: "decision-operator-haiwan",
          decisionCode: "continue_controlled_review",
          reasonCode: "restart_proof",
          responsibleRole: "operations_lead",
          dueAt: "2026-07-20T10:00:00.000Z",
          resourceVersion: 1,
        },
      );

      const second = createPersistentService(directory);
      const replay = second.service.recordDecisionOpinion(
        sponsor,
        "executive-opinion-restart-001",
        {
          decisionItemId: "decision-operator-haiwan",
          decisionCode: "continue_controlled_review",
          reasonCode: "restart_proof",
          responsibleRole: "operations_lead",
          dueAt: "2026-07-20T10:00:00.000Z",
          resourceVersion: 1,
        },
      );

      expect(replay).toEqual(opinion);
      expect(
        second.service
          .getExecutiveDecisionItems(sponsor)
          .decisionItems[0]?.opinions,
      ).toContainEqual(opinion);
      expect(
        second.access
          .listAuditEvents(sponsor)
          .some(
            (event) =>
              event.eventType === "executive_decision_opinion_recorded" &&
              event.resourceId === "decision-operator-haiwan",
          ),
      ).toBe(true);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("批准文件以真实密文持久化且重启后单次下载即删除", () => {
    const directory = mkdtempSync(join(tmpdir(), "pollycar-executive-export-"));
    try {
      const first = createPersistentService(directory);
      const requested = first.service.createExportRequest(
        actor("synthetic-executive-sponsor-001"),
        "executive-export-restart-001",
        {
          domain: "operations",
          purpose: "重启恢复验证",
          fieldSet: ["trip_completion_rate"],
          windowStart: "2026-07-07T00:00:00.000Z",
          windowEnd: "2026-07-14T00:00:00.000Z",
        },
      );
      const privacy = first.service.reviewExportPrivacy(
        actor("synthetic-privacy-compliance-001"),
        requested.exportRequestId,
        "executive-export-restart-privacy",
        {
          decision: "approve",
          reasonCode: "privacy_passed",
          resourceVersion: 1,
        },
      );
      first.service.reviewExportDomain(
        actor("synthetic-operations-lead-001"),
        requested.exportRequestId,
        "executive-export-restart-domain",
        {
          decision: "approve",
          reasonCode: "operations_passed",
          resourceVersion: privacy.resourceVersion,
        },
      );

      const encryptedPath = join(
        directory,
        "exports",
        `${requested.exportRequestId}.enc`,
      );
      expect(existsSync(encryptedPath)).toBe(true);
      expect(readFileSync(encryptedPath).includes(Buffer.from("重启恢复验证", "utf8")))
        .toBe(false);

      const second = createPersistentService(directory);
      const download = second.service.downloadExport(
        actor("synthetic-executive-sponsor-001"),
        requested.exportRequestId,
      );
      expect(
        Buffer.from(download.contentBase64, "base64").toString("utf8"),
      ).toContain("重启恢复验证");
      expect(existsSync(encryptedPath)).toBe(false);
      expect(() =>
        second.service.downloadExport(
          actor("synthetic-executive-sponsor-001"),
          requested.exportRequestId,
        ),
      ).toThrowError("ADMIN_EXECUTIVE_EXPORT_FORBIDDEN");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("人员级钻取和跨主体钻取均被拒绝", () => {
    const service = createService(true);
    expect(() => service.getExecutiveDrilldown(
      actor("synthetic-executive-sponsor-001"),
      "person" as "city",
      "internal-user-001",
    )).toThrowError("ADMIN_EXECUTIVE_DRILLDOWN_FORBIDDEN");
    expect(() => service.getExecutiveDrilldown(
      actor("synthetic-operator-executive-001"),
      "operator",
      "operator-haiwan",
    )).toThrowError("ADMIN_EXECUTIVE_SCOPE_FORBIDDEN");
  });
});

function createService(enabled: boolean) {
  return createServiceWithAccess(enabled).service;
}

function createServiceWithAccess(enabled: boolean) {
  const access = new AdminAccessService(true, true, true, true, true, enabled, now);
  return {
    access,
    service: new ExecutiveDashboardQueryService(enabled, access, undefined, now),
  };
}

function createPersistentService(directory: string) {
  const access = new AdminAccessService(true, true, true, true, true, true, now);
  access.attachAuditEventStore(
    new FileAdminAuditEventStore(join(directory, "audit-events.json")),
  );
  return {
    access,
    service: new ExecutiveDashboardQueryService(
      true,
      access,
      undefined,
      now,
      new FileExecutiveGovernanceStateStore(
        join(directory, "governance-state.json"),
      ),
      new EncryptedFileExecutiveExportArtifactStore(
        join(directory, "exports"),
      ),
    ),
  };
}

function actor(token: string): AdminAccessActor {
  return {
    token,
    correlationId: `correlation-${token}`,
    requestId: `request-${token}`,
  };
}
