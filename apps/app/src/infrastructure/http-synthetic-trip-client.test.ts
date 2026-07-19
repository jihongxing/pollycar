import { authorizationHeader } from "./session-credentials";
import { describe, expect, it, vi } from "vitest";
import { HttpSyntheticTripClient } from "./http-synthetic-trip-client";

describe("合成行程 HTTP 客户端", () => {
  it("零金额支付操作只发送版本并保持合成身份", async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
      new Response(JSON.stringify(trip), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const client = new HttpSyntheticTripClient("http://127.0.0.1:4311", fetcher as typeof fetch);

    await client.pay("synthetic-trip-1", 1);

    const request = fetcher.mock.calls[0]![1]!;
    expect(JSON.parse(request.body as string)).toEqual({ expectedVersion: 1 });
    expect(request.headers).toMatchObject({
      Authorization: authorizationHeader(),
      "Content-Type": "application/json",
    });
  });

  it("创建操作生成合成行程标识", async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
      new Response(JSON.stringify(trip), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const client = new HttpSyntheticTripClient("http://127.0.0.1:4311", fetcher as typeof fetch);

    await client.create("合成起点", "合成终点", 2, "commute");

    const body = JSON.parse(fetcher.mock.calls[0]![1]!.body as string);
    expect(body).toMatchObject({
      originLabel: "合成起点",
      destinationLabel: "合成终点",
    });
    expect(body.tripId).toMatch(/^synthetic-trip-/);
  });

  it("取消与超时恢复使用独立幂等动作", async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
      new Response(JSON.stringify(trip), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const client = new HttpSyntheticTripClient("http://127.0.0.1:4311", fetcher as typeof fetch);

    await client.cancel("synthetic-trip-1", 2);
    await client.reconcileTimeout("synthetic-trip-1", 3);

    expect(fetcher.mock.calls[0]![0]).toBe(
      "http://127.0.0.1:4311/v1/internal-sandbox/app/synthetic-trips/synthetic-trip-1/cancel",
    );
    expect(fetcher.mock.calls[1]![0]).toBe(
      "http://127.0.0.1:4311/v1/internal-sandbox/app/synthetic-trips/synthetic-trip-1/reconcile-timeout",
    );
  });

  it("修改预约会提交完整行程修订和独立幂等键", async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
      new Response(JSON.stringify(trip), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const client = new HttpSyntheticTripClient("http://127.0.0.1:4311", fetcher as typeof fetch);
    await client.reschedule("synthetic-trip-1", 2, {
      originLabel: "静安寺",
      destinationLabel: "浦东机场",
      passengerCount: 3,
      scene: "airport",
      timing: {
        mode: "scheduled",
        timezone: "Asia/Shanghai",
        selectionSource: "calendar_slot",
        requestedPickupStartsAt: "2026-07-11T14:00:00.000Z",
        requestedPickupEndsAt: "2026-07-11T14:10:00.000Z",
      },
      estimatedDurationMinutes: 70,
    });

    expect(fetcher.mock.calls[0]![0]).toBe(
      "http://127.0.0.1:4311/v1/internal-sandbox/app/synthetic-trips/synthetic-trip-1/reschedule",
    );
    expect(JSON.parse(fetcher.mock.calls[0]![1]!.body as string)).toMatchObject({
      expectedVersion: 2,
      originLabel: "静安寺",
      destinationLabel: "浦东机场",
      passengerCount: 3,
      scene: "airport",
      estimatedDurationMinutes: 70,
    });
  });

  it("带接单邀请时通过邀请端点原子接单", async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
      new Response(JSON.stringify(trip), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const client = new HttpSyntheticTripClient("http://127.0.0.1:4311", fetcher as typeof fetch);

    await client.accept("synthetic-trip-1", 2, "offer-synthetic-trip-1-driver");

    expect(fetcher.mock.calls[0]![0]).toBe(
      "http://127.0.0.1:4311/v1/internal-sandbox/app/driver/offers/offer-synthetic-trip-1-driver/accept",
    );
    expect(JSON.parse(fetcher.mock.calls[0]![1]!.body as string)).toEqual({
      expectedTripVersion: 2,
    });
  });
});

const trip = {
  tripId: "synthetic-trip-1",
  passengerAccountId: "synthetic-account-7",
  state: "paid_pending_match",
  version: 2,
  originLabel: "合成起点",
  destinationLabel: "合成终点",
  payment: { amountMinor: 0, currency: "CNY", realPayment: false, state: "paid_pending_match" },
  recovery: { state: "none" },
  createdAt: "2026-07-11T00:00:00.000Z",
  synthetic: true,
};

