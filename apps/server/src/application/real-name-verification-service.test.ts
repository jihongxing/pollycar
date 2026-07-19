import { describe, expect, it } from "vitest";
import { MemoryAuditLog } from "../adapters/memory-audit.js";
import { MemoryRepository } from "../adapters/memory-repository.js";
import {
  RealNameVerificationService,
  type RealNameVerificationRecord,
} from "./real-name-verification-service.js";

describe("成年资格验证服务", () => {
  it("创建供应商 SDK 会话并通过签名回调自动完成核验", async () => {
    const service = createService();
    const authorized = await service.authorize(
      {
        accountId: "sdk-account",
        expectedVersion: 0,
        privacyNoticeVersion: "2026-07-13",
        identityProcessingAuthorized: true,
        biometricProcessingAuthorized: true,
        thirdPartyProcessingAuthorized: true,
      },
      "sdk-authorize",
    );
    const session = await service.createSdkSession(
      {
        accountId: "sdk-account",
        expectedVersion: authorized.version,
        syntheticScenario: "passed",
      },
      "sdk-session-create",
    );
    expect(session).toMatchObject({
      providerId: "synthetic-adult-eligibility",
      sdkMode: "synthetic",
      externalIdentityProviderEnabled: false,
    });

    const rawBody = JSON.stringify({
      accountId: "sdk-account",
      callbackId: "sdk-callback-1",
      sessionId: session.sessionId,
      requestId: "sdk-provider-request-1",
      occurredAt: "2026-07-12T00:00:01.000Z",
      status: "completed",
    });
    const verified = await service.applyProviderCallback(
      "sdk-account",
      "synthetic-valid-signature",
      rawBody,
    );
    expect(verified).toMatchObject({
      state: "verified",
      businessAccessAllowed: true,
    });
    await expect(
      service.applyProviderCallback(
        "sdk-account",
        "synthetic-valid-signature",
        rawBody,
      ),
    ).resolves.toMatchObject({ version: verified.version });
  });

  it("拒绝无效签名和不属于账户的供应商回调", async () => {
    const service = createService();
    const authorized = await service.authorize(
      {
        accountId: "callback-account",
        expectedVersion: 0,
        privacyNoticeVersion: "2026-07-13",
        identityProcessingAuthorized: true,
        biometricProcessingAuthorized: true,
        thirdPartyProcessingAuthorized: true,
      },
      "callback-authorize",
    );
    const session = await service.createSdkSession(
      { accountId: "callback-account", expectedVersion: authorized.version },
      "callback-session",
    );
    const rawBody = JSON.stringify({
      accountId: "callback-account",
      callbackId: "callback-invalid",
      sessionId: session.sessionId,
      requestId: "provider-request-invalid",
      occurredAt: "2026-07-12T00:00:01.000Z",
      status: "completed",
    });
    await expect(
      service.applyProviderCallback("callback-account", "invalid", rawBody),
    ).rejects.toThrow("AUTHORIZATION_DENIED");
    await expect(
      service.applyProviderCallback(
        "callback-account",
        "synthetic-valid-signature",
        rawBody.replace(session.sessionId, "synthetic-session-other-passed"),
      ),
    ).rejects.toThrow("AUTHORIZATION_DENIED");
  });

  it("提交摄像头采集结果后由供应商自动完成核验并开放业务能力", async () => {
    const service = createService();
    const result = await prepareSubmission(service, "automatic-account", "passed");

    expect(result.state).toBe("verified");
    expect(result.businessAccessAllowed).toBe(true);
    expect(result.provider.status).toBe("completed");
    expect(result.provider.requestId).toContain("synthetic-provider-automatic-account");
    expect(result.allowedActions).toEqual([]);
  });

  it("供应商未知结果保持业务关闭且不进入人工批准队列", async () => {
    const service = createService();
    const authorized = await service.authorize({
      accountId: "unknown-provider-account",
      expectedVersion: 0,
      privacyNoticeVersion: "test",
      identityProcessingAuthorized: true,
      biometricProcessingAuthorized: true,
      thirdPartyProcessingAuthorized: true,
    }, "authorize-unknown-provider");
    const front = await service.saveDocument({
      accountId: authorized.accountId,
      expectedVersion: authorized.version,
      side: "front",
      fileName: "front.jpg",
      mimeType: "image/jpeg",
      syntheticDocument: true,
    }, "front-unknown-provider");
    const back = await service.saveDocument({
      accountId: front.accountId,
      expectedVersion: front.version,
      side: "back",
      fileName: "back.jpg",
      mimeType: "image/jpeg",
      syntheticDocument: true,
    }, "back-unknown-provider");
    const result = await service.submit({
      accountId: back.accountId,
      expectedVersion: back.version,
      syntheticFaceCapture: true,
      syntheticScenario: "result_unknown",
    }, "submit-unknown-provider");

    expect(result.state).toBe("needs_retry");
    expect(result.provider.status).toBe("unknown");
    expect(result.businessAccessAllowed).toBe(false);
    expect(result.allowedActions).toEqual(["refresh_provider_result", "submit_appeal"]);
  });

  it("仅在证件、成年、活体和人脸一致性全部通过后开放业务能力", async () => {
    const service = createService();
    const submitted = await prepareSubmission(service, "adult-account");
    const verified = await service.confirmSyntheticResult(
      {
        accountId: "adult-account",
        expectedVersion: submitted.version,
        legalName: "测试用户",
        documentNumber: "310101199007120011",
        birthDate: "1990-07-12",
        legalGender: "female",
        documentStatus: "passed",
        livenessStatus: "passed",
        faceMatchStatus: "passed",
        syntheticResult: true,
      },
      "result-pass",
    );

    expect(verified).toMatchObject({
      state: "verified",
      businessAccessAllowed: true,
      recoveryAction: "none",
      checks: {
        document: { status: "passed" },
        age: { status: "passed" },
        liveness: { status: "passed" },
        faceMatch: { status: "passed" },
      },
      result: {
        adultConfirmed: true,
        legalGender: "female",
      },
    });
  });

  it("未成年人即使其他检查通过也拒绝开放业务能力", async () => {
    const service = createService();
    const submitted = await prepareSubmission(service, "minor-account");
    const rejected = await service.confirmSyntheticResult(
      {
        accountId: "minor-account",
        expectedVersion: submitted.version,
        legalName: "测试用户",
        documentNumber: "310101201007130011",
        birthDate: "2010-07-13",
        legalGender: "male",
        documentStatus: "passed",
        livenessStatus: "passed",
        faceMatchStatus: "passed",
        syntheticResult: true,
      },
      "result-minor",
    );

    expect(rejected).toMatchObject({
      state: "rejected",
      failureCode: "underage",
      recoveryAction: "submit_appeal",
      businessAccessAllowed: false,
    });
  });

  it.each([
    ["livenessStatus", "livenessFailureCode", "liveness_failed"],
    ["faceMatchStatus", "faceMatchFailureCode", "face_mismatch"],
  ] as const)("检查失败进入可重试状态：%s", async (statusField, failureField, failureCode) => {
    const service = createService();
    const submitted = await prepareSubmission(service, `${failureCode}-account`);
    const request = {
      accountId: `${failureCode}-account`,
      expectedVersion: submitted.version,
      legalName: "测试用户",
      documentNumber: "310101199007120011",
      birthDate: "1990-07-12",
      legalGender: "female" as const,
      documentStatus: "passed" as const,
      livenessStatus: "passed" as const,
      faceMatchStatus: "passed" as const,
      syntheticResult: true as const,
      [statusField]: "failed",
      [failureField]: failureCode,
    };
    const failed = await service.confirmSyntheticResult(request, `result-${failureCode}`);

    expect(failed).toMatchObject({
      state: "needs_retry",
      failureCode,
      recoveryAction: "retry_verification",
      businessAccessAllowed: false,
    });
  });

  it("供应商未知结果保持关闭并允许重新开始", async () => {
    const service = createService();
    const submitted = await prepareSubmission(service, "unknown-account");
    const unknown = await service.confirmSyntheticResult(
      {
        accountId: "unknown-account",
        expectedVersion: submitted.version,
        legalName: "测试用户",
        documentNumber: "310101199007120011",
        birthDate: "1990-07-12",
        legalGender: "female",
        documentStatus: "unknown",
        documentFailureCode: "result_unknown",
        livenessStatus: "passed",
        faceMatchStatus: "passed",
        syntheticResult: true,
      },
      "result-unknown",
    );
    expect(unknown).toMatchObject({
      state: "needs_retry",
      failureCode: "result_unknown",
      businessAccessAllowed: false,
    });

    await expect(
      service.retry(
        { accountId: "unknown-account", expectedVersion: unknown.version },
        "retry-unknown",
      ),
    ).resolves.toMatchObject({
      state: "collecting",
      businessAccessAllowed: false,
    });
    expect("failureCode" in (await service.get("unknown-account"))).toBe(false);
  });

  it("缺少证件或尝试提交真实人脸数据时拒绝处理", async () => {
    const service = createService();
    const authorized = await service.authorize(
      {
        accountId: "incomplete-account",
        expectedVersion: 0,
        privacyNoticeVersion: "2026-07-12",
        identityProcessingAuthorized: true,
        biometricProcessingAuthorized: true,
        thirdPartyProcessingAuthorized: true,
      },
      "authorize-incomplete",
    );
    await expect(
      service.submit(
        {
          accountId: "incomplete-account",
          expectedVersion: authorized.version,
          syntheticFaceCapture: true,
        },
        "submit-incomplete",
      ),
    ).rejects.toThrow("ADULT_ELIGIBILITY_DOCUMENT_INCOMPLETE");

    await expect(
      service.submit(
        {
          accountId: "incomplete-account",
          expectedVersion: authorized.version,
          syntheticFaceCapture: false as true,
        },
        "submit-real-face",
      ),
    ).rejects.toThrow("REAL_BIOMETRIC_DATA_FORBIDDEN");
  });
});

