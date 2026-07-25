import { describe, expect, it, vi } from "vitest";
import { SyntheticMapProvider } from "../adapters/synthetic-map-provider.js";
import { MapLocationService, MemoryMapQuotaUsage } from "./map-location-service.js";

const point = { latitude: 31.2304, longitude: 121.4737, coordinateSystem: "gcj02" as const };

describe("地图与位置应用服务", () => {
  it("搜索结果可缓存且不重复消耗供应商额度", async () => {
    const quota = new MemoryMapQuotaUsage();
    const service = new MapLocationService(new SyntheticMapProvider(), quota);
    const request = { query: "虹桥", limit: 10 };
    expect((await service.search("account-1", request)).cache.hit).toBe(false);
    expect((await service.search("account-1", request)).cache.hit).toBe(true);
    expect(quota.read("search")).toBe(1);
  });

  it("拒绝缺失坐标系、越界和过高精度", async () => {
    const service = new MapLocationService(new SyntheticMapProvider(), new MemoryMapQuotaUsage());
    await expect(service.reverseGeocode({
      location: { latitude: 31.1234567, longitude: 121.4, coordinateSystem: "gcj02" },
      radiusMeters: 50,
    })).rejects.toThrow("MAP_COORDINATE_PRECISION_EXCEEDED");
    await expect(service.planRoute({
      origin: { ...point, latitude: 91 },
      destination: point,
      strategy: "fastest",
      includeTraffic: false,
    })).rejects.toThrow("MAP_COORDINATE_INVALID");
  });

  it("合成逆地理编码保留地图准星选中的坐标", async () => {
    const provider = new SyntheticMapProvider();
    const selected = {
      latitude: 31.2308,
      longitude: 121.4741,
      coordinateSystem: "gcj02" as const,
    };
    await expect(provider.reverseGeocode({ location: selected, radiusMeters: 50 })).resolves.toMatchObject({
      name: "人民广场",
      location: selected,
    });
  });

  it("限制每个账户每分钟最多十次搜索", async () => {
    const service = new MapLocationService(new SyntheticMapProvider(), new MemoryMapQuotaUsage());
    for (let index = 0; index < 10; index += 1) {
      await service.search("account-1", { query: `地点${index}`, limit: 10 });
    }
    await expect(service.search("account-1", { query: "额外地点", limit: 10 }))
      .rejects.toThrow("MAP_SEARCH_RATE_LIMITED");
  });

  it("供应商超时统一映射并支持额度降级", async () => {
    const quota = new MemoryMapQuotaUsage();
    for (let index = 0; index < 95; index += 1) quota.increment("search");
    const service = new MapLocationService(
      {
        searchPlaces: () => new Promise(() => undefined),
        reverseGeocode: () => new Promise(() => undefined),
        planDrivingRoute: () => new Promise(() => undefined),
      },
      quota,
      () => new Date(0),
      5,
      { search: 100, reverse_geocode: 100, route: 100 },
    );
    await expect(service.search("account-1", { query: "虹桥", limit: 10 }))
      .rejects.toThrow("MAP_QUOTA_DEGRADED");
    const timeoutService = new MapLocationService(
      {
        searchPlaces: () => new Promise(() => undefined),
        reverseGeocode: () => new Promise(() => undefined),
        planDrivingRoute: () => new Promise(() => undefined),
      },
      new MemoryMapQuotaUsage(),
      () => new Date(0),
      5,
    );
    await expect(timeoutService.search("account-1", { query: "虹桥", limit: 10 }))
      .rejects.toThrow("MAP_PROVIDER_TIMEOUT");
  });

  it("并发相同查询合并为一次供应商调用并暴露额度分级", async () => {
    let resolveSearch!: (value: Awaited<ReturnType<SyntheticMapProvider["searchPlaces"]>>) => void;
    const searchPlaces = vi.fn(() => new Promise<Awaited<ReturnType<SyntheticMapProvider["searchPlaces"]>>>(
      (resolve) => { resolveSearch = resolve; },
    ));
    const quota = new MemoryMapQuotaUsage();
    const provider = new SyntheticMapProvider(() => new Date(0));
    const service = new MapLocationService(
      { searchPlaces, reverseGeocode: provider.reverseGeocode.bind(provider), planDrivingRoute: provider.planDrivingRoute.bind(provider) },
      quota,
      () => new Date(0),
      1_000,
      { search: 10, reverse_geocode: 10, route: 10 },
    );
    const first = service.search("account-1", { query: "虹桥", limit: 10 });
    const second = service.search("account-2", { query: "虹桥", limit: 10 });
    resolveSearch(await provider.searchPlaces({ query: "虹桥", limit: 10 }));
    await Promise.all([first, second]);
    expect(searchPlaces).toHaveBeenCalledTimes(1);
    for (let index = 1; index < 7; index += 1) quota.increment("search");
    expect(service.quotaState("search")).toBe("warning");
    quota.increment("search");
    quota.increment("search");
    expect(service.quotaState("search")).toBe("restricted");
    quota.increment("search");
    expect(service.quotaState("search")).toBe("degraded");
  });
});
