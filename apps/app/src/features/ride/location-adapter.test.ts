import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-modules-core", () => ({
  requireOptionalNativeModule: () => null,
}));

import { BrowserLocationAdapter } from "./location-adapter";

afterEach(() => vi.unstubAllGlobals());

describe("设备位置适配器", () => {
  it("无权限时返回可恢复状态", async () => {
    vi.stubGlobal("navigator", {
      onLine: true,
      geolocation: {
        getCurrentPosition: (
          _success: PositionCallback,
          error: PositionErrorCallback,
        ) => error({ code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError),
      },
    });
    await expect(new BrowserLocationAdapter().resolveCurrentPlace()).resolves.toEqual({
      state: "permission_denied",
    });
  });

  it("成功定位后返回可供地点适配器消费的坐标地点", async () => {
    vi.stubGlobal("navigator", {
      onLine: true,
      geolocation: {
        getCurrentPosition: (success: PositionCallback) =>
          success({ coords: { latitude: 31.2304, longitude: 121.4737 } } as GeolocationPosition),
      },
    });
    await expect(new BrowserLocationAdapter().resolveCurrentPlace()).resolves.toMatchObject({
      state: "resolved",
      place: { label: "设备当前位置", synthetic: false },
    });
  });
});
