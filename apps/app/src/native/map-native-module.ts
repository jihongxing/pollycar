import type { GeoPoint, MapCapabilityGates } from "@pollycar/contracts";
import { requireOptionalNativeModule } from "expo-modules-core";

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

type ExpoNativeMapModule = Readonly<{
  provider?: "synthetic" | "amap";
  gates?: MapCapabilityGates;
  initializePrivacy(state: NativeMapPrivacyState): Promise<void>;
  readDeviceLocation(): Promise<GeoPoint>;
  setBackgroundLocationEnabled(enabled: boolean): Promise<void>;
}>;

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

class ExpoMapModuleAdapter implements NativeMapModule {
  public readonly provider: "synthetic" | "amap";
  public readonly gates: MapCapabilityGates;

  public constructor(private readonly module: ExpoNativeMapModule) {
    this.provider = module.provider === "amap" ? "amap" : "synthetic";
    this.gates = module.gates ?? new DisabledNativeMapModule().gates;
  }

  public initializePrivacy(state: NativeMapPrivacyState): Promise<void> {
    return this.module.initializePrivacy(state);
  }

  public readDeviceLocation(): Promise<GeoPoint> {
    return this.module.readDeviceLocation();
  }

  public setBackgroundLocationEnabled(enabled: boolean): Promise<void> {
    return this.module.setBackgroundLocationEnabled(enabled);
  }
}

function resolveNativeMapModule(): NativeMapModule {
  const module = requireOptionalNativeModule<ExpoNativeMapModule>("PollyCarMap");
  return module ? new ExpoMapModuleAdapter(module) : new DisabledNativeMapModule();
}

export const nativeMapModule: NativeMapModule = resolveNativeMapModule();
