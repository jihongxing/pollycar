import { describe, expect, it } from "vitest";
import { AdminAccessService, type AdminAccessActor } from "./admin-access-service.js";
import { AdminTripCaseManagementService } from "./admin-trip-case-management-service.js";

const now = () => new Date("2026-07-14T08:00:00.000Z");

describe("运营控制台阶段三行程客服安全合成内核", () => {
  it("两个阶段三门禁分别默认关闭", () => {
    const tripDisabled = service(false, true);
    expect(() => tripDisabled.getTripOperationsCenter(actor("synthetic-platform-ops-001")))
      .toThrowError("FEATURE_DISABLED");

    const caseDisabled = service(true, false);
    expect(() => caseDisabled.getSupportCase(actor("synthetic-support-001"), "support-synthetic-114"))
      .toThrowError("FEATURE_DISABLED");
  });

  it("运营主体只能读取本主体行程和隔离协作任务", () => {
    const stageThree = service(true, true);
    const operatorActor = actor("synthetic-operator-ops-001");

    expect(stageThree.getTrip360(operatorActor, "trip-synthetic-8421").operatorId)
      .toBe("operator-huhang");
    expect(() => stageThree.getTrip360(operatorActor, "trip-synthetic-8466"))
      .toThrowError("ADMIN_TRIP_SCOPE_FORBIDDEN");
    expect(stageThree.getTripOperationsCenter(operatorActor).tasks.every(
      (task) => task.operatorId === "operator-huhang",
    )).toBe(true);
  });

  it("客服与安全权限隔离且安全恢复要求独立复核", () => {
    const stageThree = service(true, true);
    const supportActor = actor("synthetic-support-001");
    const safetyOfficer = actor("synthetic-safety-officer-001");
    const safetyLead = actor("synthetic-safety-lead-001");

    expect(stageThree.getSupportCase(supportActor, "support-synthetic-114").state)
      .toBe("investigating");
    expect(() => stageThree.getSafetyInvestigation(supportActor, "safety-synthetic-8421"))
      .toThrowError("AUTHORIZATION_DENIED");

    stageThree.executeCommand(
      safetyOfficer,
      "submit-safety-investigation-1",
      {
        type: "submit_safety_investigation",
        safetyCaseId: "safety-synthetic-8421",
        resourceVersion: 6,
      },
    );
    expect(() => stageThree.executeCommand(
      safetyOfficer,
      "review-own-freeze-1",
      {
        type: "review_safety_restoration",
        safetyCaseId: "safety-synthetic-8421",
        outcome: "restore_access",
        resourceVersion: 7,
      },
    )).toThrowError("AUTHORIZATION_DENIED");
    expect(() => stageThree.executeCommand(
      safetyLead,
      "review-blocked-restoration-1",
      {
        type: "review_safety_restoration",
        safetyCaseId: "safety-synthetic-8421",
        outcome: "restore_access",
        resourceVersion: 7,
      },
    )).toThrowError("ADMIN_SAFETY_RESTORATION_BLOCKED");
  });

  it("案件目录按组织范围隔离且审计角色只读可见", () => {
    const stageThree = service(true, true);

    const platformCases = stageThree.listCaseDirectory(
      actor("synthetic-auditor-001"),
    );
    expect(platformCases.supportCases.map((item) => item.supportCaseId)).toEqual([
      "support-synthetic-114",
      "support-synthetic-8421",
    ]);
    expect(platformCases.safetyInvestigations.map((item) => item.safetyCaseId))
      .toEqual(["safety-synthetic-8421"]);

    const operatorCases = stageThree.listCaseDirectory(
      actor("synthetic-operator-support-001"),
    );
    expect(operatorCases.supportCases.map((item) => item.supportCaseId)).toEqual([
      "support-synthetic-8421",
    ]);
    expect(operatorCases.safetyInvestigations).toEqual([]);
  });

  it("案件命令拒绝非法状态跳转和重复审批", () => {
    const stageThree = service(true, true);
    const supportActor = actor("synthetic-support-001");
    const safetyOfficer = actor("synthetic-safety-officer-001");
    const safetyLead = actor("synthetic-safety-lead-001");

    stageThree.executeCommand(
      supportActor,
      "support-close-1",
      {
        type: "update_support_case",
        supportCaseId: "support-synthetic-114",
        targetState: "closed",
        resourceVersion: 5,
      },
    );
    expect(() => stageThree.executeCommand(
      supportActor,
      "support-closed-invalid-1",
      {
        type: "update_support_case",
        supportCaseId: "support-synthetic-114",
        targetState: "investigating",
        resourceVersion: 6,
      },
    )).toThrowError("ADMIN_CASE_ACTION_INVALID");

    stageThree.executeCommand(
      safetyOfficer,
      "safety-submit-once-1",
      {
        type: "submit_safety_investigation",
        safetyCaseId: "safety-synthetic-8421",
        resourceVersion: 6,
      },
    );
    expect(() => stageThree.executeCommand(
      safetyOfficer,
      "safety-submit-twice-1",
      {
        type: "submit_safety_investigation",
        safetyCaseId: "safety-synthetic-8421",
        resourceVersion: 7,
      },
    )).toThrowError("ADMIN_CASE_ACTION_INVALID");

    const requested = stageThree.executeCommand(
      safetyOfficer,
      "evidence-request-repeat-1",
      {
        type: "request_evidence_access",
        safetyCaseId: "safety-synthetic-8421",
        ticketId: "SEC-2026-0714-REPEAT",
        purposeCode: "safety_investigation",
        requestedFields: ["raw_chat"],
        ttlMinutes: 15,
      },
    );
    stageThree.executeCommand(
      safetyLead,
      "evidence-approve-once-1",
      {
        type: "approve_evidence_access",
        grantId: requested.resourceId,
        resourceVersion: requested.resourceVersion,
      },
    );
    expect(() => stageThree.executeCommand(
      safetyLead,
      "evidence-approve-twice-1",
      {
        type: "approve_evidence_access",
        grantId: requested.resourceId,
        resourceVersion: requested.resourceVersion + 1,
      },
    )).toThrowError("ADMIN_CASE_ACTION_INVALID");
  });

  it("证据访问执行 TTL、字段和双人批准约束", () => {
    const stageThree = service(true, true);
    const safetyOfficer = actor("synthetic-safety-officer-001");
    const safetyLead = actor("synthetic-safety-lead-001");

    expect(() => stageThree.executeCommand(
      safetyOfficer,
      "evidence-too-long-1",
      {
        type: "request_evidence_access",
        safetyCaseId: "safety-synthetic-8421",
        ticketId: "SEC-2026-0714",
        purposeCode: "safety_investigation",
        requestedFields: ["chat_reference"],
        ttlMinutes: 31,
      },
    )).toThrowError("ADMIN_EVIDENCE_TTL_EXCEEDED");

    const requested = stageThree.executeCommand(
      safetyOfficer,
      "evidence-request-1",
      {
        type: "request_evidence_access",
        safetyCaseId: "safety-synthetic-8421",
        ticketId: "SEC-2026-0714",
        purposeCode: "safety_investigation",
        requestedFields: ["raw_chat"],
        ttlMinutes: 30,
      },
    );
    expect(() => stageThree.readEvidenceField(
      safetyOfficer,
      requested.resourceId,
      "raw_chat",
    )).toThrowError("ADMIN_EVIDENCE_DUAL_APPROVAL_REQUIRED");

    stageThree.executeCommand(
      safetyLead,
      "evidence-approve-1",
      {
        type: "approve_evidence_access",
        grantId: requested.resourceId,
        resourceVersion: requested.resourceVersion,
      },
    );
    expect(stageThree.readEvidenceField(
      safetyOfficer,
      requested.resourceId,
      "raw_chat",
    ).value).toContain("合成证据原文");
  });

  it("未知结果恢复只允许技术运维查询且命令幂等", () => {
    const stageThree = service(true, true);
    const technicalActor = actor("synthetic-technical-ops-001");
    const platformActor = actor("synthetic-platform-ops-001");

    expect(() => stageThree.executeCommand(
      platformActor,
      "recovery-business-1",
      {
        type: "query_command_recovery",
        recoveryTaskId: "recovery-synthetic-017",
        resourceVersion: 3,
      },
    )).toThrowError("AUTHORIZATION_DENIED");

    const first = stageThree.executeCommand(
      technicalActor,
      "recovery-query-1",
      {
        type: "query_command_recovery",
        recoveryTaskId: "recovery-synthetic-017",
        resourceVersion: 3,
      },
    );
    const replay = stageThree.executeCommand(
      technicalActor,
      "recovery-query-1",
      {
        type: "query_command_recovery",
        recoveryTaskId: "recovery-synthetic-017",
        resourceVersion: 3,
      },
    );
    expect(replay).toEqual(first);
    expect(stageThree.getCommandRecoveryTask(
      technicalActor,
      "recovery-synthetic-017",
    ).duplicateCommandAllowed).toBe(false);
  });

  it("幂等键请求摘要冲突和恢复任务重复查询均被拒绝", () => {
    const stageThree = service(true, true);
    const technicalActor = actor("synthetic-technical-ops-001");

    stageThree.executeCommand(
      technicalActor,
      "recovery-query-conflict-1",
      {
        type: "query_command_recovery",
        recoveryTaskId: "recovery-synthetic-017",
        resourceVersion: 3,
      },
    );

    expect(() => stageThree.executeCommand(
      technicalActor,
      "recovery-query-conflict-1",
      {
        type: "query_command_recovery",
        recoveryTaskId: "recovery-synthetic-017",
        resourceVersion: 4,
      },
    )).toThrowError("CONFLICT_IDEMPOTENCY_KEY_REUSED");

    expect(() => stageThree.executeCommand(
      technicalActor,
      "recovery-query-again-2",
      {
        type: "query_command_recovery",
        recoveryTaskId: "recovery-synthetic-017",
        resourceVersion: 4,
      },
    )).toThrowError("ADMIN_COMMAND_RECOVERY_IN_PROGRESS");
  });

  it("技术运维不能借恢复入口替代业务角色作决定", () => {
    const stageThree = service(true, true);
    expect(() => stageThree.executeCommand(
      actor("synthetic-technical-ops-001"),
      "technical-business-decision-1",
      {
        type: "update_support_case",
        supportCaseId: "support-synthetic-114",
        targetState: "resolved",
        resourceVersion: 5,
      },
    )).toThrowError("ADMIN_RECOVERY_BUSINESS_DECISION_FORBIDDEN");
  });
});

function service(tripEnabled: boolean, caseEnabled: boolean) {
  const access = new AdminAccessService(true, true, tripEnabled, caseEnabled, now);
  return new AdminTripCaseManagementService(
    tripEnabled,
    caseEnabled,
    access,
    now,
  );
}

function actor(token: string): AdminAccessActor {
  return {
    token,
    correlationId: `correlation-${token}`,
    requestId: `request-${token}`,
  };
}
