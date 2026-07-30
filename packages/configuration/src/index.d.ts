import type { FeatureGates } from "@pollycar/contracts";

export function assertNoDeprecatedConfigurationEnvironmentVariables(
  environment: Readonly<Record<string, string | undefined>>,
): void;
export const DEPRECATED_CONFIGURATION_ENVIRONMENT_NAMES: readonly string[];

export type LocalSandboxCapabilityName =
  | "syntheticAdminMultiOrganization"
  | "syntheticAdminAuthentication"
  | "syntheticAdminRoleAccessMatrix"
  | "syntheticAdminOperatorManagement"
  | "syntheticAdminDriverVehicle"
  | "syntheticAdminTripOperations"
  | "syntheticAdminCaseManagement"
  | "syntheticAdminFinanceOperations"
  | "syntheticAdminExecutiveDashboard"
  | "syntheticAdminAuditSystem"
  | "syntheticAdminDataReports"
  | "syntheticAdminOrganizationAccounts";

export type LocalSandboxProfile = Readonly<{
  id: "local-sandbox";
  network: Readonly<{
    host: "127.0.0.1";
    serverPort: number;
    adminPort: number;
    appPort: number;
    apiBaseUrl: string;
    adminUrl: string;
    appUrl: string;
    allowedOrigins: readonly string[];
  }>;
  capabilities: Readonly<Record<LocalSandboxCapabilityName, true>>;
}>;

export type LocalSandboxEnvironment = Readonly<
  Record<string, string>
>;

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

export type ServerLogLevel = "info" | "warn" | "error";

export type AuthenticationSecurityPolicy = Readonly<{
  phoneChallengeTtlSeconds: number;
  phoneChallengeMaximumAttempts: number;
  phoneChallengeResendSeconds: number;
  phoneChallengeHourlyLimit: number;
  accountSessionTtlSeconds: number;
  driverLivenessChallengeTtlSeconds: number;
  driverLivenessAuthorizationTtlSeconds: number;
  adminLoginMaximumAttempts: number;
  adminAccountLockSeconds: number;
  adminLoginChallengeTtlSeconds: number;
  adminWorkIdentitySelectionTtlSeconds: number;
  adminAccessSessionTtlSeconds: number;
  adminIdleSessionTtlSeconds: number;
  adminAbsoluteSessionTtlSeconds: number;
  adminMfaFreshnessSeconds: number;
}>;

export type ServerSecurityPolicies = Readonly<{
  version: "authentication.v1";
  authentication: AuthenticationSecurityPolicy;
}>;

export type ProductionAuthenticationReadinessConfig = Readonly<{
  mode: "disabled";
  productionAuthenticationEnabled: false;
  realPhoneDataEnabled: false;
  realSmsDeliveryEnabled: false;
  realIdentityVerificationEnabled: false;
  realBiometricVerificationEnabled: false;
  realDriverLivenessVerificationEnabled: false;
  realAdminAccountsEnabled: false;
  consumerPhone: Readonly<{
    status: "unconfigured" | "configured_disabled";
    providerId?: string;
    apiBaseUrl?: string;
    secretReference?: string;
    senderApprovalReference?: string;
    templateApprovalReference?: string;
  }>;
  adultEligibility: Readonly<{
    status: "unconfigured" | "configured_disabled";
    providerId?: string;
    apiBaseUrl?: string;
    secretReference?: string;
    dataProcessingApprovalReference?: string;
    biometricApprovalReference?: string;
  }>;
  adminWorkforce: Readonly<{
    status: "unconfigured" | "configured_disabled";
    strategy: "pending_decision" | "managed_oidc";
    issuerUrl?: string;
    clientId?: string;
    clientSecretReference?: string;
    tenantApprovalReference?: string;
  }>;
  cryptography: Readonly<{
    status: "unconfigured" | "configured_disabled";
    phoneEncryptionKeyReference?: string;
    phoneDigestKeyReference?: string;
    otpHmacKeyReference?: string;
    sessionSigningKeyReference?: string;
  }>;
}>;

