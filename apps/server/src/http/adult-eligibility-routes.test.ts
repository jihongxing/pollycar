import { afterEach, describe, expect, it } from "vitest";
import { startInternalSandboxHttpServer, type InternalSandboxHttpServer } from "./internal-sandbox-server.js";

let server: InternalSandboxHttpServer | undefined;
afterEach(async () => { await server?.close(); server = undefined; });

describe("成年资格验证 HTTP 闭环", () => {
  it("创建 SDK 会话并由签名回调自动写入结果", async () => {
    server = await startInternalSandboxHttpServer({ port: 0, now: () => new Date("2026-07-12T00:00:00.000Z") });
    let view = await write("/v1/internal-sandbox/app/adult-eligibility/authorization", {
      expectedVersion: 0,
      privacyNoticeVersion: "2026-07-13",
      identityProcessingAuthorized: true,
      biometricProcessingAuthorized: true,
      thirdPartyProcessingAuthorized: true,
    });
    const sessionResponse = await fetch(`${server.url}/v1/internal-sandbox/app/adult-eligibility/sdk-session`, {
      method: "POST",
      headers: {
        Authorization: "Sandbox synthetic-unverified-9",
        "Content-Type": "application/json",
        "Idempotency-Key": "sdk-session-http",
      },
      body: JSON.stringify({ expectedVersion: view.version, syntheticScenario: "passed" }),
    });
    expect(sessionResponse.status).toBe(200);
    const session = await sessionResponse.json() as { sessionId: string; sdkMode: string };
    expect(session.sdkMode).toBe("synthetic");

    const callbackBody = JSON.stringify({
      accountId: "synthetic-unverified-9",
      callbackId: "sdk-callback-http",
      sessionId: session.sessionId,
      requestId: "sdk-request-http",
      occurredAt: "2026-07-12T00:00:01.000Z",
      status: "completed",
    });
    const callbackResponse = await fetch(
      `${server.url}/v1/internal-sandbox/provider-callbacks/adult-eligibility`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Provider-Signature": "synthetic-valid-signature",
          "Idempotency-Key": "sdk-callback-http",
        },
        body: callbackBody,
      },
    );
    expect(callbackResponse.status).toBe(200);
    view = await callbackResponse.json();
    expect(view).toMatchObject({ state: "verified", businessAccessAllowed: true });
  });

  it("未验证账户不能访问业务 API，但可以完成验证专用流程", async () => {
    server = await startInternalSandboxHttpServer({ port: 0, now: () => new Date("2026-07-12T00:00:00.000Z") });
    const denied = await request("/v1/internal-sandbox/app/synthetic-trips/dashboard");
    expect(denied.status).toBe(403);
    expect((await denied.json()).error.code).toBe("ADULT_ELIGIBILITY_REQUIRED");

    let view = await write("/v1/internal-sandbox/app/adult-eligibility/authorization", {
      expectedVersion: 0,
      privacyNoticeVersion: "2026-07-12",
      identityProcessingAuthorized: true,
      biometricProcessingAuthorized: true,
      thirdPartyProcessingAuthorized: true,
    });
    for (const side of ["front", "back"]) {
      view = await write("/v1/internal-sandbox/app/adult-eligibility/documents", {
        expectedVersion: view.version,
        side,
        fileName: `synthetic-${side}.png`,
        mimeType: "image/png",
        syntheticDocument: true,
      });
    }
    view = await write("/v1/internal-sandbox/app/adult-eligibility/submission", {
      expectedVersion: view.version,
      syntheticFaceCapture: true,
    });
    expect(view.state).toBe("verified");
    expect(view.businessAccessAllowed).toBe(true);

    const traceResponse = await fetch(`${server!.url}/v1/internal-sandbox/admin/adult-eligibility/synthetic-unverified-9`, {
      headers: { Authorization: "Sandbox synthetic-reviewer-001" },
    });
    expect(traceResponse.status).toBe(200);
    const trace = await traceResponse.json();
    expect(trace.providerStatus).toBe("completed");
    expect((await request("/v1/internal-sandbox/app/synthetic-trips/dashboard")).status).toBe(200);
  });

  async function request(path: string) {
    return fetch(`${server!.url}${path}`, { headers: { Authorization: "Sandbox synthetic-unverified-9" } });
  }
  async function write(path: string, body: object) {
    const response = await fetch(`${server!.url}${path}`, {
      method: "POST",
      headers: {
        Authorization: "Sandbox synthetic-unverified-9",
        "Content-Type": "application/json",
        "Idempotency-Key": `test-${Math.random()}`,
      },
      body: JSON.stringify(body),
    });
    expect(response.status).toBe(200);
    return response.json();
  }
});
