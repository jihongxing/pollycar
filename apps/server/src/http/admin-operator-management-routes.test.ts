import { afterEach, describe, expect, it } from "vitest";
import { startInternalSandboxHttpServer } from "./internal-sandbox-server.js";

const headers = {
  Authorization: "Sandbox synthetic-platform-ops-001",
  "Content-Type": "application/json",
  "X-Correlation-Id": "stage-two-http-correlation",
  "X-Request-Id": "stage-two-http-request",
};

describe("运营控制台阶段二组织与运力 HTTP API", () => {
  let running:
    | Awaited<ReturnType<typeof startInternalSandboxHttpServer>>
    | undefined;

  afterEach(async () => {
    await running?.close();
    running = undefined;
  });

  it("只有阶段一和阶段二门禁同时开启时提供查询", async () => {
    running = await startInternalSandboxHttpServer({
      port: 0,
      featureGates: { syntheticAdminMultiOrganization: true },
    });
    const closed = await fetch(
      `${running.url}/v1/internal-sandbox/admin/operator-management/operators/operator-huhang`,
      { headers },
    );
    expect(closed.status).toBe(403);
    expect((await closed.json()).error.code).toBe("FEATURE_DISABLED");
    await running.close();

    running = await startInternalSandboxHttpServer({
      port: 0,
      featureGates: {
        syntheticAdminMultiOrganization: true,
        syntheticAdminOperatorManagement: true,
      },
    });
    const opened = await fetch(
      `${running.url}/v1/internal-sandbox/admin/operator-management/operators/operator-huhang`,
      { headers },
    );
    expect(opened.status).toBe(200);
    expect(await opened.json()).toMatchObject({
      operatorId: "operator-huhang",
      lifecycleState: "active",
    });
  });

  it("统一命令入口强制幂等键并返回原结果", async () => {
    running = await startInternalSandboxHttpServer({
      port: 0,
      featureGates: {
        syntheticAdminMultiOrganization: true,
        syntheticAdminOperatorManagement: true,
      },
    });
    const request = {
      method: "POST",
      headers: { ...headers, "Idempotency-Key": "stage-two-command-0001" },
      body: JSON.stringify({
        type: "request_onboarding_changes",
        onboardingCaseId: "onboarding-synthetic-021",
        reason: "补充夜间安全协作联系人",
        resourceVersion: 4,
      }),
    };
    const first = await fetch(
      `${running.url}/v1/internal-sandbox/admin/operator-management/commands`,
      request,
    );
    const second = await fetch(
      `${running.url}/v1/internal-sandbox/admin/operator-management/commands`,
      request,
    );
    expect(first.status).toBe(200);
    expect(await second.json()).toEqual(await first.json());
  });
});
