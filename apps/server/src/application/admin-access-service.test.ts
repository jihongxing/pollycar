import { describe, expect, it } from "vitest";
import { AdminAccessService } from "./admin-access-service.js";

const platformActor = Object.freeze({
  token: "synthetic-platform-ops-001",
  correlationId: "correlation-platform",
  requestId: "request-platform",
});

const operatorActor = Object.freeze({
  token: "synthetic-operator-ops-001",
  correlationId: "correlation-operator",
  requestId: "request-operator",
});

describe("运营控制台多组织授权与追加式审计", () => {
  it("功能门禁关闭时拒绝所有阶段一能力", () => {
    const service = new AdminAccessService(false, () => new Date("2026-07-14T08:00:00.000Z"));
    expect(() => service.getSession(platformActor)).toThrow("FEATURE_DISABLED");
  });

  it("平台用户只在获批范围切换且角色保持不变", () => {
    const service = new AdminAccessService(true, () => new Date("2026-07-14T08:00:00.000Z"));
    const before = service.getSession(platformActor);
    const after = service.switchContext(
      platformActor,
      "operator-huhang",
      "context-switch-platform-001",
    );

    expect(before.context.organizationId).toBe("platform-pollycar");
    expect(after.context).toMatchObject({
      organizationId: "operator-huhang",
      organizationName: "沪行出行服务",
      operatorScopes: ["operator-huhang"],
      fixed: false,
    });
    expect(after.functionalRoles).toEqual(before.functionalRoles);
    expect(after.maximumDataClassification).toBe(before.maximumDataClassification);
    expect(service.getPlatformWorkbench(platformActor).operatorHealth).toEqual([
      expect.objectContaining({ operatorId: "operator-huhang" }),
    ]);
    expect(service.listAuditEvents(platformActor)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: "organization_context_changed",
          result: "succeeded",
        }),
      ]),
    );
  });

  it("重复上下文切换返回原结果且不产生第二条切换审计", () => {
    const service = new AdminAccessService(true, () => new Date("2026-07-14T08:00:00.000Z"));
    const first = service.switchContext(
      platformActor,
      "operator-huhang",
      "context-switch-platform-repeat",
    );
    const repeated = service.switchContext(
      platformActor,
      "operator-huhang",
      "context-switch-platform-repeat",
    );

    expect(repeated).toEqual(first);
    expect(
      service
        .listAuditEvents(platformActor)
        .filter((event) => event.eventType === "organization_context_changed"),
    ).toHaveLength(1);
  });

  it("运营主体上下文固定且跨主体名录访问被拒绝并审计", () => {
    const service = new AdminAccessService(true, () => new Date("2026-07-14T08:00:00.000Z"));
    const session = service.getSession(operatorActor);

    expect(session.context).toMatchObject({
      organizationId: "operator-huhang",
      operatorScopes: ["operator-huhang"],
      fixed: true,
    });
    expect(() =>
      service.switchContext(
        operatorActor,
        "operator-shencheng",
        "context-switch-operator-denied",
      ),
    ).toThrow("ADMIN_ORGANIZATION_CONTEXT_FIXED");
    expect(() => service.listOperatorDirectory(operatorActor)).toThrow("AUTHORIZATION_DENIED");
    expect(service.listAuditEvents(operatorActor)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: "access_denied",
          action: "list_operator_directory",
          reasonCode: "AUTHORIZATION_DENIED",
        }),
      ]),
    );
  });

  it("运营主体工作台只返回固定主体数据", () => {
    const service = new AdminAccessService(true, () => new Date("2026-07-14T08:00:00.000Z"));
    const workbench = service.getOperatorWorkbench(operatorActor);

    expect(workbench).toMatchObject({
      operatorId: "operator-huhang",
      operatorName: "沪行出行服务",
      crossOperatorAccessAllowed: false,
      financeReadOnly: true,
      realAccountsEnabled: false,
      productionEnabled: false,
    });
    expect(workbench.tasks.every((task) => task.operatorId === "operator-huhang")).toBe(true);
  });
});
