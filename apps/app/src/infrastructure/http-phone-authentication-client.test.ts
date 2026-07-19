import { describe, expect, it, vi } from "vitest";
import { HttpPhoneAuthenticationClient } from "./http-phone-authentication-client";

describe("HttpPhoneAuthenticationClient", () => {
  it("请求验证码并提交稳定载荷", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      challengeId: "challenge-1",
      maskedPhoneNumber: "188****0007",
      state: "pending",
      expiresAt: "2026-07-13T00:05:00.000Z",
      resendAvailableAt: "2026-07-13T00:01:00.000Z",
      attemptsRemaining: 5,
      synthetic: true,
    }), { status: 201 }));
    const client = new HttpPhoneAuthenticationClient("http://127.0.0.1:4311", fetcher as typeof fetch);
    await expect(client.requestCode({
      phoneNumber: "18800000007",
      consentAccepted: true,
      deviceId: "device-1",
      idempotencyKey: "send-1",
    })).resolves.toMatchObject({ challengeId: "challenge-1" });
    expect(fetcher).toHaveBeenCalledWith(
      "http://127.0.0.1:4311/v1/auth/phone/code",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("映射离线和机器错误码", async () => {
    const offline = new HttpPhoneAuthenticationClient("http://127.0.0.1:4311", vi.fn(async () => {
      throw new TypeError("offline");
    }) as typeof fetch);
    await expect(offline.requestCode({
      phoneNumber: "18800000007",
      consentAccepted: true,
      deviceId: "device-1",
      idempotencyKey: "send-1",
    })).rejects.toThrow("SERVICE_UNAVAILABLE");

    const rejected = new HttpPhoneAuthenticationClient("http://127.0.0.1:4311", vi.fn(async () =>
      new Response(JSON.stringify({ error: { code: "PHONE_CODE_RATE_LIMITED" } }), { status: 429 })) as typeof fetch);
    await expect(rejected.requestCode({
      phoneNumber: "18800000007",
      consentAccepted: true,
      deviceId: "device-1",
      idempotencyKey: "send-2",
    })).rejects.toThrow("PHONE_CODE_RATE_LIMITED");
  });
});
