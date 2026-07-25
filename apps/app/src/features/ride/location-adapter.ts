import type { RidePlace } from "./ride-model";

import { nativeMapModule } from "../../native/map-native-module";

export type LocationResolution =
  | Readonly<{ state: "resolved"; place: RidePlace }>
  | Readonly<{ state: "permission_denied" | "unavailable" | "timeout" | "offline" }>;

export interface LocationAdapter {
  resolveCurrentPlace(): Promise<LocationResolution>;
}

export class BrowserLocationAdapter implements LocationAdapter {
  public async resolveCurrentPlace(): Promise<LocationResolution> {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return { state: "offline" };
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return { state: "unavailable" };
    }
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) =>
          resolve({
            state: "resolved",
            place: {
              id: `device-${coords.latitude.toFixed(5)}-${coords.longitude.toFixed(5)}`,
              label: "设备当前位置",
              address: `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`,
              kind: "current",
              synthetic: false,
              location: {
                latitude: Number(coords.latitude.toFixed(6)),
                longitude: Number(coords.longitude.toFixed(6)),
                coordinateSystem: "wgs84",
              },
            },
          }),
        (error) =>
          resolve({
            state:
              error.code === error.PERMISSION_DENIED
                ? "permission_denied"
                : error.code === error.TIMEOUT
                  ? "timeout"
                  : "unavailable",
          }),
        { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
      );
    });
  }
}

export class DeviceLocationAdapter implements LocationAdapter {
  public async resolveCurrentPlace(): Promise<LocationResolution> {
    if (typeof document !== "undefined") {
      return new BrowserLocationAdapter().resolveCurrentPlace();
    }
    try {
      const location = await nativeMapModule.readDeviceLocation();
      return {
        state: "resolved",
        place: {
          id: `device-${location.latitude.toFixed(5)}-${location.longitude.toFixed(5)}`,
          label: "设备当前位置",
          address: `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`,
          kind: "current",
          synthetic: false,
          location,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("PERMISSION")) return { state: "permission_denied" };
      if (message.includes("TIMEOUT")) return { state: "timeout" };
      return { state: "unavailable" };
    }
  }
}
