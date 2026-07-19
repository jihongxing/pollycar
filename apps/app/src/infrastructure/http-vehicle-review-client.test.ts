import { authorizationHeader } from "./session-credentials";
import { describe, expect, it, vi } from "vitest";
import { HttpVehicleReviewClient } from "./http-vehicle-review-client";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("HttpVehicleReviewClient", () => {
  it("通过用户沙箱接口保存草稿并提交审核", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ applicationId: "vehicle-application-7", version: 1, synthetic: true }))
      .mockResolvedValueOnce(jsonResponse({ applicationId: "vehicle-application-7", status: "under_review", version: 2, synthetic: true }));
    const client = new HttpVehicleReviewClient("http://127.0.0.1:4311", fetcher);
    await client.saveDraft({
      accountId: "client-value-must-not-be-sent",
      applicationId: "vehicle-application-7",
      vehicleType: "synthetic-sedan-a",
      maxPassengerCount: 2,
      insuranceExpiresOn: "2027-08-31",
      syntheticAttachmentId: "synthetic-insurance-a",
      expectedVersion: 0,
      idempotencyKey: "draft-vehicle-7",
    });
    expect(fetcher).toHaveBeenLastCalledWith(
      "http://127.0.0.1:4311/v1/internal-sandbox/app/vehicle-reviews/vehicle-application-7/draft",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: authorizationHeader(),
          "Idempotency-Key": "draft-vehicle-7",
        }),
      }),
    );
    expect(fetcher.mock.calls[0]?.[1]?.body).not.toContain("client-value-must-not-be-sent");
    await client.submit({
      accountId: "client-value-must-not-be-sent",
      applicationId: "vehicle-application-7",
      expectedVersion: 1,
      idempotencyKey: "submit-vehicle-7",
    });
    expect(fetcher).toHaveBeenLastCalledWith(
      "http://127.0.0.1:4311/v1/internal-sandbox/app/vehicle-reviews/vehicle-application-7/submit",
      expect.objectContaining({ body: JSON.stringify({ expectedVersion: 1 }) }),
    );
  });

  it("写入断网返回未知结果，读取断网返回服务不可用", async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("network"));
    const client = new HttpVehicleReviewClient("http://127.0.0.1:4311", fetcher);
    await expect(
      client.submit({
        accountId: "synthetic-account-7",
        applicationId: "vehicle-application-7",
        expectedVersion: 1,
        idempotencyKey: "submit-offline",
      }),
    ).rejects.toThrow("UNKNOWN_RESULT");
    await expect(
      client.get("vehicle-application-7", "synthetic-account-7"),
    ).rejects.toThrow("SERVICE_UNAVAILABLE");
  });
});

