import { describe, expect, it, vi } from "vitest";
import { HttpMapLocationClient } from "./http-map-location-client";

describe("HttpMapLocationClient", () => {
  it("使用公开地图路径并携带会话与幂等键", async () => {
    const fetcher = vi.fn(async (_url: string, init?: RequestInit) =>
      new Response(JSON.stringify({
        routeId: "route-1",
        origin: { latitude: 31.2, longitude: 121.4, coordinateSystem: "gcj02" },
        destination: { latitude: 31.3, longitude: 121.5, coordinateSystem: "gcj02" },
        distanceMeters: 1000,
        durationSeconds: 600,
        encodedPolyline: "path",
        generatedAt: new Date(0).toISOString(),
        expiresAt: new Date(60_000).toISOString(),
        provider: "synthetic",
        includesLiveTraffic: false,
      }), { status: 200 }),
    );
    const client = new HttpMapLocationClient("http://internal", fetcher as typeof fetch);
    await client.planDrivingRoute({
      origin: { latitude: 31.2, longitude: 121.4, coordinateSystem: "gcj02" },
      destination: { latitude: 31.3, longitude: 121.5, coordinateSystem: "gcj02" },
      strategy: "fastest",
      includeTraffic: false,
    });
    expect(fetcher).toHaveBeenCalledWith(
      "http://internal/v1/internal-sandbox/app/map/routes/driving",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: expect.any(String), "Idempotency-Key": expect.any(String) }),
      }),
    );
  });

  it("地点搜索会携带当前地点作为高德服务偏置", async () => {
    const fetcher = vi.fn(async () =>
      new Response(JSON.stringify({ places: [], cache: {}, provider: "synthetic" }), { status: 200 }),
    );
    const client = new HttpMapLocationClient("http://internal", fetcher as typeof fetch);

    await client.searchPlaces("虹桥", {
      cityCode: "021",
      biasLocation: { latitude: 31.2304, longitude: 121.4737, coordinateSystem: "gcj02" },
    });

    expect(fetcher).toHaveBeenCalledWith(
      "http://internal/v1/internal-sandbox/app/map/places/search?query=%E8%99%B9%E6%A1%A5&limit=10&city_code=021&bias_latitude=31.2304&bias_longitude=121.4737&bias_coordinate_system=gcj02",
      expect.any(Object),
    );
  });
});
