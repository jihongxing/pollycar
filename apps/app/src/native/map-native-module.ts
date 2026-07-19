import type { GeoPoint, MapCapabilityGates } from "@pollycar/contracts";

export type NativeMapCamera = Readonly<{
  center: GeoPoint;
  zoom: number;
}>;

export type NativeMapMarker = Readonly<{
  id: string;
  location: GeoPoint;
  kind: "origin" | "destination" | "vehicle" | "selected";
}>;

export type NativeMapPrivacyState = Readonly<{
  noticeContainsAmapPolicy: boolean;
  noticeShown: boolean;
  consentGranted: boolean;
}>;

export interface NativeMapModule {
  readonly provider: "synthetic" | "amap";
  readonly gates: MapCapabilityGates;
  initializePrivacy(state: NativeMapPrivacyState): Promise<void>;
  readDeviceLocation(): Promise<GeoPoint>;
  setBackgroundLocationEnabled(enabled: boolean): Promise<void>;
}

export class DisabledNativeMapModule implements NativeMapModule {
  public readonly provider = "synthetic" as const;
  public readonly gates: MapCapabilityGates = {
    realMapEnabled: false,
    externalMapProviderEnabled: false,
    realDeviceLocationEnabled: false,
    backgroundLocationEnabled: false,
    realVehicleLocationStreamEnabled: false,
    amapSdkEnabled: false,
    amapWebServiceEnabled: false,
  };

  public async initializePrivacy(_state: NativeMapPrivacyState): Promise<void> {}
  public async readDeviceLocation(): Promise<GeoPoint> {
    throw new Error("REAL_DEVICE_LOCATION_DISABLED");
  }
  public async setBackgroundLocationEnabled(enabled: boolean): Promise<void> {
    if (enabled) throw new Error("BACKGROUND_LOCATION_DISABLED");
  }
}

export const nativeMapModule: NativeMapModule = new DisabledNativeMapModule();
