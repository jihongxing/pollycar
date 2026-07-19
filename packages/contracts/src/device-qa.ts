export type DeviceQaPlatform = "android" | "ios";

export type DeviceQaNetworkProfile = "online" | "slow" | "offline";

export type DeviceQaAssistiveTechnology = "none" | "talkback" | "voiceover";

export type DeviceQaProfile = Readonly<{
  profileId: string;
  platform: DeviceQaPlatform;
  minimumOsVersion: string;
  fontScale: 1 | 1.3 | 2;
  assistiveTechnology: DeviceQaAssistiveTechnology;
  network: DeviceQaNetworkProfile;
  syntheticOnly: true;
}>;

export type DeviceQaJourney =
  | "first_time_user"
  | "passenger"
  | "owner"
  | "exception_recovery";

export type DeviceQaFlow = "core" | "vehicle" | "offline";

export type DeviceQaResultStatus = "passed" | "failed" | "blocked";

export type DeviceQaIssueSeverity = "P0" | "P1" | "P2" | "P3";

export type DeviceQaExecutionEnvironment =
  | "browser_mobile_viewport"
  | "android_emulator_web"
  | "android_emulator_native"
  | "physical_device"
  | "cloud_physical_device";

export type DeviceQaResult = Readonly<{
  runId: string;
  recordedAt: string;
  profileId: string;
  platform: DeviceQaPlatform;
  journey: DeviceQaJourney;
  flow: DeviceQaFlow;
  testerId: string;
  buildId: string;
  deviceName: string;
  osVersion: string;
  executionEnvironment: DeviceQaExecutionEnvironment;
  status: DeviceQaResultStatus;
  issueSeverity?: DeviceQaIssueSeverity;
  issueCode?: string;
  notes: string;
  syntheticOnly: true;
}>;