export type InternalSandboxServerConfig = Readonly<{
  environment: "internal-sandbox";
  profile: "local-sandbox";
  dataMode: "synthetic";
  featureGates: FeatureGates;
  persistence: Readonly<{
    mode: "memory" | "postgres";
    databaseUrl?: string;
  }>;
  http: Readonly<{
    host: "127.0.0.1";
    port: number;
    allowedOrigins: readonly string[];
    maximumJsonBodyBytes: number;
  }>;
  sandbox: Readonly<{
    fixedNow?: string;
    executiveStateDirectory: string;
    avatarObjectDirectory: string;
  }>;
  observability: Readonly<{
    serviceName: string;
    logLevel: ServerLogLevel;
    exporter: "memory";
    redactHeaders: readonly string[];
  }>;
  secrets: Readonly<{
    provider: "disabled";
    rawVendorSecretsAllowed: false;
  }>;
  providers: Readonly<{
    sms: ProductionAuthenticationReadinessConfig["consumerPhone"];
    identity: ProductionAuthenticationReadinessConfig["adultEligibility"];
    adminOidc: ProductionAuthenticationReadinessConfig["adminWorkforce"];
    vehicleOcr: Readonly<{
      status: "unconfigured";
      providerId: "tencent-cloud-ocr";
      apiBaseUrl: "https://ocr.tencentcloudapi.com";
    }>;
    amapWebService:
      | Readonly<{
          status: "unconfigured";
          apiBaseUrl: "https://restapi.amap.com";
        }>
      | Readonly<{
          status: "configured_disabled";
          apiBaseUrl: string;
          keyReference: string;
        }>;
  }>;
  cryptography: Readonly<{ status: "unconfigured" }>;
  securityPolicies: ServerSecurityPolicies;
}>;

export type ProductionReadinessServerConfig = Readonly<{
  environment: "production";
  profile: "production-readiness";
  releaseMode: "infrastructure-readiness";
  featureGates: FeatureGates;
  dataMode: "real-disabled";
  persistence: Readonly<{
    mode: "postgres";
    databaseUrl: string;
    caCertificatePath: string;
    requireTls: true;
    maximumPoolSize: number;
    connectionTimeoutMilliseconds: number;
  }>;
  http: Readonly<{
    host: string;
    port: number;
    publicBaseUrl: string;
    allowedOrigins: readonly string[];
    trustedProxyHops: number;
    requireForwardedHttps: true;
    maximumJsonBodyBytes: number;
  }>;
  secrets: Readonly<{
    provider: "managed";
    reference: string;
    rawVendorSecretsAllowed: false;
  }>;
  monitoring: Readonly<{
    serviceName: string;
    otlpEndpoint: string;
    logLevel: ServerLogLevel;
    healthPaths: Readonly<{
      live: "/health/live";
      ready: "/health/ready";
    }>;
    redactHeaders: readonly string[];
  }>;
  providers: Readonly<{
    sms: ProductionAuthenticationReadinessConfig["consumerPhone"];
    identity: ProductionAuthenticationReadinessConfig["adultEligibility"];
    adminOidc: ProductionAuthenticationReadinessConfig["adminWorkforce"];
    vehicleOcr: Readonly<{
      status: "unconfigured" | "configured_disabled";
      providerId?: string;
      apiBaseUrl?: string;
      secretReference?: string;
    }>;
    amapWebService: Readonly<{
      status: "unconfigured" | "configured_disabled";
      apiBaseUrl?: string;
      keyReference?: string;
      approvalReference?: string;
    }>;
  }>;
  cryptography: ProductionAuthenticationReadinessConfig["cryptography"];
  securityPolicies: ServerSecurityPolicies;
  authentication: ProductionAuthenticationReadinessConfig;
}>;

export const DEFAULT_MAXIMUM_JSON_BODY_BYTES: number;
export const DEFAULT_AUTHENTICATION_SECURITY_POLICY: AuthenticationSecurityPolicy;
export const BUILD_TOOLCHAIN: Readonly<{
  node: "22";
  pnpm: "10.22.0";
  java: "17";
  easCli: "21.4.0";
  postgresImage: "postgres:17-alpine";
}>;
export type BuildConfigurationTarget =
  | "native-ci"
  | "postgres-ci"
  | "production-release"
  | "container-evidence"
  | "container-publication";
