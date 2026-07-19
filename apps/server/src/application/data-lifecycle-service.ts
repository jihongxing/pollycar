import type { LifecycleRecordView, LifecycleRunResult } from "@pollycar/contracts";
import type { AuditLog } from "../ports/audit.js";
import type { Repository, Transaction } from "../ports/storage.js";
import type { TripChatRecord } from "./communication-service.js";

export type LocationLifecycleRecord = Readonly<{
  resourceId: string;
  resource: "precise_location" | "realtime_location_cache";
  deleteAfter: string;
  evidenceHold: boolean;
  deletedAt?: string;
  synthetic: true;
}>;

export class DataLifecycleService {
  constructor(
    private readonly chats: Repository<TripChatRecord>,
    private readonly locations: Repository<LocationLifecycleRecord>,
    private readonly transaction: Transaction,
    private readonly audit: AuditLog,
    private readonly now: () => Date,
  ) {}

  async requestChatDeletion(
    accountId: string,
    tripId: string,
    idempotencyKey: string,
  ): Promise<void> {
    await this.transaction.run(async () => {
      const stored = await this.chats.get(tripId);
      if (!stored) throw new Error("CHAT_NOT_FOUND");
      if (stored.value.evidenceHold) {
        await this.appendAudit(accountId, tripId, "chat_content_deletion_blocked", "EVIDENCE_HOLD", idempotencyKey);
        throw new Error("DATA_DELETION_BLOCKED_BY_HOLD");
      }
      if (!stored.value.contentDeleteAfter || new Date(stored.value.contentDeleteAfter) > this.now()) {
        throw new Error("DATA_RETENTION_ACTIVE");
      }
      await this.chats.put(tripId, {
        ...stored.value,
        messages: [],
        contentDeletedAt: this.now().toISOString(),
        processedKeys: [...stored.value.processedKeys, `${accountId}:${idempotencyKey}`],
      }, stored.version);
      await this.appendAudit(accountId, tripId, "chat_content_deleted", "RETENTION_EXPIRED", idempotencyKey);
    });
  }

  async setChatEvidenceHold(
    actorId: string,
    tripId: string,
    enabled: boolean,
    correlationId: string,
  ): Promise<void> {
    const stored = await this.chats.get(tripId);
    await this.chats.put(
      tripId,
      stored
        ? { ...stored.value, evidenceHold: enabled }
        : {
            tripId,
            messages: [],
            processedKeys: [],
            evidenceHold: enabled,
            synthetic: true,
          },
      stored?.version ?? 0,
    );
    await this.appendAudit(
      actorId,
      tripId,
      enabled ? "chat_evidence_hold_applied" : "chat_evidence_hold_released",
      enabled ? "SAFETY_EVIDENCE" : "HOLD_RELEASED",
      correlationId,
    );
  }

  async registerLocation(
    resourceId: string,
    resource: LocationLifecycleRecord["resource"],
    closedAt: string,
  ): Promise<LifecycleRecordView> {
    const retentionMilliseconds =
      resource === "precise_location" ? 72 * 60 * 60_000 : 60 * 60_000;
    const record: LocationLifecycleRecord = {
      resourceId,
      resource,
      deleteAfter: new Date(new Date(closedAt).getTime() + retentionMilliseconds).toISOString(),
      evidenceHold: false,
      synthetic: true,
    };
    await this.locations.put(`${resource}:${resourceId}`, record, 0);
    return this.toLocationView(record);
  }

  async setLocationEvidenceHold(
    actorId: string,
    resourceId: string,
    enabled: boolean,
    correlationId: string,
  ): Promise<void> {
    for (const stored of await this.locations.list()) {
      if (stored.value.resourceId !== resourceId) continue;
      await this.locations.put(stored.key, { ...stored.value, evidenceHold: enabled }, stored.version);
    }
    await this.appendAudit(
      actorId,
      resourceId,
      enabled ? "location_evidence_hold_applied" : "location_evidence_hold_released",
      enabled ? "SAFETY_EVIDENCE" : "HOLD_RELEASED",
      correlationId,
    );
  }

  async run(): Promise<LifecycleRunResult> {
    let deleted = 0;
    let blockedByHold = 0;
    const now = this.now();
    for (const stored of await this.locations.list()) {
      if (stored.value.deletedAt || new Date(stored.value.deleteAfter) > now) continue;
      if (stored.value.evidenceHold) {
        blockedByHold += 1;
        continue;
      }
      await this.locations.put(stored.key, {
        ...stored.value,
        deletedAt: now.toISOString(),
      }, stored.version);
      deleted += 1;
      await this.appendAudit("lifecycle-worker", stored.value.resourceId, "location_data_deleted", stored.value.resource, stored.key);
    }
    return {
      inspected: (await this.locations.list()).length,
      deleted,
      blockedByHold,
      synthetic: true,
    };
  }

  private toLocationView(record: LocationLifecycleRecord): LifecycleRecordView {
    return {
      resource: record.resource,
      resourceId: record.resourceId,
      deleteAfter: record.deleteAfter,
      evidenceHold: record.evidenceHold,
      deletionState: record.deletedAt ? "deleted" : new Date(record.deleteAfter) <= this.now() ? "eligible" : "not_due",
      ...(record.deletedAt ? { deletedAt: record.deletedAt } : {}),
      realDataEnabled: false,
      synthetic: true,
    };
  }

  private appendAudit(actorId: string, subjectId: string, action: string, reasonCode: string, correlationId: string) {
    return this.audit.append({
      id: crypto.randomUUID(),
      occurredAt: this.now().toISOString(),
      actorId,
      action,
      subjectType: "data_lifecycle",
      subjectId,
      outcome: action.endsWith("blocked") ? "denied" : "succeeded",
      reasonCode,
      correlationId,
      synthetic: true,
    });
  }
}
