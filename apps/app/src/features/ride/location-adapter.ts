import type { RidePlace } from "./ride-model";

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
