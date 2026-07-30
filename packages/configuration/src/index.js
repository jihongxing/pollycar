import { getLocalSandboxServerRuntimeConfig } from "./server-runtime-config.js";
import { assertNoDeprecatedConfigurationEnvironmentVariables } from "./deprecated-environment.js";
import {
  createAdminPublicConfig,
  createAppPublicConfig,
  serializePublicConfig,
} from "./public-config.js";

const LOCAL_HOST = "127.0.0.1";
const DEFAULT_PORTS = Object.freeze({
  server: 4321,
  admin: 4173,
  app: 8181,
});

const CAPABILITY_ENVIRONMENT_NAMES = Object.freeze({
  syntheticAdminMultiOrganization: "MULTI_ORGANIZATION",
  syntheticAdminAuthentication: "AUTHENTICATION",
  syntheticAdminRoleAccessMatrix: "ROLE_ACCESS_MATRIX",
  syntheticAdminOperatorManagement: "OPERATOR_MANAGEMENT",
  syntheticAdminDriverVehicle: "DRIVER_VEHICLE",
  syntheticAdminTripOperations: "TRIP_OPERATIONS",
  syntheticAdminCaseManagement: "CASE_MANAGEMENT",
  syntheticAdminFinanceOperations: "FINANCE_OPERATIONS",
  syntheticAdminExecutiveDashboard: "EXECUTIVE_DASHBOARD",
  syntheticAdminAuditSystem: "AUDIT_SYSTEM",
  syntheticAdminDataReports: "DATA_REPORTS",
  syntheticAdminOrganizationAccounts: "ORGANIZATION_ACCOUNTS",
});

const LOCAL_SANDBOX_CAPABILITIES = deepFreeze(
  Object.fromEntries(
    Object.keys(CAPABILITY_ENVIRONMENT_NAMES).map((name) => [name, true]),
  ),
);

/**
 * @param {Readonly<Record<string, string | undefined>>} [environment]
 */
export function getLocalSandboxProfile(environment = {}) {
  assertNoDeprecatedConfigurationEnvironmentVariables(environment);
  const serverPort = readPort(
    environment.POLLYCAR_LOCAL_SANDBOX_SERVER_PORT,
    DEFAULT_PORTS.server,
    "POLLYCAR_LOCAL_SANDBOX_SERVER_PORT",
  );
  const adminPort = readPort(
    environment.POLLYCAR_LOCAL_SANDBOX_ADMIN_PORT,
    DEFAULT_PORTS.admin,
    "POLLYCAR_LOCAL_SANDBOX_ADMIN_PORT",
  );
  const appPort = readPort(
    environment.POLLYCAR_LOCAL_SANDBOX_APP_PORT,
    DEFAULT_PORTS.app,
    "POLLYCAR_LOCAL_SANDBOX_APP_PORT",
  );

  if (new Set([serverPort, adminPort, appPort]).size !== 3) {
    throw new Error("LOCAL_SANDBOX_PORTS_MUST_BE_DISTINCT");
  }

  const apiBaseUrl = createOrigin(serverPort);
  const adminUrl = createOrigin(adminPort);
  const appUrl = createOrigin(appPort);

  return deepFreeze({
    id: "local-sandbox",
    network: {
      host: LOCAL_HOST,
      serverPort,
      adminPort,
      appPort,
      apiBaseUrl,
      adminUrl,
      appUrl,
      allowedOrigins: [adminUrl, appUrl],
    },
    capabilities: { ...LOCAL_SANDBOX_CAPABILITIES },
  });
}

/**
 * @param {Readonly<Record<string, string | undefined>>} [environment]
 */
export function getLocalSandboxServerConfig(environment = {}) {
  const profile = getLocalSandboxProfile(environment);
  const financeEnabled =
    profile.capabilities.syntheticAdminFinanceOperations;

  return deepFreeze({
    port: profile.network.serverPort,
    allowedOrigins: [...profile.network.allowedOrigins],
    featureGates: {
      productionEnabled: false,
      internalSandbox: true,
      ...profile.capabilities,
      syntheticFinancialLedger: financeEnabled,
      syntheticFinancialReconciliation: financeEnabled,
      syntheticOperatorFunds: financeEnabled,
      realAdminOrganizationAccounts: false,
      realAdminFinanceOperations: false,
      productionAdminEnabled: false,
      realPayment: false,
      realSettlement: false,
      realWithdrawal: false,
      realOperatorOnboarding: false,
      realUserInvitation: false,
      realDataIngestion: false,
      realIdentityVerification: false,
      realBiometricVerification: false,
      realDriverLivenessVerification: false,
      externalIdentityProvider: false,
      realSmsDelivery: false,
      realPhoneData: false,
      productionAuthentication: false,
      realMap: false,
      externalMapProvider: false,
      realDeviceLocation: false,
      backgroundLocation: false,
      realVehicleLocationStream: false,
      amapSdk: false,
      amapWebService: false,
    },
  });
}

