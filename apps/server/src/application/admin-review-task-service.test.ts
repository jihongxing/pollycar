import { describe, expect, it } from "vitest";

import { MemoryAuditLog } from "../adapters/memory-audit.js";
import { MemoryLogger, MemoryMetrics, MemoryTracer } from "../adapters/memory-observability.js";
import { MemoryReviewTaskRepository } from "../adapters/memory-review-task-repository.js";
import type { ReviewTaskRecord, VehicleReviewDecisionExecutor } from "../ports/review-tasks.js";
import { AdminReviewTaskService } from "./admin-review-task-service.js";

const seed: ReviewTaskRecord = {
  taskId: "task-001",
  applicationId: "application-001",
  accountReference: "合成账户 · 001",
  status: "available",
  submittedAt: "2026-07-11T08:00:00.000Z",
  vehicleCategory: "舒适型轿车",
  insuranceExpiryStatus: "incomplete",
  authorizationEvidenceStatus: "complete",
  attachmentValidationStatus: "valid",
  taskVersion: 1,
  vehicleReviewVersion: 3,
  synthetic: true,
};

function createService(now = new Date("2026-07-11T09:00:00.000Z")) {
  const repository = new MemoryReviewTaskRepository([seed]);
  const audit = new MemoryAuditLog();
  const vehicleReviews: VehicleReviewDecisionExecutor = {
    requestMaterial: async ({ expectedVehicleReviewVersion }) => ({
      vehicleReviewVersion: expectedVehicleReviewVersion + 1,
    }),
    approve: async ({ expectedVersion }) => ({ version: expectedVersion + 1 }),
    reject: async ({ expectedVersion }) => ({ version: expectedVersion + 1 }),
  };
  return {
    service: new AdminReviewTaskService(
      repository,
      vehicleReviews,
      audit,
      new MemoryLogger(),
      new MemoryMetrics(),
      new MemoryTracer(),
      () => now,
    ),
    audit,
  };
}

