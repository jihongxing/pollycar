import { describe, expect, it } from "vitest";
import { MemoryAuditLog } from "../adapters/memory-audit.js";
import { MemoryRepository, MemoryTransaction } from "../adapters/memory-repository.js";
import { SyntheticSmsDelivery } from "../adapters/synthetic-sms-delivery.js";
import { AccountSessionService, type AccountSessionRecord } from "./account-session-service.js";
import {
  PhoneAuthenticationService,
  type DeviceRecord,
  type PhoneAccountRecord,
  type PhoneChallengeRecord,
  type RefreshSessionRecord,
} from "./phone-authentication-service.js";

describe("PhoneAuthenticationService", () => {
  it("拒绝格式错误、未同意协议和真实手机号", async () => {
    const { service } = createService();
    await expect(service.requestCode(request("123"))).rejects.toThrow("PHONE_NUMBER_INVALID");
    await expect(service.requestCode({ ...request("18800000007"), consentAccepted: false }))
      .rejects.toThrow("PHONE_AUTH_CONSENT_REQUIRED");
    await expect(service.requestCode(request("13800138000"))).rejects.toThrow("REAL_PHONE_DATA_FORBIDDEN");
  });

  it("完成登录即注册并复用同一账户", async () => {
    let now = new Date("2026-07-13T00:00:00.000Z");
    const { service, accounts } = createService(() => now);
    const firstChallenge = await service.requestCode(request("18800000007"));
    const first = await service.verify(verify(firstChallenge.challengeId));
    expect(first.account).toMatchObject({
      isNewAccount: true,
      businessAccessAllowed: false,
      nextStep: "adult_eligibility",
    });
    now = new Date("2026-07-13T00:01:00.000Z");
    const secondChallenge = await service.requestCode(request("18800000007", "send-2"));
    const second = await service.verify(verify(secondChallenge.challengeId, "verify-2"));
    expect(second.account.accountId).toBe(first.account.accountId);
    expect(second.account.isNewAccount).toBe(false);
    expect(await accounts.list()).toHaveLength(1);
    expect((await accounts.list())[0]?.value.phoneCiphertext).toMatch(/^synthetic:v1:/);
  });

  it("验证码消费后允许立即创建新的登录挑战", async () => {
    const { service } = createService();
    const first = await service.requestCode(request("18800000007"));
    await service.verify(verify(first.challengeId));

    const second = await service.requestCode(request("18800000007", "login-again"));

    expect(second.challengeId).not.toBe(first.challengeId);
  });

  it("覆盖错误、锁定、过期、替代和消费后重放", async () => {
    let now = new Date("2026-07-13T00:00:00.000Z");
    const { service } = createService(() => now);
    const challenge = await service.requestCode(request("18800000007"));
    await expect(service.verify(verify(challenge.challengeId, "wrong-1", "000000")))
      .rejects.toThrow("PHONE_CODE_INVALID");
    for (let index = 2; index <= 4; index += 1) {
      await expect(service.verify(verify(challenge.challengeId, `wrong-${index}`, "000000")))
        .rejects.toThrow("PHONE_CODE_INVALID");
    }
    await expect(service.verify(verify(challenge.challengeId, "wrong-5", "000000")))
      .rejects.toThrow("PHONE_CODE_LOCKED");

    now = new Date("2026-07-13T00:01:00.000Z");
    const superseded = await service.requestCode(request("18800000007", "superseded"));
    now = new Date("2026-07-13T00:02:00.000Z");
    const active = await service.requestCode(request("18800000007", "active"));
    await expect(service.verify(verify(superseded.challengeId, "old"))).rejects.toThrow("PHONE_CODE_INVALID");
    await service.verify(verify(active.challengeId, "consume"));
    await expect(service.verify(verify(active.challengeId, "replay"))).rejects.toThrow("PHONE_CODE_REPLAYED");

    now = new Date("2026-07-13T00:03:00.000Z");
    const expired = await service.requestCode(request("18800000008", "expires"));
    now = new Date("2026-07-13T00:08:01.000Z");
    await expect(service.verify(verify(expired.challengeId, "expired"))).rejects.toThrow("PHONE_CODE_EXPIRED");
  });

  it("执行限流并保留供应商未知结果", async () => {
    let now = new Date("2026-07-13T00:00:00.000Z");
    const { service } = createService(() => now);
    await service.requestCode(request("18800000007"));
    await expect(service.requestCode(request("18800000007", "too-soon")))
      .rejects.toThrow("PHONE_CODE_RATE_LIMITED");
    await expect(service.requestCode(request("18800000008", "delivery-unknown")))
      .rejects.toThrow("PHONE_CODE_DELIVERY_UNKNOWN");
  });

  it("轮换刷新会话并拒绝令牌重放和设备不一致", async () => {
    const { service } = createService();
    const challenge = await service.requestCode(request("18800000007"));
    const authenticated = await service.verify(verify(challenge.challengeId));
    const refreshed = await service.refresh({
      refreshToken: authenticated.refreshToken,
      deviceId: "device-1",
      idempotencyKey: "refresh-1",
    });
    expect(refreshed.refreshToken).not.toBe(authenticated.refreshToken);
    await expect(service.refresh({
      refreshToken: authenticated.refreshToken,
      deviceId: "device-1",
      idempotencyKey: "replay",
    })).rejects.toThrow("REFRESH_TOKEN_REPLAYED");
    await expect(service.refresh({
      refreshToken: refreshed.refreshToken,
      deviceId: "lost-device",
      idempotencyKey: "wrong-device",
    })).rejects.toThrow("REFRESH_TOKEN_REPLAYED");
  });

  it("并发验证只创建一个手机号账户", async () => {
    let now = new Date("2026-07-13T00:00:00.000Z");
    const { service, accounts } = createService(() => now);
    const first = await service.requestCode(request("18800000009", "parallel-1"));
    const firstResult = await service.verify(verify(first.challengeId, "parallel-verify-1"));
    now = new Date("2026-07-13T00:01:00.000Z");
    const second = await service.requestCode(request("18800000009", "parallel-2"));
    const secondResult = await service.verify(verify(second.challengeId, "parallel-verify-2"));
    expect(secondResult.account.accountId).toBe(firstResult.account.accountId);
    expect(await accounts.list()).toHaveLength(1);
  });
});

function createService(now: () => Date = () => new Date("2026-07-13T00:00:00.000Z")) {
  const accounts = new MemoryRepository<PhoneAccountRecord>();
  const sessions = new AccountSessionService(
    new MemoryRepository<AccountSessionRecord>(),
    new MemoryTransaction(),
    async () => ({
      adultEligibilityState: "not_started",
      businessAccessAllowed: false,
      driverAvailable: false,
    }),
    now,
  );
  return {
    accounts,
    service: new PhoneAuthenticationService(
      accounts,
      new MemoryRepository<PhoneChallengeRecord>(),
      new MemoryRepository<DeviceRecord>(),
      new MemoryRepository<RefreshSessionRecord>(),
      sessions,
      new SyntheticSmsDelivery(),
      new MemoryTransaction(),
      new MemoryAuditLog(),
      now,
    ),
  };
}

function request(phoneNumber: string, idempotencyKey = "send-1") {
  return { phoneNumber, consentAccepted: true, deviceId: "device-1", idempotencyKey };
}

function verify(challengeId: string, idempotencyKey = "verify-1", code = "246810") {
  return { challengeId, code, deviceId: "device-1", idempotencyKey };
}
