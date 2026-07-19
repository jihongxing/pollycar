import type {
  ApproveVehicleReviewAdminCommand,
  AdminReviewAuditEntry,
  AdminReviewClient,
  AdminReviewMaterialPreview,
  AdminReviewMaterialReason,
  AdminReviewTaskDetail,
  AdminReviewTaskSummary,
  ClaimAdminReviewTaskCommand,
  ReleaseAdminReviewTaskCommand,
  RejectVehicleReviewAdminCommand,
  RenewAdminReviewTaskCommand,
  RequestVehicleMaterialAdminCommand,
} from "@pollycar/contracts";

import { syntheticTasks } from "../testing/fixtures";

const reviewerId = "synthetic-reviewer-001";
const previewCopy: Record<AdminReviewMaterialReason, Omit<AdminReviewMaterialPreview, "reason">> = {
  insurance_expiry_incomplete: { title: "请补充保险有效期信息", body: "当前材料中的保险有效期信息不完整，请补充清晰的合成材料后再次提交。", templateVersion: "2026-07-11.1", synthetic: true },
  authorization_evidence_incomplete: { title: "请补充车辆授权材料", body: "当前车辆授权材料不完整，请补充可验证的合成授权材料后再次提交。", templateVersion: "2026-07-11.1", synthetic: true },
  synthetic_attachment_invalid: { title: "请重新上传车辆材料", body: "当前合成附件无法完成格式校验，请按要求重新生成并上传材料。", templateVersion: "2026-07-11.1", synthetic: true },
};

export class SyntheticAdminReviewClient implements AdminReviewClient {
  private readonly tasks = new Map(syntheticTasks.map((task) => [task.taskId, task]));
  private readonly audit = new Map<string, AdminReviewAuditEntry[]>();
  private readonly results = new Map<string, AdminReviewTaskDetail>();

  public async listTasks(): Promise<readonly AdminReviewTaskSummary[]> {
    return [...this.tasks.values()].map((task) => ({
      taskId: task.taskId,
      applicationId: task.applicationId,
      status: task.status,
      submittedAt: task.submittedAt,
      vehicleCategory: task.vehicleCategory,
      queueLabel: "车辆准入",
      taskVersion: task.taskVersion,
      synthetic: true,
    }));
  }

  public async claimTask(command: ClaimAdminReviewTaskCommand): Promise<AdminReviewTaskDetail> {
    const recovered = this.results.get(command.idempotencyKey);
    if (recovered) return recovered;
    const current = this.require(command.taskId);
    if (current.status !== "available" || current.taskVersion !== command.expectedTaskVersion) {
      throw new Error("ADMIN_TASK_ALREADY_CLAIMED");
    }
    const now = new Date();
    const next = {
      ...current,
      status: "in_progress" as const,
      taskVersion: current.taskVersion + 1,
      lease: { ownerId: reviewerId, claimedAt: now.toISOString(), expiresAt: new Date(now.getTime() + 1_800_000).toISOString() },
    };
    this.tasks.set(command.taskId, next);
    this.results.set(command.idempotencyKey, next);
    this.append(command.taskId, "task_claimed", "atomic_claim");
    return next;
  }

  public async getTask(taskId: string): Promise<AdminReviewTaskDetail> {
    this.append(taskId, "task_viewed", "minimum_summary_viewed");
    return this.require(taskId);
  }

  public async renewTask(command: RenewAdminReviewTaskCommand): Promise<AdminReviewTaskDetail> {
    const current = this.requireOwned(command.taskId);
    const next = { ...current, taskVersion: current.taskVersion + 1, lease: { ...current.lease!, expiresAt: new Date(Date.now() + 1_800_000).toISOString() } };
    this.tasks.set(command.taskId, next);
    this.append(command.taskId, "lease_renewed", "lease_window");
    return next;
  }

  public async releaseTask(command: ReleaseAdminReviewTaskCommand): Promise<AdminReviewTaskDetail> {
    const { lease: _lease, ...current } = this.requireOwned(command.taskId);
    const next = { ...current, status: "released" as const, taskVersion: current.taskVersion + 1 };
    this.tasks.set(command.taskId, next);
    this.append(command.taskId, "task_released", command.reasonCode);
    return next;
  }