describe("AdminReviewTaskService", () => {
  it("原子认领并拒绝并发认领", async () => {
    const { service } = createService();
    const first = await service.claimTask({
      reviewerId: "reviewer-a",
      taskId: "task-001",
      expectedTaskVersion: 1,
      idempotencyKey: "claim-a",
    });
    expect(first.status).toBe("in_progress");
    await expect(
      service.claimTask({
        reviewerId: "reviewer-b",
        taskId: "task-001",
        expectedTaskVersion: 1,
        idempotencyKey: "claim-b",
      }),
    ).rejects.toThrow("ADMIN_TASK_ALREADY_CLAIMED");
  });

  it("重复幂等键返回同一结果并支持未知结果恢复", async () => {
    const { service } = createService();
    const command = {
      reviewerId: "reviewer-a",
      taskId: "task-001",
      expectedTaskVersion: 1,
      idempotencyKey: "claim-unknown",
    } as const;
    const first = await service.claimTask(command);
    expect(await service.claimTask(command)).toEqual(first);
    expect(service.recoverResult("reviewer-a", "claim-unknown")).toEqual(first);
  });

  it("租约失效后拒绝写入", async () => {
    const now = new Date("2026-07-11T09:00:00.000Z");
    const { service } = createService(now);
    const claimed = await service.claimTask({
      reviewerId: "reviewer-a",
      taskId: "task-001",
      expectedTaskVersion: 1,
      idempotencyKey: "claim-expiry",
    });
    now.setMinutes(now.getMinutes() + 31);
    await expect(
      service.requestMaterial({
        reviewerId: "reviewer-a",
        taskId: "task-001",
        reason: "insurance_expiry_incomplete",
        previewConfirmed: true,
        expectedTaskVersion: claimed.taskVersion,
        expectedVehicleReviewVersion: claimed.vehicleReviewVersion,
        idempotencyKey: "material-expired",
      }),
    ).rejects.toThrow("ADMIN_TASK_OWNERSHIP_LOST");
  });

  it("要求补充后同步任务版本并追加审计", async () => {
    const { service, audit } = createService();
    const claimed = await service.claimTask({
      reviewerId: "reviewer-a",
      taskId: "task-001",
      expectedTaskVersion: 1,
      idempotencyKey: "claim-material",
    });
    const result = await service.requestMaterial({
      reviewerId: "reviewer-a",
      taskId: "task-001",
      reason: "insurance_expiry_incomplete",
      previewConfirmed: true,
      expectedTaskVersion: claimed.taskVersion,
      expectedVehicleReviewVersion: claimed.vehicleReviewVersion,
      idempotencyKey: "material-request",
    });
    expect(result.status).toBe("waiting_user");
    expect(result.vehicleReviewVersion).toBe(4);
    expect(result.lease).toBeUndefined();
    expect(await audit.query("admin_review_task", "task-001")).toHaveLength(2);
  });

  it("只在租约最后五分钟允许续约", async () => {
    const now = new Date("2026-07-11T09:00:00.000Z");
    const { service } = createService(now);
    const claimed = await service.claimTask({
      reviewerId: "reviewer-a",
      taskId: "task-001",
      expectedTaskVersion: 1,
      idempotencyKey: "claim-renew",
    });
    await expect(
      service.renewTask({
        reviewerId: "reviewer-a",
        taskId: "task-001",
        expectedTaskVersion: claimed.taskVersion,
        idempotencyKey: "renew-early",
      }),
    ).rejects.toThrow("ADMIN_LEASE_RENEWAL_TOO_EARLY");
    now.setMinutes(now.getMinutes() + 26);
    const renewed = await service.renewTask({
      reviewerId: "reviewer-a",
      taskId: "task-001",
      expectedTaskVersion: claimed.taskVersion,
      idempotencyKey: "renew-window",
    });
    expect(renewed.taskVersion).toBe(3);
  });

  it("存在未关闭风险时拒绝批准", async () => {
    const { service } = createService();
    const claimed = await service.claimTask({
      reviewerId: "reviewer-a",
      taskId: "task-001",
      expectedTaskVersion: 1,
      idempotencyKey: "claim-risk",
    });
    await expect(
      service.approveVehicle({
        reviewerId: "reviewer-a",
        taskId: "task-001",
        reasonCode: "approved_standard",
        previewConfirmed: true,
        expectedTaskVersion: claimed.taskVersion,
        expectedVehicleReviewVersion: claimed.vehicleReviewVersion,
        idempotencyKey: "approve-risk",
      }),
    ).rejects.toThrow("ADMIN_OPEN_RISK_BLOCKS_APPROVAL");
  });

  it("拒绝决定原子完成任务并支持幂等恢复", async () => {
    const { service, audit } = createService();
    const claimed = await service.claimTask({
      reviewerId: "reviewer-a",
      taskId: "task-001",
      expectedTaskVersion: 1,
      idempotencyKey: "claim-reject",
    });
    const command = {
      reviewerId: "reviewer-a",
      taskId: "task-001",
      reasonCode: "insurance_requirement_not_met",
      previewConfirmed: true,
      expectedTaskVersion: claimed.taskVersion,
      expectedVehicleReviewVersion: claimed.vehicleReviewVersion,
      idempotencyKey: "reject-vehicle",
    } as const;
    const result = await service.rejectVehicle(command);
    expect(result.status).toBe("completed");
    expect(result.lease).toBeUndefined();
    expect(result.vehicleReviewVersion).toBe(4);
    expect(await service.rejectVehicle(command)).toEqual(result);
    expect(service.recoverResult("reviewer-a", command.idempotencyKey)).toEqual(result);
    expect((await audit.query("admin_review_task", "task-001")).at(-1)?.action).toBe(
      "vehicle_rejected",
    );
  });

  it("同一任务的释放与决定不会交错成功", async () => {
    const { service } = createService();
    const claimed = await service.claimTask({
      reviewerId: "reviewer-a",
      taskId: "task-001",
      expectedTaskVersion: 1,
      idempotencyKey: "claim-race",
    });
    const results = await Promise.allSettled([
      service.releaseTask({
        reviewerId: "reviewer-a",
        taskId: "task-001",
        reasonCode: "reviewer_unavailable",
        expectedTaskVersion: claimed.taskVersion,
        idempotencyKey: "release-race",
      }),
      service.rejectVehicle({
        reviewerId: "reviewer-a",
        taskId: "task-001",
        reasonCode: "insurance_requirement_not_met",
        previewConfirmed: true,
        expectedTaskVersion: claimed.taskVersion,
        expectedVehicleReviewVersion: claimed.vehicleReviewVersion,
        idempotencyKey: "reject-race",
      }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  });
});
