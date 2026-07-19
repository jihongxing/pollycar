import type {
  ApproveVehicleReviewCommand,
  RequestVehicleMaterialCommand,
  RejectVehicleReviewCommand,
  EscalateVehicleReviewCommand,
  ReconsiderVehicleReviewCommand,
  ResubmitVehicleMaterialCommand,
  SaveVehicleDraftCommand,
  SubmitVehicleReviewCommand,
  VehicleReviewStatus,
  VehicleReviewView,
} from "@pollycar/contracts";

import type { AuditLog } from "../ports/audit.js";
import type { Metrics, StructuredLogger, Tracer } from "../ports/observability.js";
import type { Repository, Transaction } from "../ports/storage.js";
import type { TaskQueue } from "../ports/tasks.js";

export type VehicleReviewRecord = Readonly<{
  applicationId: string;
  accountId: string;
  status: VehicleReviewStatus;
  ownerIdentityAvailable: boolean;
  maxPassengerCount?: VehicleReviewView["maxPassengerCount"];
  vehicleType?: string;
  insuranceExpiresOn?: string;
  syntheticAttachmentId?: string;
  requestedMaterialCodes: readonly string[];
  decisionCode?: string;
  escalationType?: string;
  userMessage?: Readonly<{ title: string; body: string }>;
  lastReviewerId?: string;
  events: readonly Readonly<{ code: VehicleReviewView["timeline"][number]["code"]; occurredAt: string }>[];
  processedKeys: readonly string[];
  synthetic: true;
}>;

export class VehicleReviewService {
  public constructor(
    private readonly repository: Repository<VehicleReviewRecord>,
    private readonly transaction: Transaction,
    private readonly tasks: TaskQueue,
    private readonly audit: AuditLog,
    private readonly logger: StructuredLogger,
    private readonly metrics: Metrics,
    private readonly tracer: Tracer,
    private readonly now: () => Date,
  ) {}

  public async get(applicationId: string, accountId: string): Promise<VehicleReviewView> {
    const stored = await this.repository.get(applicationId);
    if (!stored) return this.toView(this.createDraft(applicationId, accountId), 0);
    if (stored.value.accountId !== accountId) throw new Error("VEHICLE_REVIEW_FORBIDDEN");
    return this.toView(stored.value, stored.version);
  }

  public async saveDraft(command: SaveVehicleDraftCommand): Promise<VehicleReviewView> {
    return this.change(command.applicationId, command.expectedVersion, command.idempotencyKey, command.accountId, (current) => {
      this.requireStatus(current.status, ["draft", "needs_material"]);
      return {
        ...current,
        vehicleType: command.vehicleType,
        maxPassengerCount: command.maxPassengerCount,
        insuranceExpiresOn: command.insuranceExpiresOn,
        syntheticAttachmentId: command.syntheticAttachmentId,
      };
    }, "vehicle_review_draft_saved", command.accountId);
  }

  public async submit(command: SubmitVehicleReviewCommand): Promise<VehicleReviewView> {
    const view = await this.change(command.applicationId, command.expectedVersion, command.idempotencyKey, command.accountId, (current) => {
      this.requireStatus(current.status, ["draft"]);
      this.requireComplete(current);
      return {
        ...current,
        status: "under_review",
        events: [...current.events, { code: "submitted", occurredAt: this.now().toISOString() }],
      };
    }, "vehicle_review_submitted", command.accountId);
    await this.tasks.enqueue({
      id: `vehicle-review-${command.applicationId}`,
      type: "vehicle_review",
      idempotencyKey: `vehicle-review:${command.applicationId}`,
      payload: { applicationId: command.applicationId, synthetic: true },
      maximumAttempts: 3,
    });
    return view;
  }

  public async requestMaterial(command: RequestVehicleMaterialCommand): Promise<VehicleReviewView> {
    return this.change(command.applicationId, command.expectedVersion, command.idempotencyKey, undefined, (current) => {
      this.requireStatus(current.status, ["under_review"]);
      return {
        ...current,
        status: "needs_material",
        requestedMaterialCodes: [...command.materialCodes],
        events: [...current.events, { code: "material_requested", occurredAt: this.now().toISOString() }],
      };
    }, "vehicle_review_material_requested", command.reviewerId);
  }

  public async resubmitMaterial(command: ResubmitVehicleMaterialCommand): Promise<VehicleReviewView> {
    return this.change(command.applicationId, command.expectedVersion, command.idempotencyKey, command.accountId, (current) => {
      this.requireStatus(current.status, ["needs_material"]);
      return {
        ...current,
        status: "under_review",
        insuranceExpiresOn: command.insuranceExpiresOn,
        syntheticAttachmentId: command.syntheticAttachmentId,
        requestedMaterialCodes: [],
        events: [...current.events, { code: "material_resubmitted", occurredAt: this.now().toISOString() }],
      };
    }, "vehicle_review_material_resubmitted", command.accountId);
  }

  public async approve(command: ApproveVehicleReviewCommand): Promise<VehicleReviewView> {
    return this.change(command.applicationId, command.expectedVersion, command.idempotencyKey, undefined, (current) => {
      this.requireStatus(current.status, ["under_review"]);
      return {
        ...current,
        status: "approved",
        ownerIdentityAvailable: true,
        decisionCode: "approved_standard",
        lastReviewerId: command.reviewerId,
        events: [...current.events, { code: "approved", occurredAt: this.now().toISOString() }],
      };
    }, "vehicle_review_approved", command.reviewerId);
  }

