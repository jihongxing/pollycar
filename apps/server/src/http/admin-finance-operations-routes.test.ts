import { afterEach, describe, expect, it } from "vitest";
import { startInternalSandboxHttpServer, type InternalSandboxHttpServer } from "./internal-sandbox-server.js";

const servers: InternalSandboxHttpServer[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("阶段四资金运营 HTTP", () => {
  it("门禁关闭时拒绝资金查询", async () => {
    const server = await start();
    const response = await fetch(`${server.url}/v1/internal-sandbox/admin/finance-operations/operations-center`, {
      headers: auth("synthetic-finance-officer-001"),
    });
    expect(response.status).toBe(403);
    expect(await code(response)).toBe("FEATURE_DISABLED");
  });

  it("门禁开启后提供七个查询端点", async () => {
    const server = await start(true);
    const paths = [
      "operations-center",
      "allocation-settlements/settlement-synthetic-184",
      "driver-payouts/payout-synthetic-0714",
      "refund-reversals/finance-case-synthetic-071",
      "reconciliation-runs/reconciliation-synthetic-0714",
      "business-days/2026-07-13",
      "ledger-transactions/ledger-transaction-synthetic-19341",
    ];
    for (const path of paths) {
      const response = await fetch(`${server.url}/v1/internal-sandbox/admin/finance-operations/${path}`, {
        headers: auth("synthetic-finance-officer-001"),
      });
      expect(response.status, path).toBe(200);
    }
  });

  it("唯一命令入口要求幂等键并返回原结果", async () => {
    const server = await start(true);
    const request = {
      method: "POST",
      headers: {
        ...auth("synthetic-finance-officer-001"),
        "Content-Type": "application/json",
        "Idempotency-Key": "finance-http-idempotency-001",
      },
      body: JSON.stringify({
        type: "prepare_operator_settlement",
        resourceId: "settlement-synthetic-184",
        resourceVersion: 1,
        reasonCode: "daily_settlement",
      }),
    };
    const first = await fetch(`${server.url}/v1/internal-sandbox/admin/finance-operations/commands`, request);
    const replay = await fetch(`${server.url}/v1/internal-sandbox/admin/finance-operations/commands`, request);
    expect(first.status).toBe(200);
    expect(await replay.json()).toEqual(await first.json());
  });

  it("运营主体不能读取其他主体清算", async () => {
    const server = await start(true);
    const response = await fetch(
      `${server.url}/v1/internal-sandbox/admin/finance-operations/allocation-settlements/settlement-synthetic-blocked`,
      { headers: auth("synthetic-operator-finance-officer-001") },
    );
    expect(response.status).toBe(403);
    expect(await code(response)).toBe("ADMIN_FINANCE_SCOPE_FORBIDDEN");
  });
});

async function start(finance = false) {
  const server = await startInternalSandboxHttpServer({
    port: 0,
    featureGates: {
      syntheticAdminMultiOrganization: true,
      syntheticAdminFinanceOperations: finance,
      syntheticFinancialLedger: finance,
      syntheticFinancialReconciliation: finance,
      syntheticOperatorFunds: finance,
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
