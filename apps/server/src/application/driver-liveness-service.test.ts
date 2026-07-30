import { describe, expect, it } from "vitest";
import { MemoryAuditLog } from "../adapters/memory-audit.js";
import {
  MemoryRepository,
  MemoryTransaction,
} from "../adapters/memory-repository.js";
import { SyntheticDriverLivenessProvider } from "../adapters/synthetic-driver-liveness-provider.js";
import {
  DriverLivenessService,
  type DriverLivenessAuthorizationRecord,
  type DriverLivenessChallengeRecord,
} from "./driver-liveness-service.js";

function setup() {
  let clock = new Date("2026-07-30T01:00:00.000Z");
  const challenges = new MemoryRepository<DriverLivenessChallengeRecord>();
  const authorizations =
    new MemoryRepository<DriverLivenessAuthorizationRecord>();
  const audit = new MemoryAuditLog();
  const service = new DriverLivenessService(
    challenges,
    authorizations,
    new MemoryTransaction(),
    audit,
    new SyntheticDriverLivenessProvider(),
    () => clock,
    "driver-liveness-test-secret",
    () => ["turn_head_left", "open_mouth", "turn_head_right"],
  );
  return {
    service,
    challenges,
    authorizations,
    audit,
    advance(milliseconds: number) {
      clock = new Date(clock.getTime() + milliseconds);
    },
  };
}

const binding = {
  accountId: "synthetic-account-7",
  deviceId: "app-device-driver-7",
  accountSessionId: "session-driver-7",
};

describe("DriverLivenessService", () => {
  it("由服务端生成有序随机动作且不保存原始人脸材料", async () => {
    const context = setup();
    const challenge = await context.service.createChallenge(
      binding,
      "challenge-create-1",
    );

    expect(challenge.actions.map(({ actionId }) => actionId)).toEqual([
      "turn_head_left",
      "open_mouth",
      "turn_head_right",
    ]);
    expect(challenge.actions.map(({ sequence }) => sequence)).toEqual([1, 2, 3]);
    const stored = await context.challenges.get(challenge.challengeId);
    expect(JSON.stringify(stored?.value)).not.toMatch(
      /video|image|photo|template|providerToken/i,
    );
  });

  it("通过后签发五分钟有效且绑定设备与会话的一次性授权", async () => {
    const context = setup();
    const challenge = await context.service.createChallenge(
      binding,
      "challenge-create-2",
    );
    const result = await context.service.completeSynthetic(
      binding,
      challenge.challengeId,
      "passed",
      "challenge-complete-2",
    );

    expect(result.authorizationIssued).toBe(true);
    expect(result.livenessAuthorizationToken).toMatch(
      /^synthetic-liveness-auth\./,
    );
    await expect(
      context.service.consumeAuthorization(
        binding,
        result.livenessAuthorizationToken,
        "availability-online-2",
      ),
    ).resolves.toBeUndefined();
    await expect(
      context.service.consumeAuthorization(
        binding,
        result.livenessAuthorizationToken,
        "availability-online-replay-2",
      ),
    ).rejects.toThrow("DRIVER_LIVENESS_AUTHORIZATION_REPLAYED");
  });

  it("并发消费同一授权时最多一个上线请求成功", async () => {
    const context = setup();
    const challenge = await context.service.createChallenge(
      binding,
      "challenge-create-concurrent",
    );
    const result = await context.service.completeSynthetic(
      binding,
      challenge.challengeId,
      "passed",
      "challenge-complete-concurrent",
    );
    const attempts = await Promise.allSettled([
      context.service.consumeAuthorization(
        binding,
        result.livenessAuthorizationToken,
        "availability-concurrent-a",
      ),
      context.service.consumeAuthorization(
        binding,
        result.livenessAuthorizationToken,
        "availability-concurrent-b",
      ),
    ]);

    expect(
      attempts.filter(({ status }) => status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      attempts.filter(({ status }) => status === "rejected"),
    ).toHaveLength(1);
  });

  it("拒绝缺失、过期和设备或会话绑定不一致的授权", async () => {
    const context = setup();
    await expect(
      context.service.consumeAuthorization(
        binding,
        undefined,
        "availability-missing",
      ),
    ).rejects.toThrow("DRIVER_LIVENESS_REQUIRED");

    const challenge = await context.service.createChallenge(
      binding,
      "challenge-create-3",
    );
    const result = await context.service.completeSynthetic(
      binding,
      challenge.challengeId,
      "passed",
      "challenge-complete-3",
    );
    await expect(
      context.service.consumeAuthorization(
        { ...binding, deviceId: "app-device-other" },
        result.livenessAuthorizationToken,
        "availability-device-mismatch",
      ),
    ).rejects.toThrow("DRIVER_LIVENESS_AUTHORIZATION_MISMATCH");
    await expect(
      context.service.consumeAuthorization(
        { ...binding, accountSessionId: "session-other" },
        result.livenessAuthorizationToken,
        "availability-session-mismatch",
      ),
    ).rejects.toThrow("DRIVER_LIVENESS_AUTHORIZATION_MISMATCH");

    context.advance(5 * 60 * 1000 + 1);
    await expect(
      context.service.consumeAuthorization(
        binding,
        result.livenessAuthorizationToken,
        "availability-expired",
      ),
    ).rejects.toThrow("DRIVER_LIVENESS_AUTHORIZATION_EXPIRED");
  });

  it("未知结果、超时和供应商不可用均失败关闭", async () => {
    for (const [scenario, expectedError] of [
      ["result_unknown", "DRIVER_LIVENESS_RESULT_UNKNOWN"],
      ["provider_timeout", "DRIVER_LIVENESS_PROVIDER_TIMEOUT"],
      ["provider_unavailable", "DRIVER_LIVENESS_PROVIDER_UNAVAILABLE"],
    ] as const) {
      const context = setup();
      const challenge = await context.service.createChallenge(
        binding,
        `challenge-${scenario}`,
      );
      await expect(
        context.service.completeSynthetic(
          binding,
          challenge.challengeId,
          scenario,
          `complete-${scenario}`,
        ),
      ).rejects.toThrow(expectedError);
      expect(
        (await context.service.getChallenge(binding, challenge.challengeId))
          .state,
      ).not.toBe("passed");
    }
  });

  it("新挑战取消同一绑定下未完成的旧挑战", async () => {
    const context = setup();
    const first = await context.service.createChallenge(
      binding,
      "challenge-first",
    );
    const second = await context.service.createChallenge(
      binding,
      "challenge-second",
    );

    expect(
      (await context.service.getChallenge(binding, first.challengeId)).state,
    ).toBe("cancelled");
    expect(second.state).toBe("created");
  });
});
