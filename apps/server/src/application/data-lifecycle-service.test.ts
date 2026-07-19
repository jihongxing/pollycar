import { describe, expect, it } from "vitest";
import { MemoryAuditLog } from "../adapters/memory-audit.js";
import { MemoryRepository, MemoryTransaction } from "../adapters/memory-repository.js";
import type { TripChatRecord } from "./communication-service.js";
import { DataLifecycleService, type LocationLifecycleRecord } from "./data-lifecycle-service.js";

describe("DataLifecycleService", () => {
  it("聊天保留到期后删除正文但保留摘要", async () => {
    const now = () => new Date("2026-07-16T08:00:00.000Z");
    const chats = new MemoryRepository<TripChatRecord>();
    await chats.put("trip-1", chatRecord(false), 0);
    const service = new DataLifecycleService(
      chats,
      new MemoryRepository<LocationLifecycleRecord>(),
      new MemoryTransaction(),
      new MemoryAuditLog(),
      now,
    );
    await service.requestChatDeletion("synthetic-passenger-8", "trip-1", "delete-chat");
    const stored = await chats.get("trip-1");
    expect(stored?.value.messages).toEqual([]);
    expect(stored?.value.contentDeletedAt).toBe(now().toISOString());
  });

  it("安全证据保留锁阻止聊天正文删除并记录审计", async () => {
    const chats = new MemoryRepository<TripChatRecord>();
    const audit = new MemoryAuditLog();
    await chats.put("trip-1", chatRecord(true), 0);
    const service = new DataLifecycleService(
      chats,
      new MemoryRepository<LocationLifecycleRecord>(),
      new MemoryTransaction(),
      audit,
      () => new Date("2026-07-16T08:00:00.000Z"),
    );
    await expect(
      service.requestChatDeletion("synthetic-passenger-8", "trip-1", "delete-blocked"),
    ).rejects.toThrow("DATA_DELETION_BLOCKED_BY_HOLD");
    await expect(audit.query("data_lifecycle", "trip-1")).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "chat_content_deletion_blocked", outcome: "denied" }),
      ]),
    );
  });

  it("精准位置七十二小时和实时缓存一小时后由生命周期任务删除", async () => {
    const now = () => new Date("2026-07-05T12:00:00.000Z");
    const service = new DataLifecycleService(
      new MemoryRepository<TripChatRecord>(),
      new MemoryRepository<LocationLifecycleRecord>(),
      new MemoryTransaction(),
      new MemoryAuditLog(),
      now,
    );
    await service.registerLocation("trip-old", "precise_location", "2026-07-01T08:00:00.000Z");
    await service.registerLocation("cache-old", "realtime_location_cache", "2026-07-05T08:00:00.000Z");
    await expect(service.run()).resolves.toMatchObject({ inspected: 2, deleted: 2, blockedByHold: 0 });
  });
});

function chatRecord(evidenceHold: boolean): TripChatRecord {
  return {
    tripId: "trip-1",
    messages: [{
      messageId: "message-1",
      senderAccountId: "synthetic-passenger-8",
      body: "待删除正文",
      sentAt: "2026-07-01T08:00:00.000Z",
      deliveryState: "sent",
      synthetic: true,
    }],
    processedKeys: [],
    openedAt: "2026-07-01T08:00:00.000Z",
    closedAt: "2026-07-01T09:00:00.000Z",
    contentDeleteAfter: "2026-07-04T09:00:00.000Z",
    evidenceHold,
    synthetic: true,
  };
}
