import { describe, expect, it, vi } from "vitest";
import { HttpAdultEligibilityClient } from "./http-adult-eligibility-client";

describe("成年资格验证 HTTP 客户端", () => {
  it("读取服务端权威验证状态", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      accountId: "synthetic-account-7",
      state: "verified",
      version: 1,
      requiredDocumentSides: ["front", "back"],
      uploadedDocuments: [],
      checks: {
        document: { status: "passed" },
        age: { status: "passed" },
        liveness: { status: "passed" },
        faceMatch: { status: "passed" },
      },
      recoveryAction: "none",
      businessAccessAllowed: true,
      realIdentityDataEnabled: false,
      realBiometricDataEnabled: false,
      externalIdentityProviderEnabled: false,
      consent: {
        identityProcessingAuthorized: true,
        biometricProcessingAuthorized: true,
        thirdPartyProcessingAuthorized: true,
      },
      synthetic: true,
    }), { status: 200 })) as unknown as typeof fetch;
    const client = new HttpAdultEligibilityClient("http://127.0.0.1:4310", fetcher);
    await expect(client.get()).resolves.toMatchObject({
      state: "verified",
      businessAccessAllowed: true,
    });
  });
});
