import { describe, expect, it } from "vitest";
import { MemoryRepository, MemoryTransaction } from "../adapters/memory-repository.js";
import {
  AccountSessionService,
  type AccountSessionRecord,
} from "./account-session-service.js";

describe("内部账户会话服务", () => {
  it("认证时重新读取成年资格并立即更新业务准入", async () => {
    let allowed = false;
    const service = new AccountSessionService(
      new MemoryRepository<AccountSessionRecord>(),
      new MemoryTransaction(),
      async () => ({
        adultEligibilityState: allowed ? "verified" : "not_started",
        businessAccessAllowed: allowed,
        driverAvailable: false,
      }),
      () => new Date("2026-07-13T00:00:00.000Z"),
    );
    const created = await service.create("dynamic-account");
    expect((await service.authenticate(created.token))?.businessAccessAllowed).toBe(false);

    allowed = true;

    expect(await service.authenticate(created.token)).toMatchObject({
      adultEligibilityState: "verified",
      businessAccessAllowed: true,
    });
  });

  it("创建 30 分钟会话并携带成年资格状态", async () => {
    const service = createService();
    const created = await service.create("synthetic-account-7");
    expect(created.token).toMatch(/^synthetic-session-/);
    expect(created.session).toMatchObject({
      activeIdentity: "passenger",
      availableIdentities: ["passenger", "driver"],
      adultEligibilityState: "verified",
      businessAccessAllowed: true,
      state: "active",
    });
    expect(
      new Date(created.session.expiresAt).getTime() - new Date(created.session.issuedAt).getTime(),
    ).toBe(30 * 60 * 1000);
  });

  it("身份切换检查车主资格并保持幂等", async () => {
    const service = createService();
    const created = await service.create("synthetic-account-7");
    const first = await service.switchIdentity(created.token, "driver", "identity-driver-key");
    const replay = await service.switchIdentity(created.token, "driver", "identity-driver-key");
    expect(first.activeIdentity).toBe("driver");
    expect(replay).toEqual(first);
  });

  it("过期和撤销会话拒绝继续使用", async () => {
    let now = new Date("2026-07-13T00:00:00.000Z");
    const service = createService(() => now);
    const expired = await service.create("synthetic-account-7");
    now = new Date("2026-07-13T00:30:00.000Z");
    await expect(service.switchIdentity(expired.token, "driver", "expired-key")).rejects.toThrow(
      "SESSION_EXPIRED",
    );

    now = new Date("2026-07-13T01:00:00.000Z");
    const active = await service.create("synthetic-account-7");
    await expect(service.revoke(active.token, "revoke-key")).resolves.toMatchObject({
      state: "revoked",
    });
    await expect(service.switchIdentity(active.token, "driver", "revoked-key")).rejects.toThrow(
      "SESSION_REVOKED",
    );
  });

  it("未完成成年资格不能切换业务身份", async () => {
    const service = new AccountSessionService(
      new MemoryRepository<AccountSessionRecord>(),
      new MemoryTransaction(),
      async () => ({
        adultEligibilityState: "collecting",
        businessAccessAllowed: false,
        driverAvailable: true,
      }),
      () => new Date("2026-07-13T00:00:00.000Z"),
    );
    const created = await service.create("synthetic-unverified-9");
    await expect(service.switchIdentity(created.token, "driver", "driver-key")).rejects.toThrow(
      "ADULT_ELIGIBILITY_REQUIRED",
    );
  });

  it("创建、退出和离开车主身份都会触发上线会话失效", async () => {
    const boundaries: string[] = [];
    const service = new AccountSessionService(
      new MemoryRepository<AccountSessionRecord>(),
      new MemoryTransaction(),
      async () => ({
        adultEligibilityState: "verified",
        businessAccessAllowed: true,
        driverAvailable: true,
      }),
      () => new Date("2026-07-30T00:00:00.000Z"),
      async (_accountId, reason) => {
        boundaries.push(reason);
      },
    );
    const created = await service.create("synthetic-account-7");
    await service.switchIdentity(
      created.token,
      "driver",
      "switch-to-driver",
    );
    await service.switchIdentity(
      created.token,
      "passenger",
      "switch-to-passenger",
    );
    await service.revoke(created.token, "logout-session");

    expect(boundaries).toEqual([
      "session_created",
      "identity_switch",
      "logout",
    ]);
  });
});

function createService(now: () => Date = () => new Date("2026-07-13T00:00:00.000Z")) {
  return new AccountSessionService(
    new MemoryRepository<AccountSessionRecord>(),
    new MemoryTransaction(),
    async () => ({
      adultEligibilityState: "verified",
      businessAccessAllowed: true,
      driverAvailable: true,
    }),
    now,
  );
}
