import { describe, expect, it } from "vitest";
import { createInternalSandbox } from "./sandbox.js";

describe("内部生产级沙箱", () => {
  it("只认证合成身份并保持真实能力关闭", async () => {
    const sandbox = createInternalSandbox();
    expect(await sandbox.identity.authenticate("synthetic-admin-token")).toMatchObject({
      subjectId: "synthetic-admin",
      synthetic: true,
    });
    expect(await sandbox.identity.authenticate("unknown")).toBeUndefined();
    expect(sandbox.config.featureGates).toMatchObject({
      productionEnabled: false,
      realPayment: false,
      paidFlexTrial: false,
      realUserInvitation: false,
      shanghaiPilot: false,
      realDataIngestion: false,
      internalSandbox: true,
    });
  });

  it("内存仓储执行乐观并发控制", async () => {
    const sandbox = createInternalSandbox();
    await expect(sandbox.repository.put("aggregate-1", { state: "draft" }, 0)).resolves.toMatchObject({
      version: 1,
    });
    await expect(sandbox.repository.put("aggregate-1", { state: "changed" }, 0)).rejects.toThrow(
      "STORAGE_CONCURRENT_MODIFICATION",
    );
  });

  it("任务幂等、失败进入死信并记录人工重放审计", async () => {
    const sandbox = createInternalSandbox(() => new Date("2026-07-11T00:00:00Z"));
    const first = await sandbox.tasks.enqueue({
      id: "task-1",
      type: "retention_delete",
      idempotencyKey: "delete:item-1",
      payload: { recordId: "item-1" },
      maximumAttempts: 2,
    });
    const duplicate = await sandbox.tasks.enqueue({
      id: "task-2",
      type: "retention_delete",
      idempotencyKey: "delete:item-1",
      payload: { recordId: "item-1" },
      maximumAttempts: 2,
    });
    expect(duplicate.id).toBe(first.id);

    await sandbox.tasks.claim();
    expect(await sandbox.tasks.fail(first.id)).toMatchObject({ attempts: 1, status: "pending" });
    await sandbox.tasks.claim();
    expect(await sandbox.tasks.fail(first.id)).toMatchObject({ attempts: 2, status: "dead" });
    expect(await sandbox.tasks.replay(first.id, "synthetic-admin")).toMatchObject({ status: "pending" });
    expect(await sandbox.audit.query("task", first.id)).toHaveLength(1);
  });

  it("拒绝敏感字段写入日志并提供健康检查", async () => {
    const sandbox = createInternalSandbox();
    expect(() =>
      sandbox.logger.log("info", "安全测试", { precise_location: "synthetic-but-forbidden" }),
    ).toThrow("SENSITIVE_LOG_FIELD_FORBIDDEN");
    sandbox.logger.log("info", "任务完成", { taskId: "task-1", synthetic: true });
    sandbox.metrics.increment("sandbox.tasks.completed");
    const span = sandbox.tracer.startSpan("sandbox.task");
    span.end("ok");

    expect(sandbox.health.liveness()).toEqual({ status: "up", components: {} });
    await expect(sandbox.health.readiness()).resolves.toMatchObject({ status: "up" });
    expect(sandbox.metrics.snapshot()).toEqual({ "sandbox.tasks.completed": 1 });
    expect(sandbox.tracer.completed).toEqual([{ name: "sandbox.task", outcome: "ok" }]);
  });

  it("阶段五启用时必须显式提供隔离状态目录", () => {
    expect(() =>
      createInternalSandbox(undefined, {
        featureGates: {
          syntheticAdminMultiOrganization: true,
          syntheticAdminOperatorManagement: true,
          syntheticAdminTripOperations: true,
          syntheticAdminCaseManagement: true,
          syntheticAdminFinanceOperations: true,
          syntheticAdminExecutiveDashboard: true,
        },
      }),
    ).toThrowError("ADMIN_EXECUTIVE_STATE_DIR_REQUIRED");
  });
});