  public async previewMaterial(taskId: string, reason: AdminReviewMaterialReason): Promise<AdminReviewMaterialPreview> {
    this.requireOwned(taskId);
    this.append(taskId, "material_previewed", reason);
    return { reason, ...previewCopy[reason] };
  }

  public async requestMaterial(command: RequestVehicleMaterialAdminCommand): Promise<AdminReviewTaskDetail> {
    const recovered = this.results.get(command.idempotencyKey);
    if (recovered) return recovered;
    const { lease: _lease, ...current } = this.requireOwned(command.taskId);
    if (current.taskVersion !== command.expectedTaskVersion || current.vehicleReviewVersion !== command.expectedVehicleReviewVersion) {
      throw new Error("ADMIN_TASK_OWNERSHIP_LOST");
    }
    const next = { ...current, status: "waiting_user" as const, taskVersion: current.taskVersion + 1, vehicleReviewVersion: current.vehicleReviewVersion + 1 };
    this.tasks.set(command.taskId, next);
    this.results.set(command.idempotencyKey, next);
    this.append(command.taskId, "material_requested", command.reason);
    return next;
  }

  public async approveVehicle(
    command: ApproveVehicleReviewAdminCommand,
  ): Promise<AdminReviewTaskDetail> {
    const recovered = this.results.get(command.idempotencyKey);
    if (recovered) return recovered;
    const { lease: _lease, ...current } = this.requireOwned(command.taskId);
    if (
      current.taskVersion !== command.expectedTaskVersion ||
      current.vehicleReviewVersion !== command.expectedVehicleReviewVersion
    ) {
      throw new Error("ADMIN_TASK_OWNERSHIP_LOST");
    }
    if (
      current.insuranceExpiryStatus === "incomplete" ||
      current.authorizationEvidenceStatus === "incomplete" ||
      current.attachmentValidationStatus === "invalid"
    ) {
      throw new Error("ADMIN_OPEN_RISK_BLOCKS_APPROVAL");
    }
    const next = {
      ...current,
      status: "completed" as const,
      taskVersion: current.taskVersion + 1,
      vehicleReviewVersion: current.vehicleReviewVersion + 1,
    };
    this.tasks.set(command.taskId, next);
    this.results.set(command.idempotencyKey, next);
    this.append(command.taskId, "vehicle_approved", "approved_standard");
    return next;
  }

  public async rejectVehicle(
    command: RejectVehicleReviewAdminCommand,
  ): Promise<AdminReviewTaskDetail> {
    const recovered = this.results.get(command.idempotencyKey);
    if (recovered) return recovered;
    const { lease: _lease, ...current } = this.requireOwned(command.taskId);
    if (
      current.taskVersion !== command.expectedTaskVersion ||
      current.vehicleReviewVersion !== command.expectedVehicleReviewVersion
    ) {
      throw new Error("ADMIN_TASK_OWNERSHIP_LOST");
    }
    const next = {
      ...current,
      status: "completed" as const,
      taskVersion: current.taskVersion + 1,
      vehicleReviewVersion: current.vehicleReviewVersion + 1,
    };
    this.tasks.set(command.taskId, next);
    this.results.set(command.idempotencyKey, next);
    this.append(command.taskId, "vehicle_rejected", command.reasonCode);
    return next;
  }

  public async listAudit(taskId: string): Promise<readonly AdminReviewAuditEntry[]> {
    return this.audit.get(taskId) ?? [];
  }

  public async recoverResult(idempotencyKey: string): Promise<AdminReviewTaskDetail | undefined> {
    return this.results.get(idempotencyKey);
  }

  private require(taskId: string) {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error("ADMIN_TASK_NOT_FOUND");
    return task;
  }

  private requireOwned(taskId: string) {
    const task = this.require(taskId);
    if (task.lease?.ownerId !== reviewerId || new Date(task.lease.expiresAt) <= new Date()) throw new Error("ADMIN_TASK_OWNERSHIP_LOST");
    return task;
  }

  private append(taskId: string, action: AdminReviewAuditEntry["action"], reasonCode: string) {
    const entries = this.audit.get(taskId) ?? [];
    entries.push({
      id: `audit-${taskId}-${entries.length + 1}`,
      occurredAt: new Date().toISOString(),
      actorId: reviewerId,
      action,
      outcome: "succeeded",
      reasonCode,
      taskId,
      correlationId: taskId,
      synthetic: true,
    });
    this.audit.set(taskId, entries);
  }
}
