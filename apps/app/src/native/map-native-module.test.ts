import { describe, expect, it } from "vitest";
import { DisabledNativeMapModule } from "./map-native-module";

describe("Expo Development Build 地图原生壳", () => {
  it("默认关闭真实 SDK、设备定位和后台定位", async () => {
    const module = new DisabledNativeMapModule();
    expect(module.gates.amapSdkEnabled).toBe(false);
    await expect(
      module.initializePrivacy({
        noticeContainsAmapPolicy: true,
        noticeShown: true,
        consentGranted: true,
      }),
    ).resolves.toBeUndefined();
    await expect(module.readDeviceLocation()).rejects.toThrow("REAL_DEVICE_LOCATION_DISABLED");
    await expect(module.setBackgroundLocationEnabled(true)).rejects.toThrow("BACKGROUND_LOCATION_DISABLED");
  });
});
