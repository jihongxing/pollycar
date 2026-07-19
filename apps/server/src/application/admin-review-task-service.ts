import type {
  AdminReviewAuditEntry,
  AdminReviewMaterialPreview,
  AdminReviewMaterialReason,
  AdminReviewTaskDetail,
  AdminReviewTaskSummary,
  ApproveVehicleReviewAdminCommand,
  ClaimAdminReviewTaskCommand,
  RejectVehicleReviewAdminCommand,
  ReleaseAdminReviewTaskCommand,
  RenewAdminReviewTaskCommand,
  RequestVehicleMaterialAdminCommand,
  VehicleReviewView,
} from "@pollycar/contracts";

import type { AuditLog } from "../ports/audit.js";
import type { Metrics, StructuredLogger, Tracer } from "../ports/observability.js";
import {
  type ReviewTaskRecord,
  type ReviewTaskRepository,
  type VehicleReviewDecisionExecutor,
  toAdminReviewTaskDetail,
} from "../ports/review-tasks.js";

const leaseMilliseconds = 30 * 60 * 1000;
const renewWindowMilliseconds = 5 * 60 * 1000;

const previews: Readonly<Record<AdminReviewMaterialReason, AdminReviewMaterialPreview>> = {
  insurance_expiry_incomplete: {
    reason: "insurance_expiry_incomplete",
    title: "请补充保险有效期信息",
    body: "当前材料中的保险有效期信息不完整，请补充清晰的合成材料后再次提交。",
    templateVersion: "2026-07-11.1",
    synthetic: true,
  },
  authorization_evidence_incomplete: {
    reason: "authorization_evidence_incomplete",
    title: "请补充车辆授权材料",
    body: "当前车辆授权材料不完整，请补充可验证的合成授权材料后再次提交。",
    templateVersion: "2026-07-11.1",
    synthetic: true,
  },
  synthetic_attachment_invalid: {
    reason: "synthetic_attachment_invalid",
    title: "请重新上传车辆材料",
    body: "当前合成附件无法完成格式校验，请按要求重新生成并上传材料。",
    templateVersion: "2026-07-11.1",
    synthetic: true,
  },
};

const rejectionMessages: Readonly<
  Record<
    RejectVehicleReviewAdminCommand["reasonCode"],
    Readonly<{ title: string; body: string }>
  >
> = {
  vehicle_age_exceeded: {
    title: "车辆暂不符合准入标准",
    body: "当前车辆年限不符合内部沙箱准入规则，本次合成申请未通过。",
  },
  vehicle_mileage_exceeded: {
    title: "车辆暂不符合准入标准",
    body: "当前车辆里程不符合内部沙箱准入规则，本次合成申请未通过。",
  },
  insurance_requirement_not_met: {
    title: "保险条件暂不符合要求",
    body: "当前保险条件不符合内部沙箱准入规则，本次合成申请未通过。",
  },
  authorization_remaining_insufficient: {
    title: "车辆授权期限不足",
    body: "当前车辆授权剩余期限不符合内部沙箱准入规则，本次合成申请未通过。",
  },
};

type IdempotentResult = Readonly<{
  actorId: string;
  operation: string;
  fingerprint: string;
  result: AdminReviewTaskDetail;
}>;

export class AdminReviewTaskService {
  private readonly idempotentResults = new Map<string, IdempotentResult>();
  private readonly taskLocks = new Map<string, Promise<void>>();
  private readonly previewResults = new Map<
    string,
    Readonly<{
      actorId: string;
      fingerprint: string;
      result: AdminReviewMaterialPreview;
    }>
  >();

