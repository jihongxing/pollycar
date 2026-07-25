import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { startInternalSandboxHttpServer, type InternalSandboxHttpServer } from "./internal-sandbox-server.js";

const servers: InternalSandboxHttpServer[] = [];
const stateDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
  for (const directory of stateDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("阶段五高层驾驶舱 HTTP", () => {
  it("门禁关闭时拒绝查询", async () => {
    const server = await start(false);
    const response = await fetch(`${server.url}/v1/internal-sandbox/admin/executive-dashboard/overview`, {
      headers: auth("synthetic-executive-sponsor-001"),
    });
    expect(response.status).toBe(403);
    expect(await code(response)).toBe("FEATURE_DISABLED");
  });

  it("门禁开启后提供八个查询端点", async () => {
    const server = await start(true);
    const paths = [
      "overview",
      "operations-health",
      "operator-health",
      "finance-safety",
      "safety-compliance",
      "decision-items",
      "metrics",
      "drilldowns/city/310000",
    ];
    for (const path of paths) {
      const response = await fetch(`${server.url}/v1/internal-sandbox/admin/executive-dashboard/${path}`, {
        headers: auth("synthetic-executive-sponsor-001"),
      });
      expect(response.status, path).toBe(200);
    }
  });

  it("追加式高层意见要求幂等键", async () => {
    const server = await start(true);
    const response = await fetch(`${server.url}/v1/internal-sandbox/admin/executive-dashboard/decision-opinions`, {
      method: "POST",
      headers: { ...auth("synthetic-executive-sponsor-001"), "Content-Type": "application/json" },
      body: JSON.stringify({
        decisionItemId: "decision-operator-haiwan",
        decisionCode: "continue_controlled_review",
        reasonCode: "governance_input",
        responsibleRole: "operations_lead",
        dueAt: "2026-07-20T10:00:00.000Z",
        resourceVersion: 1,
      }),
    });
    expect(response.status).toBe(400);
    expect(await code(response)).toBe("VALIDATION_FAILED");
  });

  it("运营主体跨主体钻取由服务端拒绝", async () => {
    const server = await start(true);
    const response = await fetch(`${server.url}/v1/internal-sandbox/admin/executive-dashboard/drilldowns/operator/operator-haiwan`, {
      headers: auth("synthetic-operator-executive-001"),
    });
    expect(response.status).toBe(403);
    expect(await code(response)).toBe("ADMIN_EXECUTIVE_SCOPE_FORBIDDEN");
  });
});

async function start(executive: boolean) {
  const executiveStateDir = mkdtempSync(
    join(tmpdir(), "pollycar-executive-http-"),
  );
  stateDirectories.push(executiveStateDir);
  const server = await startInternalSandboxHttpServer({
    port: 0,
    executiveStateDir,
    featureGates: {
      syntheticAdminMultiOrganization: true,
      syntheticAdminOperatorManagement: true,
      syntheticAdminTripOperations: true,
      syntheticAdminCaseManagement: true,
      syntheticAdminFinanceOperations: true,
      syntheticFinancialLedger: true,
      syntheticFinancialReconciliation: true,
      syntheticOperatorFunds: true,
      syntheticAdminExecutiveDashboard: executive,
    },
  });
  servers.push(server);
  return server;
}

function auth(identity: string): Record<string, string> {
  return {
    Authorization: `Sandbox ${identity}`,
    "X-Correlation-Id": `correlation-${identity}`,
    "X-Request-Id": `request-${identity}`,
  };
}

async function code(response: Response): Promise<string> {
  const payload = await response.json() as { error: { code: string } };
  return payload.error.code;
}
