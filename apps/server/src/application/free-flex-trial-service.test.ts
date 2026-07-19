import { describe, expect, it } from "vitest";
import { MemoryAuditLog } from "../adapters/memory-audit.js";
import { MemoryRepository, MemoryTransaction } from "../adapters/memory-repository.js";
import { FreeFlexTrialService, type FreeFlexTrialRecord } from "./free-flex-trial-service.js";

describe("免费弹性资格合成试验服务", () => {
  it("贯通邀请、申请、批准、确认和自动启用", async () => {
    const service = createService();
    expect(await service.get("synthetic-account-7")).toMatchObject({
      state: "invited",
      qualificationFeeMinor: 0,
      paidPathEnabled: false,
      realInvitation: false,
    });
    expect(await service.submit("synthetic-account-7", 0, "free-submit-001")).toMatchObject({
      state: "under_review",
      version: 1,
    });
    expect(await service.approve("synthetic-account-7", 1, "free-approve-001")).toMatchObject({
      state: "awaiting_confirmation",
      version: 2,
    });
    expect(
      await service.confirmAndActivate("synthetic-account-7", 2, "free-confirm-001"),
    ).toMatchObject({
      state: "active",
      version: 4,
      quota: { hours24: 4, days7: 12, days30: 18 },
      maximumActivationDays: 60,
    });
  });

  it("拒绝版本冲突且同一幂等键返回原结果", async () => {
    const service = createService();
    const first = await service.submit("synthetic-account-7", 0, "free-submit-001");
    expect(await service.submit("synthetic-account-7", 1, "free-submit-001")).toEqual(first);
    await expect(
      service.approve("synthetic-account-7", 0, "free-approve-001"),
    ).rejects.toThrow("STORAGE_CONCURRENT_MODIFICATION");
  });
});

function createService() {
  return new FreeFlexTrialService(
    new MemoryRepository<FreeFlexTrialRecord>(),
    new MemoryTransaction(),
    new MemoryAuditLog(),
    () => new Date("2026-07-11T00:00:00.000Z"),
  );
}
