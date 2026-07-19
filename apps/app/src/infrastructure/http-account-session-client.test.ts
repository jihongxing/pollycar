import { describe, expect, it, vi } from "vitest";
import { HttpAccountSessionClient } from "./http-account-session-client";
import { authorizationHeader, setSessionToken } from "./session-credentials";

describe("账户会话客户端", () => {
  it("创建会话后统一授权 Header 改为 Session", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      token: "synthetic-session-test",
      session: session("passenger"),
    }), { status: 201, headers: { "Content-Type": "application/json" } }));
    const client = new HttpAccountSessionClient("http://127.0.0.1:4310", fetcher as typeof fetch);
    await client.create();
    expect(authorizationHeader()).toBe("Session synthetic-session-test");
    setSessionToken(undefined);
  });

  it("身份切换发送会话令牌和幂等键", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(session("driver")), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    const client = new HttpAccountSessionClient("http://127.0.0.1:4310", fetcher as typeof fetch);
    await expect(client.switchIdentity("token-1", "driver")).resolves.toMatchObject({
      activeIdentity: "driver",
    });
    expect(fetcher.mock.calls[0]?.[1]?.headers).toMatchObject({
      Authorization: "Session token-1",
    });
  });
});

function session(activeIdentity: "passenger" | "driver") {
  return {
    sessionId: "session-1",
    accountId: "synthetic-account-7",
    activeIdentity,
    availableIdentities: ["passenger", "driver"],
    adultEligibilityState: "verified",
    businessAccessAllowed: true,
    issuedAt: "2026-07-13T00:00:00.000Z",
    expiresAt: "2026-07-13T00:30:00.000Z",
    state: "active",
    productionEnabled: false,
    synthetic: true,
  };
}