export function loadLocalSandboxServerRuntimeConfig() {
  return getLocalSandboxServerRuntimeConfig(
    process.env,
    getLocalSandboxProfile(process.env),
  );
}

export {
  assertNoDeprecatedConfigurationEnvironmentVariables,
  DEPRECATED_CONFIGURATION_ENVIRONMENT_NAMES,
} from "./deprecated-environment.js";
export {
  createAdminPublicConfig,
  createAppPublicConfig,
  createPublicConfigEnvironment,
  parseAdminPublicConfig,
  parseAppPublicConfig,
  serializePublicConfig,
} from "./public-config.js";
export {
  BUILD_TOOLCHAIN,
  assertBuildConfiguration,
  collectBuildConfigurationFailures,
} from "./build-configuration.js";
export {
  DEFAULT_MAXIMUM_JSON_BODY_BYTES,
  createEnvironmentSecretProvider,
  createInternalSandboxServerConfig,
  createProcessEnvironmentSecretProvider,
  getProductionAuthenticationReadinessConfig,
  getPostgresIntegrationTestConfig,
  getProductionReadinessServerConfig,
  getSandboxMigrationConfig,
  loadProductionAuthenticationReadinessConfig,
  loadPostgresIntegrationTestConfig,
  loadProductionReadinessServerConfig,
  loadSandboxMigrationConfig,
} from "./server-runtime-config.js";
export { getLocalSandboxServerRuntimeConfig };

/**
 * @param {Readonly<Record<string, string | undefined>>} [environment]
 */
export function createLocalSandboxServerEnvironment(environment = {}) {
  const profile = getLocalSandboxProfile(environment);
  return deepFreeze({
    POLLYCAR_RUNTIME_PROFILE: profile.id,
  });
}

/**
 * @param {Readonly<Record<string, string | undefined>>} [environment]
 */
export function createLocalSandboxAdminEnvironment(environment = {}) {
  const profile = getLocalSandboxProfile(environment);

  return deepFreeze({
    VITE_POLLYCAR_PUBLIC_CONFIG: serializePublicConfig(
      createAdminPublicConfig({
        profile: profile.id,
        apiBaseUrl: profile.network.apiBaseUrl,
        capabilities: Object.fromEntries(
          Object.entries(CAPABILITY_ENVIRONMENT_NAMES).map(
            ([name, suffix]) => [
              suffix
                .toLowerCase()
                .replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()),
              profile.capabilities[name],
            ],
          ),
        ),
      }),
    ),
  });
}

/**
 * @param {Readonly<Record<string, string | undefined>>} [environment]
 */
export function createLocalSandboxAppEnvironment(environment = {}) {
  const profile = getLocalSandboxProfile(environment);
  return deepFreeze({
    EXPO_PUBLIC_POLLYCAR_PUBLIC_CONFIG: serializePublicConfig(
      createAppPublicConfig({
        profile: profile.id,
        apiBaseUrl: profile.network.apiBaseUrl,
        brandDisplayEnvironment: "sandbox",
      }),
    ),
  });
}

/**
 * @param {Readonly<Record<string, string | undefined>>} [environment]
 */
export function createLocalSandboxLaunchManifest(environment = {}) {
  return deepFreeze({
    profile: getLocalSandboxProfile(environment),
    serverEnvironment: createLocalSandboxServerEnvironment(environment),
    adminEnvironment: createLocalSandboxAdminEnvironment(environment),
    appEnvironment: createLocalSandboxAppEnvironment(environment),
  });
}

function createOrigin(port) {
  return `http://${LOCAL_HOST}:${port}`;
}

function readPort(value, fallback, name) {
  if (value === undefined || value.trim() === "") return fallback;
  if (!/^\d+$/.test(value)) throw new Error(`${name}_INVALID`);
  const port = Number(value);
  if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) {
    throw new Error(`${name}_INVALID`);
  }
  return port;
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}
