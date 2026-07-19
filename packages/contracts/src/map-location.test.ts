import { describe, expect, it } from "vitest";
import { defaultFeatureGates, resolveFeatureGates } from "./feature-gates.js";
import type { GeoPoint, MapPlace, PlannedRoute } from "./map-location.js";

describe("地图与位置公开契约", () => {
  it("坐标、地点和路线显式携带坐标系与供应商", () => {
    const location: GeoPoint = {
      latitude: 31.2304,
      longitude: 121.4737,
      coordinateSystem: "gcj02",
    };
    const place: MapPlace = {
      placeId: "synthetic-place",
      name: "人民广场",
      formattedAddress: "上海市黄浦区人民广场",
      location,
      kind: "poi",
      source: "provider",
      provider: "synthetic",
    };
    const route: PlannedRoute = {
      routeId: "synthetic-route",
      origin: location,
      destination: { ...location, latitude: 31.2404 },
      distanceMeters: 1800,
      durationSeconds: 600,
      encodedPolyline: "synthetic",
      generatedAt: "2026-07-13T00:00:00.000Z",
      expiresAt: "2026-07-13T00:01:00.000Z",
      provider: "synthetic",
      includesLiveTraffic: false,
    };
    expect(place.location.coordinateSystem).toBe("gcj02");
    expect(route.provider).toBe("synthetic");
  });

  it("真实高德能力不能绕过生产和真实数据门禁单独开启", () => {
    const gates = resolveFeatureGates({
      ...defaultFeatureGates,
      realMap: true,
      externalMapProvider: true,
      realDeviceLocation: true,
      backgroundLocation: true,
      realVehicleLocationStream: true,
      amapSdk: true,
      amapWebService: true,
    });
    expect(gates).toMatchObject({
      realMap: false,
      externalMapProvider: false,
      realDeviceLocation: false,
      backgroundLocation: false,
      realVehicleLocationStream: false,
      amapSdk: false,
      amapWebService: false,
    });
  });
});
