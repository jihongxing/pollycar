import { describe, expect, it } from "vitest";
import { SyntheticIdentityVerificationSdkAdapter } from "./identity-verification-sdk-adapter";

describe("身份核验 SDK 适配器", () => {
  it("只接受真实能力关闭的合成 SDK 会话", async () => {
    const adapter = new SyntheticIdentityVerificationSdkAdapter();
    await expect(adapter.launch({
      sessionId: "synthetic-session",
      providerId: "synthetic-adult-eligibility",
      clientToken: "synthetic-token",
      expiresAt: "2026-07-13T10:10:00.000Z",
      sdkMode: "synthetic",
      requestedChecks: ["identity_document", "adult_age", "liveness", "face_match"],
      realIdentityDataEnabled: false,
      realBiometricDataEnabled: false,
      externalIdentityProviderEnabled: false,
    })).resolves.toBeUndefined();
  });

  it("拒绝原生或真实供应商会话", async () => {
    const adapter = new SyntheticIdentityVerificationSdkAdapter();
    await expect(adapter.launch({
      sessionId: "real-session",
      providerId: "real-provider",
      clientToken: "real-token",
      expiresAt: "2026-07-13T10:10:00.000Z",
      sdkMode: "native",
      requestedChecks: ["identity_document", "adult_age", "liveness", "face_match"],
      realIdentityDataEnabled: true,
      realBiometricDataEnabled: true,
      externalIdentityProviderEnabled: true,
    })).rejects.toThrow("EXTERNAL_IDENTITY_PROVIDER_DISABLED");
  });
});