async function prepareSubmission(
  service: RealNameVerificationService,
  accountId: string,
  syntheticScenario: "passed" | "provider_timeout" = "provider_timeout",
) {
  const authorized = await service.authorize(
    {
      accountId,
      expectedVersion: 0,
      privacyNoticeVersion: "2026-07-12",
      identityProcessingAuthorized: true,
      biometricProcessingAuthorized: true,
      thirdPartyProcessingAuthorized: true,
    },
    `${accountId}-authorize`,
  );
  const front = await service.saveDocument(
    {
      accountId,
      expectedVersion: authorized.version,
      side: "front",
      fileName: "synthetic-front.png",
      mimeType: "image/png",
      syntheticDocument: true,
    },
    `${accountId}-front`,
  );
  const back = await service.saveDocument(
    {
      accountId,
      expectedVersion: front.version,
      side: "back",
      fileName: "synthetic-back.png",
      mimeType: "image/png",
      syntheticDocument: true,
    },
    `${accountId}-back`,
  );
  return service.submit(
    {
      accountId,
      expectedVersion: back.version,
      syntheticFaceCapture: true,
      syntheticScenario,
    },
    `${accountId}-submit`,
  );
}

function createService() {
  return new RealNameVerificationService(
    new MemoryRepository<RealNameVerificationRecord>(),
    new MemoryAuditLog(),
    () => new Date("2026-07-12T00:00:00.000Z"),
  );
}