export function collectBuildConfigurationFailures(input: Readonly<{
  target: BuildConfigurationTarget;
  environment: Readonly<Record<string, string | undefined>>;
  appConfig?: Readonly<Record<string, unknown>>;
}>): readonly string[];
export function assertBuildConfiguration(input: Readonly<{
  target: BuildConfigurationTarget;
  environment: Readonly<Record<string, string | undefined>>;
  appConfig?: Readonly<Record<string, unknown>>;
}>): string;

export function getLocalSandboxProfile(
  environment?: Readonly<Record<string, string | undefined>>,
): LocalSandboxProfile;

export function getLocalSandboxServerConfig(
  environment?: Readonly<Record<string, string | undefined>>,
): Readonly<{
  port: number;
  allowedOrigins: readonly string[];
  featureGates: Readonly<Partial<FeatureGates>>;
}>;

export function createLocalSandboxServerEnvironment(
  environment?: Readonly<Record<string, string | undefined>>,
): LocalSandboxEnvironment;

export function createLocalSandboxAdminEnvironment(
  environment?: Readonly<Record<string, string | undefined>>,
): LocalSandboxEnvironment;

export function createLocalSandboxAppEnvironment(
  environment?: Readonly<Record<string, string | undefined>>,
): LocalSandboxEnvironment;

export function createLocalSandboxLaunchManifest(
  environment?: Readonly<Record<string, string | undefined>>,
): Readonly<{
  profile: LocalSandboxProfile;
  serverEnvironment: LocalSandboxEnvironment;
  adminEnvironment: LocalSandboxEnvironment;
  appEnvironment: LocalSandboxEnvironment;
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

export function getLocalSandboxServerRuntimeConfig(
  environment: Readonly<Record<string, string | undefined>>,
  profile: LocalSandboxProfile,
): InternalSandboxServerConfig;

export function createInternalSandboxServerConfig(
  overrides?: Readonly<{
    port?: number;
    allowedOrigins?: readonly string[];
    databaseUrl?: string;
    featureGates?: Partial<FeatureGates>;
    maximumJsonBodyBytes?: number;
    amapWebService?: Readonly<{
      apiBaseUrl?: string;
      keyReference: string;
    }>;
  }>,
): InternalSandboxServerConfig;

export function getProductionReadinessServerConfig(
  environment: Readonly<Record<string, string | undefined>>,
): ProductionReadinessServerConfig;

export function getProductionAuthenticationReadinessConfig(
  environment: Readonly<Record<string, string | undefined>>,
): ProductionAuthenticationReadinessConfig;

export function getSandboxMigrationConfig(
  environment: Readonly<Record<string, string | undefined>>,
): Readonly<{
  profile: "local-sandbox";
  databaseUrl: string;
}>;

export type PostgresIntegrationTestConfig = Readonly<{
  dispatchDatabaseUrl?: string;
  ledgerPrototypeDatabaseUrl?: string;
  ledgerKernelDatabaseUrl?: string;
  ledgerResilienceDatabaseUrl?: string;
  ledgerTemplatesDatabaseUrl?: string;
  reconciliationDatabaseUrl?: string;
  operatorFundsDatabaseUrl?: string;
  ledgerResiliencePhase?: string;
}>;

export function getPostgresIntegrationTestConfig(
  environment: Readonly<Record<string, string | undefined>>,
): PostgresIntegrationTestConfig;

export function createEnvironmentSecretProvider(
  environment: Readonly<Record<string, string | undefined>>,
): Readonly<{
  read(name: string): Promise<string | undefined>;
}>;

export function loadLocalSandboxServerRuntimeConfig(): InternalSandboxServerConfig;
export function loadProductionReadinessServerConfig(): ProductionReadinessServerConfig;
export function loadProductionAuthenticationReadinessConfig(): ProductionAuthenticationReadinessConfig;
export function loadSandboxMigrationConfig(): Readonly<{
  profile: "local-sandbox";
  databaseUrl: string;
}>;
export function loadPostgresIntegrationTestConfig(): PostgresIntegrationTestConfig;
export function createProcessEnvironmentSecretProvider(): Readonly<{
  read(name: string): Promise<string | undefined>;
}>;
