import { describe, expect, it } from "vitest";
import { createInternalSandbox } from "../sandbox.js";

describe("CommunicationService", () => {
  it("持久化双方合成消息并在刷新后恢复", async () => {
    const sandbox = createInternalSandbox(() => new Date("2026-07-12T08:00:00.000Z"));
    await sandbox.ready;
    await acceptSeedTrip(sandbox);

    const sent = await sandbox.communications.sendTripChatMessage(
      "synthetic-passenger-8",
      "synthetic-trip-seed-1",
      "请在东门等我",
      "chat-message-1",
    );
    const restored = await sandbox.communications.getTripChat(
      "synthetic-account-7",
      "synthetic-trip-seed-1",
    );

    expect(sent.realChatEnabled).toBe(false);
    expect(restored.messages).toHaveLength(1);
    expect(restored.messages[0]?.body).toBe("请在东门等我");
    await sandbox.close();
  });

  it("拒绝非参与者并在安全案件打开后冻结会话", async () => {
    const sandbox = createInternalSandbox(() => new Date("2026-07-12T08:00:00.000Z"));
    await sandbox.ready;
    await acceptSeedTrip(sandbox);
    await expect(
      sandbox.communications.getTripChat("unknown-account", "synthetic-trip-seed-1"),
    ).rejects.toThrow("TRIP_FORBIDDEN");
    await sandbox.safetyCases.report(
      "synthetic-passenger-8",
      "synthetic-trip-seed-1",
      "unsafe_behavior",
      "chat-report",
    );
    expect(
      (await sandbox.communications.getTripChat("synthetic-passenger-8", "synthetic-trip-seed-1")).state,
    ).toBe("frozen");
    await expect(
      sandbox.communications.sendTripChatMessage(
        "synthetic-account-7",
        "synthetic-trip-seed-1",
        "仍然发送",
        "chat-after-freeze",
      ),
    ).rejects.toThrow("CHAT_FROZEN");
    await sandbox.close();
  });

  it("持久化单条和全部已读状态", async () => {
    const sandbox = createInternalSandbox();
    await sandbox.ready;
    const initial = await sandbox.communications.getMessageCenter("synthetic-passenger-8");
    const itemId = initial.items.find((item) => !item.readAt)!.itemId;
    const oneRead = await sandbox.communications.markMessageRead(
      "synthetic-passenger-8",
      itemId,
      "read-one",
    );
    const allRead = await sandbox.communications.markAllMessagesRead(
      "synthetic-passenger-8",
      "read-all",
    );
    expect(oneRead.unreadCount).toBe(initial.unreadCount - 1);
    expect(allRead.unreadCount).toBe(0);
    expect((await sandbox.communications.getMessageCenter("synthetic-passenger-8")).unreadCount).toBe(0);
    await sandbox.close();
  });

  it("行程关闭后七十二小时内继续开放并生成删除期限", async () => {
    const sandbox = createInternalSandbox(() => new Date("2026-07-12T08:00:00.000Z"));
    await sandbox.ready;
    await acceptSeedTrip(sandbox);
    await sandbox.communications.sendTripChatMessage(
      "synthetic-passenger-8",
      "synthetic-trip-seed-1",
      "保留期限测试",
      "chat-retention",
    );
    const stored = await sandbox.syntheticTripRepository.get("synthetic-trip-seed-1");
    await sandbox.syntheticTripRepository.put(
      "synthetic-trip-seed-1",
      { ...stored!.value, state: "completed", completedAt: "2026-07-12T08:00:00.000Z" },
      stored!.version,
    );
    const chat = await sandbox.communications.getTripChat(
      "synthetic-passenger-8",
      "synthetic-trip-seed-1",
    );
    expect(chat.retention).toMatchObject({
      contentDeleteAfter: "2026-07-15T08:00:00.000Z",
      evidenceHold: false,
      deletionState: "not_due",
      summaryRetained: true,
    });
    expect(chat.state).toBe("open");
    await expect(
      sandbox.communications.sendTripChatMessage(
        "synthetic-passenger-8",
        "synthetic-trip-seed-1",
        "关闭后三天内仍可发送",
        "chat-within-72-hours",
      ),
    ).resolves.toMatchObject({ state: "open" });
    await sandbox.close();
  });

  it("行程关闭七十二小时后自动关闭并删除正文", async () => {
    let current = new Date("2026-07-12T08:00:00.000Z");
    const sandbox = createInternalSandbox(() => current);
    await sandbox.ready;
    await acceptSeedTrip(sandbox);
    await sandbox.communications.sendTripChatMessage(
      "synthetic-passenger-8",
      "synthetic-trip-seed-1",
      "七十二小时后删除",
      "chat-auto-delete",
    );
    const stored = await sandbox.syntheticTripRepository.get("synthetic-trip-seed-1");
    await sandbox.syntheticTripRepository.put(
      "synthetic-trip-seed-1",
      { ...stored!.value, state: "completed", completedAt: current.toISOString() },
      stored!.version,
    );
    current = new Date("2026-07-15T08:00:00.000Z");
    const chat = await sandbox.communications.getTripChat(
      "synthetic-passenger-8",
      "synthetic-trip-seed-1",
    );
    expect(chat.state).toBe("closed");
    expect(chat.messages).toEqual([]);
    expect(chat.retention.deletionState).toBe("deleted");
    await sandbox.close();
  });

  it("安全举报自动对通信正文施加证据保留锁", async () => {
    const sandbox = createInternalSandbox(() => new Date("2026-07-12T08:00:00.000Z"));
    await sandbox.ready;
    await acceptSeedTrip(sandbox);
    await sandbox.communications.sendTripChatMessage(
      "synthetic-passenger-8",
      "synthetic-trip-seed-1",
      "证据保留测试",
      "chat-hold",
    );
    await sandbox.safetyCases.report(
      "synthetic-passenger-8",
      "synthetic-trip-seed-1",
      "harassment",
      "safety-hold",
    );
    const chat = await sandbox.communications.getTripChat(
      "synthetic-passenger-8",
      "synthetic-trip-seed-1",
    );
    expect(chat.retention.evidenceHold).toBe(true);
    expect(chat.retention.deletionState).toBe("blocked_by_hold");
    await sandbox.close();
  });
});

async function acceptSeedTrip(sandbox: ReturnType<typeof createInternalSandbox>) {
  const stored = await sandbox.syntheticTripRepository.get("synthetic-trip-seed-1");
  if (!stored) throw new Error("测试种子行程不存在");
  await sandbox.syntheticTripRepository.put(
    stored.key,
    {
      ...stored.value,
      driverAccountId: "synthetic-account-7",
      state: "accepted",
      acceptedAt: "2026-07-12T08:00:00.000Z",
    },
    stored.version,
  );
}
