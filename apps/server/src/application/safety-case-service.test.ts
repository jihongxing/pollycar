import { describe, expect, it } from "vitest";
import { MemoryAuditLog } from "../adapters/memory-audit.js";
import { MemoryRepository, MemoryTransaction } from "../adapters/memory-repository.js";
import { SafetyCaseService } from "./safety-case-service.js";
import type { SyntheticTripRecord } from "./synthetic-trip-service.js";

describe("临时对话、举报冻结与申诉", () => {
  it("举报立即冻结，申诉不自动解冻，独立安全决定后恢复", async () => {
    const trips = new MemoryRepository<SyntheticTripRecord>();
    await trips.put("synthetic-trip-1", trip, 0);
    const service = new SafetyCaseService(
      trips,
      new MemoryRepository(),
      new MemoryRepository(),
      new MemoryTransaction(),
      new MemoryAuditLog(),
      () => new Date("2026-07-11T12:00:00.000Z"),
    );
    expect(
      await service.sendMessage(
        "synthetic-account-7",
        trip.tripId,
        "合成消息：我已到达。",
        "chat-message-1",
      ),
    ).toMatchObject({ chat: { state: "open", messages: [{ synthetic: true }] } });
    const frozen = await service.report(
      "synthetic-passenger-8",
      trip.tripId,
      "unsafe_behavior",
      "safety-report-1",
    );
    expect(frozen).toMatchObject({
      chat: { state: "frozen" },
      safetyCase: { state: "open_frozen", version: 1 },
    });
    const appealed = await service.appeal(
      "synthetic-account-7",
      "safety-synthetic-trip-1",
      1,
      "safety-appeal-1",
    );
    expect(appealed.state).toBe("appealing");
    expect((await service.dashboard("synthetic-account-7", trip.tripId)).chat?.state).toBe("frozen");
    expect(await service.resolve(trip.tripId, 2, "restore_access", "safety-resolve-1")).toMatchObject({
      state: "restored",
      resolutionCode: "restore_access",
    });
    expect((await service.dashboard("synthetic-account-7", trip.tripId)).chat?.state).toBe("open");
  });

  it("拒绝真实聊天正文", async () => {
    const trips = new MemoryRepository<SyntheticTripRecord>();
    await trips.put("synthetic-trip-1", trip, 0);
    const service = new SafetyCaseService(
      trips,
      new MemoryRepository(),
      new MemoryRepository(),
      new MemoryTransaction(),
      new MemoryAuditLog(),
      () => new Date(),
    );
    await expect(
      service.sendMessage("synthetic-account-7", trip.tripId, "我已到达", "chat-real-1"),
    ).rejects.toThrow("REAL_DATA_FORBIDDEN");
  });

  it("安全后台只返回开放案件最小摘要并隐藏聊天正文", async () => {
    const trips = new MemoryRepository<SyntheticTripRecord>();
    await trips.put("synthetic-trip-1", trip, 0);
    const service = new SafetyCaseService(
      trips,
      new MemoryRepository(),
      new MemoryRepository(),
      new MemoryTransaction(),
      new MemoryAuditLog(),
      () => new Date("2026-07-11T12:00:00.000Z"),
    );
    const frozen = await service.report(
      "synthetic-passenger-8",
      trip.tripId,
      "unsafe_behavior",
      "safety-report-admin",
    );
    await service.appeal(
      "synthetic-account-7",
      frozen.safetyCase!.caseId,
      frozen.safetyCase!.version,
      "safety-appeal-admin",
    );

    const cases = await service.listForSafetyOfficer();
    expect(cases).toHaveLength(1);
    const detail = await service.getForSafetyOfficer(cases[0]!.caseId);
    expect(detail).toMatchObject({
      state: "appealing",
      disclosure: { chatBodyAvailable: false, rawEvidenceAvailable: false },
    });
    expect(detail).not.toHaveProperty("messages");
  });
});

const trip: SyntheticTripRecord = {
  tripId: "synthetic-trip-1",
  passengerAccountId: "synthetic-passenger-8",
  driverAccountId: "synthetic-account-7",
  state: "in_progress",
  originLabel: "合成起点",
  destinationLabel: "合成终点",
  passengerCount: 1,
  createdAt: "2026-07-11T10:00:00.000Z",
  acceptedAt: "2026-07-11T11:00:00.000Z",
  startedAt: "2026-07-11T11:30:00.000Z",
  quotaPolicy: "base",
  processedKeys: [],
  synthetic: true,
};
