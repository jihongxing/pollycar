export type PublicConfigurationProfile =
  | "local-sandbox"
  | "test"
  | "demo"
  | "shared-preproduction"
  | "production-readiness"
  | "production";

export type AdminPublicConfig = Readonly<{
  version: 1;
  consumer: "admin";
  profile: PublicConfigurationProfile;
  apiBaseUrl: string;
  capabilities: Readonly<{
    multiOrganization: boolean;
    authentication: boolean;
    roleAccessMatrix: boolean;
    operatorManagement: boolean;
    driverVehicle: boolean;
    tripOperations: boolean;
    caseManagement: boolean;
    financeOperations: boolean;
    executiveDashboard: boolean;
    auditSystem: boolean;
    dataReports: boolean;
    organizationAccounts: boolean;
  }>;
}>;

export type AppPublicConfig = Readonly<{
  version: 1;
  consumer: "app";
  profile: PublicConfigurationProfile;
  apiBaseUrl: string;
  brandDisplayEnvironment: "sandbox" | "demo" | "production";
  maps: Readonly<{
    web: Readonly<{
      enabled: boolean;
      apiKey?: string;
      securityCode?: string;
    }>;
  }>;
}>;

export function createAdminPublicConfig(input: Readonly<{
  profile: PublicConfigurationProfile;
  apiBaseUrl: string;
  capabilities?: Readonly<Record<string, boolean>>;
}>): AdminPublicConfig;

export function createAppPublicConfig(input: Readonly<{
  profile: PublicConfigurationProfile;
  apiBaseUrl: string;
  brandDisplayEnvironment: "sandbox" | "demo" | "production";
  maps?: Readonly<{
    web?: Readonly<{
      enabled?: boolean;
      apiKey?: string;
      securityCode?: string;
    }>;
  }>;
}>): AppPublicConfig;

export function serializePublicConfig(
  value: AdminPublicConfig | AppPublicConfig,
): string;

export function createPublicConfigEnvironment(
  environment: Readonly<Record<string, string | undefined>>,
  variableName:
    | "VITE_POLLYCAR_PUBLIC_CONFIG"
    | "EXPO_PUBLIC_POLLYCAR_PUBLIC_CONFIG",
  config: AdminPublicConfig | AppPublicConfig,
): Readonly<Record<string, string>>;

export function parseAdminPublicConfig(
  serialized: string | undefined,
): AdminPublicConfig;

export function parseAppPublicConfig(
  serialized: string | undefined,
): AppPublicConfig;