  public async reject(command: RejectVehicleReviewCommand): Promise<VehicleReviewView> {
    if (!command.reasonCode) throw new Error("ADMIN_DECISION_REASON_REQUIRED");
    return this.change(command.applicationId, command.expectedVersion, command.idempotencyKey, undefined, (current) => {
      this.requireStatus(current.status, ["under_review"]);
      return {
        ...current,
        status: "revoked",
        decisionCode: command.reasonCode,
        userMessage: command.userMessage,
        lastReviewerId: command.reviewerId,
      };
    }, "vehicle_review_rejected", command.reviewerId);
  }

  public async escalate(command: EscalateVehicleReviewCommand): Promise<VehicleReviewView> {
    if (!command.reasonCode || !command.escalationType) throw new Error("ADMIN_DECISION_REASON_REQUIRED");
    return this.change(command.applicationId, command.expectedVersion, command.idempotencyKey, undefined, (current) => {
      this.requireStatus(current.status, ["under_review"]);
      return {
        ...current,
        status: "suspended",
        decisionCode: command.reasonCode,
        escalationType: command.escalationType,
        lastReviewerId: command.reviewerId,
      };
    }, "vehicle_review_escalated", command.reviewerId);
  }

  public async reconsider(command: ReconsiderVehicleReviewCommand): Promise<VehicleReviewView> {
    if (command.seniorReviewerId === command.originalReviewerId) {
      throw new Error("ADMIN_SELF_RECONSIDERATION_FORBIDDEN");
    }
    return this.change(command.applicationId, command.expectedVersion, command.idempotencyKey, undefined, (current) => {
      this.requireStatus(current.status, ["revoked", "suspended"]);
      const status =
        command.outcome === "overturn"
          ? "approved"
          : command.outcome === "return"
            ? "under_review"
            : "suspended";
      return {
        ...current,
        status,
        ownerIdentityAvailable: status === "approved",
        decisionCode: command.reasonCode,
        lastReviewerId: command.seniorReviewerId,
      };
    }, "vehicle_review_reconsidered", command.seniorReviewerId);
  }

  private async change(
    applicationId: string,
    expectedVersion: number,
    idempotencyKey: string,
    accountId: string | undefined,
    update: (current: VehicleReviewRecord) => VehicleReviewRecord,
    action: string,
    actorId: string,
  ): Promise<VehicleReviewView> {
    const span = this.tracer.startSpan(action);
    try {
      return await this.transaction.run(async () => {
        const stored = await this.repository.get(applicationId);
        const current = stored?.value ?? this.createDraft(applicationId, accountId ?? "");
        if (accountId && current.accountId !== accountId) throw new Error("VEHICLE_REVIEW_FORBIDDEN");
        if (current.processedKeys.includes(idempotencyKey)) return this.toView(current, stored?.version ?? 0);
        const next = update(current);
        const saved = await this.repository.put(
          applicationId,
          { ...next, processedKeys: [...next.processedKeys, idempotencyKey] },
          expectedVersion,
        );
        await this.audit.append({
          id: `audit-${action}-${applicationId}-${saved.version}`,
          occurredAt: this.now().toISOString(),
          actorId,
          action,
          subjectType: "vehicle_review",
          subjectId: applicationId,
          outcome: "succeeded",
          reasonCode: next.status,
          correlationId: idempotencyKey,
          synthetic: true,
        });
        this.logger.log("info", action, { applicationId, version: saved.version, synthetic: true });
        this.metrics.increment(`vehicle_review.${action}`);
        span.end("ok");
        return this.toView(saved.value, saved.version);
      });
    } catch (error) {
      span.end("error");
      throw error;
    }
  }

  private createDraft(applicationId: string, accountId: string): VehicleReviewRecord {
    return {
      applicationId,
      accountId,
      status: "draft",
      ownerIdentityAvailable: false,
      requestedMaterialCodes: [],
      events: [],
      processedKeys: [],
      synthetic: true,
    };
  }

  private requireComplete(record: VehicleReviewRecord): void {
    if (!record.vehicleType || !record.insuranceExpiresOn || !record.syntheticAttachmentId) {
      throw new Error("VEHICLE_REVIEW_INCOMPLETE");
    }
  }

  private requireStatus(status: VehicleReviewStatus, allowed: readonly VehicleReviewStatus[]): void {
    if (!allowed.includes(status)) throw new Error("VEHICLE_REVIEW_INVALID_STATE");
  }

  private toView(record: VehicleReviewRecord, version: number): VehicleReviewView {
    const labels = {
      submitted: "资料已提交",
      review_started: "审核已开始",
      material_requested: "要求补充材料",
      material_resubmitted: "补充材料已提交",
      approved: "审核已批准",
    } as const;
    return {
      applicationId: record.applicationId,
      accountId: record.accountId,
      status: record.status,
      version,
      ownerIdentityAvailable: record.ownerIdentityAvailable,
      maxPassengerCount: record.maxPassengerCount ?? 1,
      ...(record.vehicleType ? { vehicleType: record.vehicleType } : {}),
      ...(record.insuranceExpiresOn ? { insuranceExpiresOn: record.insuranceExpiresOn } : {}),
      ...(record.syntheticAttachmentId ? { syntheticAttachmentId: record.syntheticAttachmentId } : {}),
      requestedMaterialCodes: record.requestedMaterialCodes,
      ...(record.decisionCode ? { decisionCode: record.decisionCode } : {}),
      ...(record.escalationType ? { escalationType: record.escalationType } : {}),
      ...(record.userMessage ? { userMessage: record.userMessage } : {}),
      timeline: record.events.map((event, index) => ({
        code: event.code,
        label: labels[event.code],
        occurredAt: event.occurredAt,
        state: index === record.events.length - 1 && record.status !== "approved" ? "current" : "complete",
      })),
      synthetic: true,
    };
  }
}