  public constructor(
    private readonly repository: ReviewTaskRepository,
    private readonly vehicleReviews: VehicleReviewDecisionExecutor,
    private readonly audit: AuditLog,
    private readonly logger: StructuredLogger,
    private readonly metrics: Metrics,
    private readonly tracer: Tracer,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async listTasks(): Promise<readonly AdminReviewTaskSummary[]> {
    const records = await this.repository.list();
    return records.map((record) => ({
      taskId: record.taskId,
      applicationId: record.applicationId,
      status: record.status,
      submittedAt: record.submittedAt,
      vehicleCategory: record.vehicleCategory,
      queueLabel: "车辆准入",
      taskVersion: record.taskVersion,
      synthetic: true,
    }));
  }

  public async registerSubmittedVehicleReview(view: VehicleReviewView): Promise<void> {
    if (!view.synthetic || view.status !== "under_review") throw new Error("REAL_DATA_FORBIDDEN");
    await this.repository.create({
      taskId: `task-${view.applicationId}`,
      applicationId: view.applicationId,
      accountReference: "合成账户 · 007",
      status: "available",
      submittedAt: this.now().toISOString(),
      vehicleCategory: view.vehicleType ?? "合成车辆",
      insuranceExpiryStatus: view.insuranceExpiresOn ? "complete" : "incomplete",
      authorizationEvidenceStatus: "complete",
      attachmentValidationStatus: view.syntheticAttachmentId?.startsWith("synthetic-")
        ? "valid"
        : "invalid",
      taskVersion: 1,
      vehicleReviewVersion: view.version,
      synthetic: true,
    });
  }

  public async getTask(taskId: string, reviewerId: string): Promise<AdminReviewTaskDetail> {
    const record = await this.requireTask(taskId);
    if (record.status === "in_progress") {
      await this.requireOwnedTask(taskId, reviewerId);
    } else if (record.status !== "waiting_user" && record.status !== "completed") {
      throw new Error("ADMIN_TASK_OWNERSHIP_LOST");
    }
    await this.appendAudit(reviewerId, record, "task_viewed", "succeeded", "minimum_summary_viewed");
    return toAdminReviewTaskDetail(record);
  }

  public async getTaskSnapshot(taskId: string): Promise<AdminReviewTaskDetail> {
    return toAdminReviewTaskDetail(await this.requireTask(taskId));
  }

  public async viewTaskSnapshot(
    taskId: string,
    reviewerId: string,
  ): Promise<AdminReviewTaskDetail> {
    const record = await this.requireTask(taskId);
    await this.appendAudit(
      reviewerId,
      record,
      "task_viewed",
      "succeeded",
      "fleet_detail_viewed",
    );
    return toAdminReviewTaskDetail(record);
  }

  public async claimTask(command: ClaimAdminReviewTaskCommand): Promise<AdminReviewTaskDetail> {
    return this.runIdempotent(command.reviewerId, "claim", command.idempotencyKey, `${command.taskId}:${command.expectedTaskVersion}`, command.taskId, async () => {
      const span = this.tracer.startSpan("admin_review.claim", { taskId: command.taskId });
      try {
        const current = await this.requireTask(command.taskId);
        if (current.status !== "available" && current.status !== "released" && current.status !== "expired") {
          await this.denied(command.reviewerId, current, "task_claimed", "ADMIN_TASK_ALREADY_CLAIMED");
          throw new Error("ADMIN_TASK_ALREADY_CLAIMED");
        }
        const now = this.now();
        const next: ReviewTaskRecord = {
          ...current,
          status: "in_progress",
          ownerId: command.reviewerId,
          claimedAt: now.toISOString(),
          leaseExpiresAt: new Date(now.getTime() + leaseMilliseconds).toISOString(),
          taskVersion: current.taskVersion + 1,
        };
        const updated = await this.repository.compareAndSet(
          command.taskId,
          command.expectedTaskVersion,
          next,
        );
        if (!updated) {
          await this.denied(command.reviewerId, current, "task_claimed", "ADMIN_TASK_ALREADY_CLAIMED");
          throw new Error("ADMIN_TASK_ALREADY_CLAIMED");
        }
        await this.appendAudit(command.reviewerId, next, "task_claimed", "succeeded", "atomic_claim");
        this.metrics.increment("admin_review_claim_total", 1, { outcome: "succeeded" });
        span.end("ok");
        return toAdminReviewTaskDetail(next);
      } catch (error) {
        span.end("error");
        throw error;
      }
    });
  }

  public async renewTask(command: RenewAdminReviewTaskCommand): Promise<AdminReviewTaskDetail> {
    return this.runIdempotent(command.reviewerId, "renew", command.idempotencyKey, `${command.taskId}:${command.expectedTaskVersion}`, command.taskId, async () => {
      const current = await this.requireOwnedTask(command.taskId, command.reviewerId);
      const expiresAt = new Date(current.leaseExpiresAt ?? 0).getTime();
      const now = this.now();
      if (expiresAt - now.getTime() > renewWindowMilliseconds) throw new Error("ADMIN_LEASE_RENEWAL_TOO_EARLY");
      const next: ReviewTaskRecord = {
        ...current,
        leaseExpiresAt: new Date(now.getTime() + leaseMilliseconds).toISOString(),
        taskVersion: current.taskVersion + 1,
      };
      if (!(await this.repository.compareAndSet(command.taskId, command.expectedTaskVersion, next))) {
        throw new Error("ADMIN_TASK_OWNERSHIP_LOST");
      }
      await this.appendAudit(command.reviewerId, next, "lease_renewed", "succeeded", "lease_window");
      return toAdminReviewTaskDetail(next);
    });
  }

  public async releaseTask(command: ReleaseAdminReviewTaskCommand): Promise<AdminReviewTaskDetail> {
    return this.runIdempotent(command.reviewerId, "release", command.idempotencyKey, `${command.taskId}:${command.expectedTaskVersion}:${command.reasonCode}`, command.taskId, async () => {
      const current = await this.requireOwnedTask(command.taskId, command.reviewerId);
      const {
        ownerId: _ownerId,
        claimedAt: _claimedAt,
        leaseExpiresAt: _leaseExpiresAt,
        ...released
      } = current;
      const next: ReviewTaskRecord = {
        ...released,
        status: "released",
        taskVersion: current.taskVersion + 1,
      };
      if (!(await this.repository.compareAndSet(command.taskId, command.expectedTaskVersion, next))) {
        throw new Error("ADMIN_TASK_OWNERSHIP_LOST");
      }
      await this.appendAudit(command.reviewerId, next, "task_released", "succeeded", command.reasonCode);
      return toAdminReviewTaskDetail(next);
    });
  }

  public async previewMaterial(
    taskId: string,
    reviewerId: string,
    reason: AdminReviewMaterialReason,
    idempotencyKey: string,
  ): Promise<AdminReviewMaterialPreview> {
    const fingerprint = `${taskId}:${reason}`;
    const previous = this.previewResults.get(idempotencyKey);
    if (previous) {
      if (previous.actorId !== reviewerId || previous.fingerprint !== fingerprint) {
        throw new Error("CONFLICT_IDEMPOTENCY_KEY_REUSED");
      }
      return previous.result;
    }
    const record = await this.requireOwnedTask(taskId, reviewerId);
    await this.appendAudit(reviewerId, record, "material_previewed", "succeeded", reason);
    const result = previews[reason];
    this.previewResults.set(idempotencyKey, { actorId: reviewerId, fingerprint, result });
    return result;
  }

  public async requestMaterial(
    command: RequestVehicleMaterialAdminCommand,
  ): Promise<AdminReviewTaskDetail> {
    return this.runIdempotent(command.reviewerId, "request_material", command.idempotencyKey, `${command.taskId}:${command.expectedTaskVersion}:${command.expectedVehicleReviewVersion}:${command.reason}`, command.taskId, async () => {
      const current = await this.requireOwnedTask(command.taskId, command.reviewerId);
      if (current.status !== "in_progress" || !command.previewConfirmed) {
        throw new Error("ADMIN_DECISION_REASON_REQUIRED");
      }
      if (current.vehicleReviewVersion !== command.expectedVehicleReviewVersion) {
        throw new Error("VERSION_CONFLICT");
      }
      const vehicleResult = await this.vehicleReviews.requestMaterial({
        reviewerId: command.reviewerId,
        applicationId: current.applicationId,
        reason: command.reason,
        expectedVehicleReviewVersion: command.expectedVehicleReviewVersion,
        idempotencyKey: command.idempotencyKey,
      });
      const {
        ownerId: _ownerId,
        claimedAt: _claimedAt,
        leaseExpiresAt: _leaseExpiresAt,
        ...waiting
      } = current;
      const next: ReviewTaskRecord = {
        ...waiting,
        status: "waiting_user",
        taskVersion: current.taskVersion + 1,
        vehicleReviewVersion: vehicleResult.vehicleReviewVersion,
      };
      if (!(await this.repository.compareAndSet(command.taskId, command.expectedTaskVersion, next))) {
        throw new Error("ADMIN_TASK_OWNERSHIP_LOST");
      }
      await this.appendAudit(
        command.reviewerId,
        next,
        "material_requested",
        "succeeded",
        command.reason,
      );
      this.logger.log("info", "admin review material requested", {
        taskId: next.taskId,
        reasonCode: command.reason,
        synthetic: true,
      });
      return toAdminReviewTaskDetail(next);
    });
  }

  public async approveVehicle(
    command: ApproveVehicleReviewAdminCommand,
  ): Promise<AdminReviewTaskDetail> {
    return this.runIdempotent(
      command.reviewerId,
      "approve",
      command.idempotencyKey,
      `${command.taskId}:${command.expectedTaskVersion}:${command.expectedVehicleReviewVersion}:${command.reasonCode}`,
      command.taskId,
      async () => {
        if (!command.previewConfirmed || command.reasonCode !== "approved_standard") {
          throw new Error("ADMIN_DECISION_REASON_REQUIRED");
        }
        const current = await this.requireOwnedTask(command.taskId, command.reviewerId);
        if (current.status !== "in_progress") throw new Error("ADMIN_TASK_OWNERSHIP_LOST");
        if (current.vehicleReviewVersion !== command.expectedVehicleReviewVersion) {
          throw new Error("VERSION_CONFLICT");
        }
        if (this.hasOpenRisk(current)) throw new Error("ADMIN_OPEN_RISK_BLOCKS_APPROVAL");
        const vehicleResult = await this.vehicleReviews.approve({
          reviewerId: command.reviewerId,
          applicationId: current.applicationId,
          expectedVersion: command.expectedVehicleReviewVersion,
          idempotencyKey: command.idempotencyKey,
        });
        const next = this.complete(current, vehicleResult.version);
        if (!(await this.repository.compareAndSet(command.taskId, command.expectedTaskVersion, next))) {
          throw new Error("ADMIN_TASK_OWNERSHIP_LOST");
        }
        await this.appendAudit(command.reviewerId, next, "vehicle_approved", "succeeded", "approved_standard");
        this.metrics.increment("admin_review_decision_total", 1, { outcome: "approved" });
        return toAdminReviewTaskDetail(next);
      },
    );
  }

  public async rejectVehicle(
    command: RejectVehicleReviewAdminCommand,
  ): Promise<AdminReviewTaskDetail> {
    return this.runIdempotent(
      command.reviewerId,
      "reject",
      command.idempotencyKey,
      `${command.taskId}:${command.expectedTaskVersion}:${command.expectedVehicleReviewVersion}:${command.reasonCode}`,
      command.taskId,
      async () => {
        if (!command.previewConfirmed) throw new Error("ADMIN_DECISION_REASON_REQUIRED");
        const current = await this.requireOwnedTask(command.taskId, command.reviewerId);
        if (current.status !== "in_progress") throw new Error("ADMIN_TASK_OWNERSHIP_LOST");
        if (current.vehicleReviewVersion !== command.expectedVehicleReviewVersion) {
          throw new Error("VERSION_CONFLICT");
        }
        const vehicleResult = await this.vehicleReviews.reject({
          reviewerId: command.reviewerId,
          applicationId: current.applicationId,
          reasonCode: command.reasonCode,
          userMessage: rejectionMessages[command.reasonCode],
          expectedVersion: command.expectedVehicleReviewVersion,
          idempotencyKey: command.idempotencyKey,
        });
        const next = this.complete(current, vehicleResult.version);
        if (!(await this.repository.compareAndSet(command.taskId, command.expectedTaskVersion, next))) {
          throw new Error("ADMIN_TASK_OWNERSHIP_LOST");
        }
        await this.appendAudit(command.reviewerId, next, "vehicle_rejected", "succeeded", command.reasonCode);
        this.metrics.increment("admin_review_decision_total", 1, { outcome: "rejected" });
        return toAdminReviewTaskDetail(next);
      },
    );
  }

  public async listAudit(taskId: string): Promise<readonly AdminReviewAuditEntry[]> {
    const entries = await this.audit.query("admin_review_task", taskId);
    return entries.map((entry) => ({
      id: entry.id,
      occurredAt: entry.occurredAt,
      actorId: entry.actorId,
      action: entry.action as AdminReviewAuditEntry["action"],
      outcome: entry.outcome === "denied" ? "denied" : "succeeded",
      reasonCode: entry.reasonCode,
      taskId: entry.subjectId,
      correlationId: entry.correlationId,
      synthetic: true,
    }));
  }

  public recoverResult(reviewerId: string, idempotencyKey: string): AdminReviewTaskDetail | undefined {
    const record = this.idempotentResults.get(idempotencyKey);
    return record?.actorId === reviewerId ? record.result : undefined;
  }

  private async requireTask(taskId: string): Promise<ReviewTaskRecord> {
    const record = await this.repository.get(taskId);
    if (!record) throw new Error("ADMIN_TASK_NOT_FOUND");
    return record;
  }

  private hasOpenRisk(record: ReviewTaskRecord): boolean {
    return (
      record.insuranceExpiryStatus === "incomplete" ||
      record.authorizationEvidenceStatus === "incomplete" ||
      record.attachmentValidationStatus === "invalid"
    );
  }

  private complete(record: ReviewTaskRecord, vehicleReviewVersion: number): ReviewTaskRecord {
    const {
      ownerId: _ownerId,
      claimedAt: _claimedAt,
      leaseExpiresAt: _leaseExpiresAt,
      ...completed
    } = record;
    return {
      ...completed,
      status: "completed",
      taskVersion: record.taskVersion + 1,
      vehicleReviewVersion,
    };
  }

  private async requireOwnedTask(taskId: string, reviewerId: string): Promise<ReviewTaskRecord> {
    const record = await this.requireTask(taskId);
    const leaseExpiresAt = new Date(record.leaseExpiresAt ?? 0);
    if (record.ownerId !== reviewerId || leaseExpiresAt <= this.now()) {
      await this.denied(reviewerId, record, "task_viewed", "ADMIN_TASK_OWNERSHIP_LOST");
      throw new Error("ADMIN_TASK_OWNERSHIP_LOST");
    }
    return record;
  }

  private async runIdempotent(
    actorId: string,
    operationName: string,
    key: string,
    fingerprint: string,
    taskId: string,
    operation: () => Promise<AdminReviewTaskDetail>,
  ): Promise<AdminReviewTaskDetail> {
    return this.withTaskLock(taskId, async () => {
      const previous = this.idempotentResults.get(key);
      if (previous) {
        if (
          previous.actorId !== actorId ||
          previous.operation !== operationName ||
          previous.fingerprint !== fingerprint
        ) {
          throw new Error("CONFLICT_IDEMPOTENCY_KEY_REUSED");
        }
        return previous.result;
      }
      const result = await operation();
      this.idempotentResults.set(key, {
        actorId,
        operation: operationName,
        fingerprint,
        result,
      });
      return result;
    });
  }

  private async withTaskLock<TResult>(
    taskId: string,
    operation: () => Promise<TResult>,
  ): Promise<TResult> {
    const previous = this.taskLocks.get(taskId) ?? Promise.resolve();
    let release = () => {};
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const queued = previous.then(() => current);
    this.taskLocks.set(taskId, queued);
    await previous;
    try {
      return await operation();
    } finally {
      release();
      if (this.taskLocks.get(taskId) === queued) this.taskLocks.delete(taskId);
    }
  }

  private async denied(
    actorId: string,
    record: ReviewTaskRecord,
    action: AdminReviewAuditEntry["action"],
    reasonCode: string,
  ): Promise<void> {
    this.metrics.increment("admin_review_denied_total", 1, { reasonCode });
    await this.appendAudit(actorId, record, action, "denied", reasonCode);
  }

  private async appendAudit(
    actorId: string,
    record: ReviewTaskRecord,
    action: AdminReviewAuditEntry["action"],
    outcome: "succeeded" | "denied",
    reasonCode: string,
  ): Promise<void> {
    const occurredAt = this.now().toISOString();
    await this.audit.append({
      id: `audit-${record.taskId}-${record.taskVersion}-${action}-${outcome}`,
      occurredAt,
      actorId,
      action,
      subjectType: "admin_review_task",
      subjectId: record.taskId,
      outcome,
      reasonCode,
      correlationId: record.applicationId,
      synthetic: true,
    });
  }
}
