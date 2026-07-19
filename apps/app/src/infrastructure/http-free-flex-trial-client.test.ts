import { authorizationHeader } from "./session-credentials";
import { describe, expect, it, vi } from "vitest";
import { HttpFreeFlexTrialClient } from "./http-free-flex-trial-client";

describe("免费弹性资格 HTTP 客户端", () => {
  it("只发送版本，不发送账户或付费字段", async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
      new Response(JSON.stringify(view), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const client = new HttpFreeFlexTrialClient("http://127.0.0.1:4311", fetcher as typeof fetch);

    await client.submit(0, "free-submit-app");

    const request = fetcher.mock.calls[0]![1]!;
    expect(JSON.parse(request.body as string)).toEqual({ expectedVersion: 0 });
    expect(request.headers).toMatchObject({
      Authorization: authorizationHeader(),
      "Idempotency-Key": "free-submit-app",
    });
  });
});

const view = {
  eligibilityId: "free-flex-synthetic-account-7",
  accountId: "synthetic-account-7",
  batchId: "batch_0",
  state: "under_review",
  version: 1,
  qualificationFeeMinor: 0,
  paidPathEnabled: false,
  realInvitation: false,
  activationDaysInLookback: 0,
  maximumActivationDays: 60,
  quota: { hours24: 4, days7: 12, days30: 18 },
  synthetic: true,
};

