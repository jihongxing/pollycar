import { describe, expect, it, vi } from "vitest";
import { AmapWebServiceProvider } from "./amap-web-service-provider.js";

describe("AmapWebServiceProvider", () => {
  const disabledConfig = {
    enabled: false,
    apiBaseUrl: "https://restapi.amap.com",
  } as const;
  const enabledConfig = {
    enabled: true,
    apiBaseUrl: "https://restapi.amap.com",
    keyReference: "vault://pollycar/amap-web-service",
  } as const;

  it("默认关闭时不读取密钥也不发送网络请求", async () => {
    const read = vi.fn(async () => "secret");
    const fetcher = vi.fn();
    const provider = new AmapWebServiceProvider(
      disabledConfig,
      { read },
      fetcher as typeof fetch,
    );
    await expect(provider.searchPlaces({ query: "虹桥", limit: 10 }))
      .rejects.toThrow("AMAP_WEB_SERVICE_DISABLED");
    expect(read).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("启用时只从 Server 密钥提供器读取 Key", async () => {
    const read = vi.fn(async () => undefined);
    const provider = new AmapWebServiceProvider(
      enabledConfig,
      { read },
      vi.fn() as unknown as typeof fetch,
    );
    await expect(provider.searchPlaces({ query: "虹桥", limit: 10 }))
      .rejects.toThrow("AMAP_WEB_SERVICE_KEY_MISSING");
    expect(read).toHaveBeenCalledWith(
      "vault://pollycar/amap-web-service",
    );
  });

  it("解析地点搜索响应并只返回高德坐标", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      status: "1",
      infocode: "10000",
      pois: [
        {
          id: "B0FFH2KQ2P",
          name: "滁州站",
          address: "安徽省滁州市琅琊区",
          location: "118.316264,32.303627",
          citycode: "0550",
          adname: "琅琊区",
          entr_location: "118.316100,32.303500",
        },
      ],
    }), { status: 200 }));
    const provider = new AmapWebServiceProvider(
      enabledConfig,
      { read: async () => "server-secret" },
      fetcher as typeof fetch,
      () => new Date("2026-07-17T00:00:00.000Z"),
    );

    await expect(provider.searchPlaces({
      query: "滁州站",
      cityCode: "0550",
      limit: 10,
    })).resolves.toEqual({
      places: [{
        placeId: "amap:B0FFH2KQ2P",
        providerPlaceId: "B0FFH2KQ2P",
        name: "滁州站",
        formattedAddress: "安徽省滁州市琅琊区",
        cityCode: "0550",
        district: "琅琊区",
        location: {
          latitude: 32.303627,
          longitude: 118.316264,
          coordinateSystem: "gcj02",
        },
        entranceLocation: {
          latitude: 32.3035,
          longitude: 118.3161,
          coordinateSystem: "gcj02",
        },
        kind: "poi",
        source: "provider",
        provider: "amap",
      }],
      provider: "amap",
      cache: {
        hit: false,
        keyScope: "query",
        expiresAt: "2026-07-17T00:05:00.000Z",
      },
    });
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining("restapi.amap.com/v5/place/text"));
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining("region=0550"));
  });

  it("解析逆地理编码和驾车路线响应", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        status: "1",
        infocode: "10000",
        regeocode: {
          formatted_address: "安徽省滁州市琅琊区琅琊街道",
          addressComponent: {
            citycode: "0550",
            district: "琅琊区",
          },
          pois: [{
            id: "B0TEST",
            name: "滁州站",
            location: "118.316264,32.303627",
          }],
        },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        status: "1",
        infocode: "10000",
        route: {
          paths: [{
            distance: "8600",
            cost: { duration: "1320" },
            steps: [
              { polyline: "118.316264,32.303627;118.320000,32.310000" },
              { polyline: "118.320000,32.310000;118.339000,32.321000" },
            ],
          }],
        },
      }), { status: 200 }));
    const provider = new AmapWebServiceProvider(
      enabledConfig,
      { read: async () => "server-secret" },
      fetcher as typeof fetch,
      () => new Date("2026-07-17T00:00:00.000Z"),
    );
    const origin = {
      latitude: 32.303627,
      longitude: 118.316264,
      coordinateSystem: "gcj02" as const,
    };
    const destination = {
      latitude: 32.321,
      longitude: 118.339,
      coordinateSystem: "gcj02" as const,
    };

    await expect(provider.reverseGeocode({ location: origin, radiusMeters: 50 }))
      .resolves.toMatchObject({
        placeId: "amap:B0TEST",
        providerPlaceId: "B0TEST",
        name: "滁州站",
        formattedAddress: "安徽省滁州市琅琊区琅琊街道",
        provider: "amap",
      });
    await expect(provider.planDrivingRoute({
      origin,
      destination,
      strategy: "fastest",
      includeTraffic: true,
    })).resolves.toEqual({
      routeId: expect.stringMatching(/^amap-route-/),
      origin,
      destination,
      distanceMeters: 8600,
      durationSeconds: 1320,
      trafficDurationSeconds: 1320,
      encodedPolyline: "118.316264,32.303627;118.320000,32.310000;118.339000,32.321000",
      generatedAt: "2026-07-17T00:00:00.000Z",
      expiresAt: "2026-07-17T00:01:00.000Z",
      provider: "amap",
      includesLiveTraffic: true,
    });
  });

  it("供应商业务失败或响应结构未知时失败关闭", async () => {
    const failed = new AmapWebServiceProvider(
      enabledConfig,
      { read: async () => "server-secret" },
      vi.fn(async () => new Response(JSON.stringify({
        status: "0",
        infocode: "10003",
      }), { status: 200 })) as unknown as typeof fetch,
    );
    await expect(failed.searchPlaces({ query: "滁州", limit: 10 }))
      .rejects.toThrow("MAP_PROVIDER_UNAVAILABLE");

    const unsupported = new AmapWebServiceProvider(
      enabledConfig,
      { read: async () => "server-secret" },
      vi.fn(async () => new Response(JSON.stringify({
        status: "1",
        infocode: "10000",
        pois: [{ id: "missing-location", name: "无坐标地点" }],
      }), { status: 200 })) as unknown as typeof fetch,
    );
    await expect(unsupported.searchPlaces({ query: "无坐标", limit: 10 }))
      .rejects.toThrow("AMAP_RESPONSE_UNSUPPORTED");
  });
});
