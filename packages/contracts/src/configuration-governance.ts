export type ConfigurationProfile =
  | "local-sandbox"
  | "test"
  | "demo"
  | "shared-preproduction"
  | "production-readiness"
  | "production";

export type ConfigurationSensitivity = "L0" | "L1" | "L2" | "L3";

export type ConfigurationExposure =
  | "public"
  | "private"
  | "secret-reference"
  | "secret"
  | "policy"
  | "build";

export type ConfigurationConsumer =
  | "admin"
  | "app"
  | "server"
  | "ci"
  | "eas"
  | "infrastructure";

export type ConfigurationValueType =
  | "boolean"
  | "integer"
  | "string"
  | "string-list"
  | "url"
  | "url-list"
  | "path"
  | "secret-reference"
  | "structured-policy";

export type ConfigurationDefinition = Readonly<{
  key: string;
  category:
    | "runtime"
    | "network"
    | "capability"
    | "persistence"
    | "provider"
    | "security"
    | "observability"
    | "build"
    | "supply-chain"
    | "test";
  valueType: ConfigurationValueType;
  exposure: ConfigurationExposure;
  sensitivity: ConfigurationSensitivity;
  consumers: readonly ConfigurationConsumer[];
  profiles: readonly ConfigurationProfile[];
  legacyNames: readonly string[];
  migration:
    | "profile"
    | "generated-public-config"
    | "server-config"
    | "secret-provider"
    | "versioned-policy"
    | "build-profile"
    | "test-profile";
}>;

export type ConfigurationProfileDefinition = Readonly<{
  id: ConfigurationProfile;
  environment: "local" | "test" | "shared" | "production";
  buildKind: "development" | "test" | "demo" | "readiness" | "release";
  permitsSyntheticCapabilities: boolean;
  permitsRealCapabilities: boolean;
  requiresHttpsPublicUrls: boolean;
  allowsRawSecrets: false;
}>;

export type RedactedConfigurationSummaryEntry = Readonly<{
  key: string;
  sensitivity: ConfigurationSensitivity;
  configured: boolean;
  value?: unknown;
}>;

export const deprecatedConfigurationEnvironmentNames = Object.freeze([
  "EXPO_PUBLIC_BRAND_DEMO",
  "EXPO_PUBLIC_BRAND_DISPLAY_ENV",
  "EXPO_PUBLIC_BRAND_PRODUCTION",
  "EXPO_PUBLIC_POLLYCAR_API_BASE_URL",
  "EXPO_PUBLIC_POLLYCAR_API_MODE",
  "EXPO_PUBLIC_POLLYCAR_RUNTIME_PROFILE",
  "EXPO_PUBLIC_POLLYCAR_AMAP_APPROVAL_REFERENCE",
  "EXPO_PUBLIC_POLLYCAR_AMAP_WEB_ENABLED",
  "EXPO_PUBLIC_POLLYCAR_AMAP_WEB_JS_API_KEY",
  "EXPO_PUBLIC_POLLYCAR_AMAP_WEB_JS_SECURITY_CODE",
  "POLLYCAR_ADMIN_PROXY_TARGET",
  "POLLYCAR_AMAP_ANDROID_DEPENDENCIES",
  "POLLYCAR_AMAP_WEB_ENABLED",
  "POLLYCAR_E2E_ADMIN_PORT",
  "POLLYCAR_E2E_APP_PORT",
  "POLLYCAR_E2E_SERVER_PORT",
  "POLLYCAR_PRODUCTION_DATABASE_URL",
  "POLLYCAR_SANDBOX_PORT",
  "VITE_ADMIN_API_BASE_URL",
  "VITE_POLLYCAR_RUNTIME_PROFILE",
  ...[
    "MULTI_ORGANIZATION",
    "AUTHENTICATION",
    "ROLE_ACCESS_MATRIX",
    "OPERATOR_MANAGEMENT",
    "DRIVER_VEHICLE",
    "TRIP_OPERATIONS",
    "CASE_MANAGEMENT",
    "FINANCE_OPERATIONS",
    "EXECUTIVE_DASHBOARD",
    "AUDIT_SYSTEM",
    "DATA_REPORTS",
    "ORGANIZATION_ACCOUNTS",
  ].flatMap((suffix) => [
    `POLLYCAR_SYNTHETIC_ADMIN_${suffix}`,
    `VITE_SYNTHETIC_ADMIN_${suffix}`,
  ]),
]);

const allProfiles: readonly ConfigurationProfile[] = [
  "local-sandbox",
  "test",
  "demo",
  "shared-preproduction",
  "production-readiness",
  "production",
];

const deployedProfiles: readonly ConfigurationProfile[] = [
  "shared-preproduction",
  "production-readiness",
  "production",
];

const localProfiles: readonly ConfigurationProfile[] = [
  "local-sandbox",
  "test",
  "demo",
];

export const configurationProfiles: readonly ConfigurationProfileDefinition[] =
  Object.freeze([
    defineProfile({
      id: "local-sandbox",
      environment: "local",
      buildKind: "development",
      permitsSyntheticCapabilities: true,
      permitsRealCapabilities: false,
      requiresHttpsPublicUrls: false,
      allowsRawSecrets: false,
    }),
    defineProfile({
      id: "test",
      environment: "test",
      buildKind: "test",
      permitsSyntheticCapabilities: true,
      permitsRealCapabilities: false,
      requiresHttpsPublicUrls: false,
      allowsRawSecrets: false,
    }),
    defineProfile({
      id: "demo",
      environment: "local",
      buildKind: "demo",
      permitsSyntheticCapabilities: true,
      permitsRealCapabilities: false,
      requiresHttpsPublicUrls: false,
      allowsRawSecrets: false,
    }),
    defineProfile({
      id: "shared-preproduction",
      environment: "shared",
      buildKind: "readiness",
      permitsSyntheticCapabilities: true,
      permitsRealCapabilities: false,
      requiresHttpsPublicUrls: true,
      allowsRawSecrets: false,
    }),
    defineProfile({
      id: "production-readiness",
      environment: "production",
      buildKind: "readiness",
      permitsSyntheticCapabilities: false,
      permitsRealCapabilities: false,
      requiresHttpsPublicUrls: true,
      allowsRawSecrets: false,
    }),
    defineProfile({
      id: "production",
      environment: "production",
      buildKind: "release",
      permitsSyntheticCapabilities: false,
      permitsRealCapabilities: true,
      requiresHttpsPublicUrls: true,
      allowsRawSecrets: false,
    }),
  ]);

function define(
  definition: ConfigurationDefinition,
): ConfigurationDefinition {
  return Object.freeze({
    ...definition,
    consumers: Object.freeze([...definition.consumers]),
    profiles: Object.freeze([...definition.profiles]),
    legacyNames: Object.freeze([...definition.legacyNames]),
  });
}

export const configurationCatalog: readonly ConfigurationDefinition[] =
  Object.freeze([
    define({
      key: "runtime.profile",
      category: "runtime",
      valueType: "string",
      exposure: "public",
      sensitivity: "L0",
      consumers: ["admin", "app", "server", "ci", "eas", "infrastructure"],
      profiles: allProfiles,
      legacyNames: [
        "EXPO_PUBLIC_BRAND_DEMO",
        "EXPO_PUBLIC_BRAND_DISPLAY_ENV",
        "EXPO_PUBLIC_BRAND_PRODUCTION",
        "EXPO_PUBLIC_POLLYCAR_API_MODE",
        "EXPO_PUBLIC_POLLYCAR_RUNTIME_PROFILE",
        "VITE_POLLYCAR_RUNTIME_PROFILE",
        "POLLYCAR_RUNTIME_PROFILE",
      ],
      migration: "profile",
    }),
    define({
      key: "public.apiBaseUrl",
      category: "network",
      valueType: "url",
      exposure: "public",
      sensitivity: "L0",
      consumers: ["admin", "app"],
      profiles: allProfiles,
      legacyNames: [
        "VITE_ADMIN_API_BASE_URL",
        "EXPO_PUBLIC_POLLYCAR_API_BASE_URL",
        "POLLYCAR_ADMIN_PROXY_TARGET",
      ],
      migration: "generated-public-config",
    }),
    define({
      key: "public.snapshot",
      category: "runtime",
      valueType: "structured-policy",
      exposure: "public",
      sensitivity: "L0",
      consumers: ["admin", "app"],
      profiles: allProfiles,
      legacyNames: [
        "VITE_POLLYCAR_PUBLIC_CONFIG",
        "EXPO_PUBLIC_POLLYCAR_PUBLIC_CONFIG",
      ],
      migration: "generated-public-config",
    }),
    define({
      key: "local.admin.port",
      category: "network",
      valueType: "integer",
      exposure: "private",
      sensitivity: "L1",
      consumers: ["admin", "ci"],
      profiles: localProfiles,
      legacyNames: [
        "POLLYCAR_LOCAL_SANDBOX_ADMIN_PORT",
        "POLLYCAR_E2E_ADMIN_PORT",
      ],
      migration: "profile",
    }),
    define({
      key: "local.app.port",
      category: "network",
      valueType: "integer",
      exposure: "private",
      sensitivity: "L1",
      consumers: ["app", "ci"],
      profiles: localProfiles,
      legacyNames: [
        "POLLYCAR_LOCAL_SANDBOX_APP_PORT",
        "POLLYCAR_E2E_APP_PORT",
      ],
      migration: "profile",
    }),
    define({
      key: "server.http.host",
      category: "network",
      valueType: "string",
      exposure: "private",
      sensitivity: "L1",
      consumers: ["server", "infrastructure"],
      profiles: allProfiles,
      legacyNames: ["POLLYCAR_PRODUCTION_HOST"],
      migration: "server-config",
    }),
    define({
      key: "server.http.port",
      category: "network",
      valueType: "integer",
      exposure: "private",
      sensitivity: "L1",
      consumers: ["server", "infrastructure"],
      profiles: allProfiles,
      legacyNames: [
        "POLLYCAR_LOCAL_SANDBOX_SERVER_PORT",
        "POLLYCAR_E2E_SERVER_PORT",
        "POLLYCAR_SANDBOX_PORT",
        "POLLYCAR_PRODUCTION_PORT",
      ],
      migration: "server-config",
    }),
    define({
      key: "server.http.publicBaseUrl",
      category: "network",
      valueType: "url",
      exposure: "public",
      sensitivity: "L0",
      consumers: ["server", "infrastructure"],
      profiles: deployedProfiles,
      legacyNames: ["POLLYCAR_PRODUCTION_PUBLIC_BASE_URL"],
      migration: "server-config",
    }),
    define({
      key: "server.http.allowedOrigins",
      category: "network",
      valueType: "url-list",
      exposure: "private",
      sensitivity: "L1",
      consumers: ["server", "infrastructure"],
      profiles: allProfiles,
      legacyNames: [
        "POLLYCAR_SANDBOX_ALLOWED_ORIGINS",
        "POLLYCAR_PRODUCTION_ALLOWED_ORIGINS",
      ],
      migration: "server-config",
    }),
    define({
      key: "server.http.trustedProxyHops",
      category: "network",
      valueType: "integer",
      exposure: "private",
      sensitivity: "L1",
      consumers: ["server", "infrastructure"],
      profiles: deployedProfiles,
      legacyNames: ["POLLYCAR_TRUSTED_PROXY_HOPS"],
      migration: "server-config",
    }),
    define({
      key: "server.http.maximumJsonBodyBytes",
      category: "security",
      valueType: "integer",
      exposure: "policy",
      sensitivity: "L1",
      consumers: ["server"],
      profiles: allProfiles,
      legacyNames: ["POLLYCAR_HTTP_MAXIMUM_JSON_BODY_BYTES"],
      migration: "versioned-policy",
    }),
    define({
      key: "sandbox.fixedNow",
      category: "test",
      valueType: "string",
      exposure: "private",
      sensitivity: "L1",
      consumers: ["server", "ci"],
      profiles: ["local-sandbox", "test"],
      legacyNames: ["POLLYCAR_SANDBOX_NOW"],
      migration: "test-profile",
    }),
    define({
      key: "sandbox.state.executiveDirectory",
      category: "persistence",
      valueType: "path",
      exposure: "private",
      sensitivity: "L1",
      consumers: ["server"],
      profiles: ["local-sandbox", "test"],
      legacyNames: ["POLLYCAR_EXECUTIVE_STATE_DIR"],
      migration: "server-config",
    }),
    ...syntheticAdminDefinitions(),
    define({
      key: "server.persistence.databaseUrl",
      category: "persistence",
      valueType: "string",
      exposure: "secret",
      sensitivity: "L3",
      consumers: ["server", "ci"],
      profiles: allProfiles,
      legacyNames: [
        "POLLYCAR_DATABASE_URL",
        "POLLYCAR_PRODUCTION_DATABASE_URL",
      ],
      migration: "server-config",
    }),
    define({
      key: "server.persistence.tls.caCertificatePath",
      category: "persistence",
      valueType: "path",
      exposure: "private",
      sensitivity: "L1",
      consumers: ["server", "infrastructure"],
      profiles: deployedProfiles,
      legacyNames: ["POLLYCAR_PRODUCTION_DATABASE_CA_PATH"],
      migration: "server-config",
    }),
    define({
      key: "server.persistence.pool.maximumSize",
      category: "persistence",
      valueType: "integer",
      exposure: "private",
      sensitivity: "L1",
      consumers: ["server"],
      profiles: deployedProfiles,
      legacyNames: ["POLLYCAR_PRODUCTION_DATABASE_POOL_SIZE"],
      migration: "server-config",
    }),
    define({
      key: "server.persistence.pool.connectionTimeoutMs",
      category: "persistence",
      valueType: "integer",
      exposure: "private",
      sensitivity: "L1",
      consumers: ["server"],
      profiles: deployedProfiles,
      legacyNames: ["POLLYCAR_PRODUCTION_DATABASE_TIMEOUT_MS"],
      migration: "server-config",
    }),
    define({
      key: "test.postgres.databaseUrls",
      category: "test",
      valueType: "structured-policy",
      exposure: "secret",
      sensitivity: "L3",
      consumers: ["server", "ci"],
      profiles: ["test"],
      legacyNames: [
        "POLLYCAR_LEDGER_PROTOTYPE_DATABASE_URL",
        "POLLYCAR_LEDGER_KERNEL_DATABASE_URL",
        "POLLYCAR_LEDGER_RESILIENCE_DATABASE_URL",
        "POLLYCAR_LEDGER_TEMPLATES_DATABASE_URL",
        "POLLYCAR_RECONCILIATION_DATABASE_URL",
        "POLLYCAR_OPERATOR_FUNDS_DATABASE_URL",
      ],
      migration: "test-profile",
    }),
    define({
      key: "test.scenario.ledgerResiliencePhase",
      category: "test",
      valueType: "string",
      exposure: "private",
      sensitivity: "L1",
      consumers: ["server", "ci"],
      profiles: ["test"],
      legacyNames: ["POLLYCAR_LEDGER_RESILIENCE_PHASE"],
      migration: "test-profile",
    }),
    define({
      key: "server.secrets.providerReference",
      category: "security",
      valueType: "secret-reference",
      exposure: "secret-reference",
      sensitivity: "L2",
      consumers: ["server", "infrastructure"],
      profiles: deployedProfiles,
      legacyNames: ["POLLYCAR_SECRET_PROVIDER_REFERENCE"],
      migration: "secret-provider",
    }),
    ...authenticationProviderDefinitions(),
    ...mapDefinitions(),
    define({
      key: "server.providers.vehicleOcr",
      category: "provider",
      valueType: "structured-policy",
      exposure: "secret-reference",
      sensitivity: "L2",
      consumers: ["server"],
      profiles: deployedProfiles,
      legacyNames: [
        "POLLYCAR_VEHICLE_OCR_PROVIDER_ID",
        "POLLYCAR_VEHICLE_OCR_API_BASE_URL",
        "POLLYCAR_VEHICLE_OCR_SECRET_REFERENCE",
      ],
      migration: "secret-provider",
    }),
    define({
      key: "server.observability.otlpEndpoint",
      category: "observability",
      valueType: "url",
      exposure: "private",
      sensitivity: "L1",
      consumers: ["server", "infrastructure"],
      profiles: deployedProfiles,
      legacyNames: ["POLLYCAR_OTLP_ENDPOINT"],
      migration: "server-config",
    }),
    define({
      key: "server.observability.serviceName",
      category: "observability",
      valueType: "string",
      exposure: "private",
      sensitivity: "L1",
      consumers: ["server", "infrastructure"],
      profiles: allProfiles,
      legacyNames: ["POLLYCAR_OTEL_SERVICE_NAME"],
      migration: "server-config",
    }),
    define({
      key: "server.observability.logLevel",
      category: "observability",
      valueType: "string",
      exposure: "private",
      sensitivity: "L1",
      consumers: ["server"],
      profiles: allProfiles,
      legacyNames: ["POLLYCAR_LOG_LEVEL"],
      migration: "server-config",
    }),
    define({
      key: "securityPolicies.authentication",
      category: "security",
      valueType: "structured-policy",
      exposure: "policy",
      sensitivity: "L1",
      consumers: ["server"],
      profiles: allProfiles,
      legacyNames: [
        "POLLYCAR_AUTH_PHONE_CHALLENGE_TTL_SECONDS",
        "POLLYCAR_AUTH_PHONE_CHALLENGE_MAXIMUM_ATTEMPTS",
        "POLLYCAR_AUTH_PHONE_CHALLENGE_RESEND_SECONDS",
        "POLLYCAR_AUTH_PHONE_CHALLENGE_HOURLY_LIMIT",
        "POLLYCAR_AUTH_ACCOUNT_SESSION_TTL_SECONDS",
        "POLLYCAR_AUTH_DRIVER_LIVENESS_CHALLENGE_TTL_SECONDS",
        "POLLYCAR_AUTH_DRIVER_LIVENESS_AUTHORIZATION_TTL_SECONDS",
        "POLLYCAR_AUTH_ADMIN_LOGIN_MAXIMUM_ATTEMPTS",
        "POLLYCAR_AUTH_ADMIN_ACCOUNT_LOCK_SECONDS",
        "POLLYCAR_AUTH_ADMIN_LOGIN_CHALLENGE_TTL_SECONDS",
        "POLLYCAR_AUTH_ADMIN_WORK_IDENTITY_SELECTION_TTL_SECONDS",
        "POLLYCAR_AUTH_ADMIN_ACCESS_SESSION_TTL_SECONDS",
        "POLLYCAR_AUTH_ADMIN_IDLE_SESSION_TTL_SECONDS",
        "POLLYCAR_AUTH_ADMIN_ABSOLUTE_SESSION_TTL_SECONDS",
        "POLLYCAR_AUTH_ADMIN_MFA_FRESHNESS_SECONDS",
      ],
      migration: "versioned-policy",
    }),
    define({
      key: "build.profile",
      category: "build",
      valueType: "string",
      exposure: "build",
      sensitivity: "L2",
      consumers: ["app", "ci", "eas"],
      profiles: allProfiles,
      legacyNames: [
        "POLLYCAR_PRODUCTION_BUILD",
        "POLLYCAR_NATIVE_PLATFORM",
        "POLLYCAR_NATIVE_RELEASE_UNSIGNED",
      ],
      migration: "build-profile",
    }),
    define({
      key: "build.android.signing",
      category: "build",
      valueType: "structured-policy",
      exposure: "secret",
      sensitivity: "L3",
      consumers: ["app", "ci", "eas"],
      profiles: ["test", "production-readiness", "production"],
      legacyNames: [
        "POLLYCAR_ANDROID_RELEASE_STORE_FILE",
        "POLLYCAR_ANDROID_RELEASE_STORE_PASSWORD",
        "POLLYCAR_ANDROID_RELEASE_KEY_ALIAS",
        "POLLYCAR_ANDROID_RELEASE_KEY_PASSWORD",
        "POLLYCAR_ANDROID_SIGNING_MODE",
      ],
      migration: "build-profile",
    }),
    define({
      key: "build.ios.signing",
      category: "build",
      valueType: "structured-policy",
      exposure: "secret-reference",
      sensitivity: "L2",
      consumers: ["app", "ci", "eas"],
      profiles: ["test", "production-readiness", "production"],
      legacyNames: ["POLLYCAR_IOS_SIGNING_MODE"],
      migration: "build-profile",
    }),
    define({
      key: "release.approval",
      category: "build",
      valueType: "structured-policy",
      exposure: "secret-reference",
      sensitivity: "L2",
      consumers: ["ci", "eas", "infrastructure"],
      profiles: ["production-readiness", "production"],
      legacyNames: [
        "POLLYCAR_PRODUCTION_API_APPROVED",
        "POLLYCAR_RELEASE_APPROVAL_GRANTED",
        "POLLYCAR_IMAGE_PUBLICATION_APPROVED",
        "POLLYCAR_REAL_SMS_DELIVERY_APPROVED",
        "POLLYCAR_REAL_IDENTITY_APPROVED",
      ],
      migration: "build-profile",
    }),
    define({
      key: "supplyChain.images",
      category: "supply-chain",
      valueType: "structured-policy",
      exposure: "build",
      sensitivity: "L2",
      consumers: ["ci", "infrastructure"],
      profiles: ["test", "production-readiness", "production"],
      legacyNames: [
        "POLLYCAR_NODE_IMAGE_DIGEST",
        "POLLYCAR_POSTGRES_IMAGE_DIGEST",
        "POLLYCAR_OTEL_COLLECTOR_IMAGE_DIGEST",
        "POLLYCAR_CADDY_IMAGE_DIGEST",
        "POLLYCAR_IMAGE_REGISTRY",
        "POLLYCAR_IMAGE_SIGNING_IDENTITY",
      ],
      migration: "build-profile",
    }),
    define({
      key: "toolchain.versions",
      category: "supply-chain",
      valueType: "structured-policy",
      exposure: "build",
      sensitivity: "L1",
      consumers: ["admin", "app", "server", "ci", "eas", "infrastructure"],
      profiles: allProfiles,
      legacyNames: [
        "POLLYCAR_BUILD_NODE_VERSION",
        "POLLYCAR_BUILD_PNPM_VERSION",
        "POLLYCAR_BUILD_JAVA_VERSION",
        "POLLYCAR_BUILD_EAS_CLI_VERSION",
        "POLLYCAR_POSTGRES_TEST_IMAGE",
      ],
      migration: "build-profile",
    }),
    define({
      key: "infrastructure.sharedPreproductionApproval",
      category: "build",
      valueType: "structured-policy",
      exposure: "secret-reference",
      sensitivity: "L2",
      consumers: ["ci", "infrastructure"],
      profiles: ["shared-preproduction"],
      legacyNames: [
        "POLLYCAR_SHARED_PREPRODUCTION_APPLY_APPROVED",
        "POLLYCAR_SHARED_PREPRODUCTION_PLAN_DIGEST",
        "POLLYCAR_SHARED_PREPRODUCTION_APPLY_EVIDENCE",
      ],
      migration: "build-profile",
    }),
    define({
      key: "test.browserAcceptance",
      category: "test",
      valueType: "structured-policy",
      exposure: "private",
      sensitivity: "L1",
      consumers: ["app", "ci"],
      profiles: ["test"],
      legacyNames: [
        "POLLYCAR_APP_URL",
        "POLLYCAR_ANDROID_APP_URL",
        "POLLYCAR_ANDROID_CDP_URL",
      ],
      migration: "test-profile",
    }),
  ]);

export function getConfigurationDefinition(
  key: string,
): ConfigurationDefinition | undefined {
  return configurationCatalog.find((definition) => definition.key === key);
}

export function getConfigurationProfile(
  profile: ConfigurationProfile,
): ConfigurationProfileDefinition | undefined {
  return configurationProfiles.find((definition) => definition.id === profile);
}

export function getConfigurationDefinitionsForProfile(
  profile: ConfigurationProfile,
): readonly ConfigurationDefinition[] {
  return configurationCatalog.filter((definition) =>
    definition.profiles.includes(profile),
  );
}

export function findUnknownPollyCarEnvironmentVariables(
  environment: Readonly<Record<string, string | undefined>>,
): readonly string[] {
  const deprecatedNames = new Set(deprecatedConfigurationEnvironmentNames);
  const knownNames = new Set(
    configurationCatalog
      .flatMap((definition) => definition.legacyNames)
      .filter((name) => !deprecatedNames.has(name)),
  );
  return Object.keys(environment)
    .filter(isGovernedEnvironmentVariable)
    .filter((name) => !deprecatedNames.has(name))
    .filter((name) => !knownNames.has(name))
    .sort();
}

export function findDeprecatedConfigurationEnvironmentVariables(
  environment: Readonly<Record<string, string | undefined>>,
): readonly string[] {
  const deprecatedNames = new Set(deprecatedConfigurationEnvironmentNames);
  return Object.keys(environment)
    .filter((name) => deprecatedNames.has(name))
    .sort();
}

export function isForbiddenRawSecretEnvironmentVariable(
  name: string,
): boolean {
  if (name.endsWith("_REFERENCE")) return false;
  if (
    name === "POLLYCAR_AMAP_WEB_SERVICE_KEY" ||
    name === "POLLYCAR_AMAP_API_KEY" ||
    name === "POLLYCAR_VEHICLE_OCR_SECRET_ID" ||
    name === "POLLYCAR_VEHICLE_OCR_SECRET_KEY"
  ) {
    return true;
  }
  if (!name.startsWith("POLLYCAR_AUTH_")) return false;
  return /(?:SECRET|PRIVATE_KEY|ACCESS_KEY|ACCESS_TOKEN|TOKEN|PASSWORD)$/.test(
    name,
  );
}

export function createRedactedConfigurationSummary(
  values: Readonly<Record<string, unknown>>,
): readonly RedactedConfigurationSummaryEntry[] {
  return Object.keys(values)
    .sort()
    .map((key) => {
      const definition = getConfigurationDefinition(key);
      if (!definition) {
        throw new Error(`CONFIGURATION_KEY_UNKNOWN:${key}`);
      }
      const value = values[key];
      const configured =
        value !== undefined &&
        value !== null &&
        !(typeof value === "string" && value.trim().length === 0);
      return Object.freeze({
        key,
        sensitivity: definition.sensitivity,
        configured,
        ...(definition.sensitivity === "L0" ? { value } : {}),
      });
    });
}

export function validateConfigurationCatalog(
  catalog: readonly ConfigurationDefinition[],
): readonly string[] {
  const errors: string[] = [];
  const keys = new Set<string>();
  const legacyNames = new Set<string>();

  for (const definition of catalog) {
    if (keys.has(definition.key)) {
      errors.push(`CONFIGURATION_KEY_DUPLICATED:${definition.key}`);
    }
    keys.add(definition.key);

    for (const legacyName of definition.legacyNames) {
      if (legacyNames.has(legacyName)) {
        errors.push(`CONFIGURATION_LEGACY_NAME_DUPLICATED:${legacyName}`);
      }
      legacyNames.add(legacyName);
    }

    if (
      definition.exposure === "public" &&
      definition.sensitivity !== "L0"
    ) {
      errors.push(`PUBLIC_CONFIGURATION_MUST_BE_L0:${definition.key}`);
    }
    if (
      definition.exposure === "secret" &&
      definition.sensitivity !== "L3"
    ) {
      errors.push(`SECRET_CONFIGURATION_MUST_BE_L3:${definition.key}`);
    }
    if (
      definition.exposure === "secret-reference" &&
      definition.sensitivity !== "L2"
    ) {
      errors.push(`SECRET_REFERENCE_CONFIGURATION_MUST_BE_L2:${definition.key}`);
    }
  }

  return errors.sort();
}

export function validateConfigurationProfiles(
  profiles: readonly ConfigurationProfileDefinition[],
): readonly string[] {
  const errors: string[] = [];
  const ids = new Set<ConfigurationProfile>();

  for (const profile of profiles) {
    if (ids.has(profile.id)) {
      errors.push(`CONFIGURATION_PROFILE_DUPLICATED:${profile.id}`);
    }
    ids.add(profile.id);
    if (profile.allowsRawSecrets) {
      errors.push(`CONFIGURATION_PROFILE_RAW_SECRETS_FORBIDDEN:${profile.id}`);
    }
    if (
      profile.permitsRealCapabilities &&
      profile.id !== "production"
    ) {
      errors.push(
        `CONFIGURATION_PROFILE_REAL_CAPABILITIES_FORBIDDEN:${profile.id}`,
      );
    }
    if (
      profile.environment === "production" &&
      !profile.requiresHttpsPublicUrls
    ) {
      errors.push(`CONFIGURATION_PROFILE_HTTPS_REQUIRED:${profile.id}`);
    }
  }

  for (const profile of allProfiles) {
    if (!ids.has(profile)) {
      errors.push(`CONFIGURATION_PROFILE_MISSING:${profile}`);
    }
  }

  return errors.sort();
}

function syntheticAdminDefinitions(): readonly ConfigurationDefinition[] {
  const capabilities = [
    ["multiOrganization", "MULTI_ORGANIZATION"],
    ["authentication", "AUTHENTICATION"],
    ["roleAccessMatrix", "ROLE_ACCESS_MATRIX"],
    ["operatorManagement", "OPERATOR_MANAGEMENT"],
    ["driverVehicle", "DRIVER_VEHICLE"],
    ["tripOperations", "TRIP_OPERATIONS"],
    ["caseManagement", "CASE_MANAGEMENT"],
    ["financeOperations", "FINANCE_OPERATIONS"],
    ["executiveDashboard", "EXECUTIVE_DASHBOARD"],
    ["auditSystem", "AUDIT_SYSTEM"],
    ["dataReports", "DATA_REPORTS"],
    ["organizationAccounts", "ORGANIZATION_ACCOUNTS"],
  ] as const;

  return capabilities.map(([key, environmentSuffix]) =>
    define({
      key: `capabilities.syntheticAdmin.${key}`,
      category: "capability",
      valueType: "boolean",
      exposure: "public",
      sensitivity: "L0",
      consumers: ["admin", "server"],
      profiles: ["local-sandbox", "test", "demo"],
      legacyNames: [
        `POLLYCAR_SYNTHETIC_ADMIN_${environmentSuffix}`,
        `VITE_SYNTHETIC_ADMIN_${environmentSuffix}`,
      ],
      migration: "generated-public-config",
    }),
  );
}

function authenticationProviderDefinitions(): readonly ConfigurationDefinition[] {
  return [
    define({
      key: "server.providers.sms",
      category: "provider",
      valueType: "structured-policy",
      exposure: "secret-reference",
      sensitivity: "L2",
      consumers: ["server"],
      profiles: deployedProfiles,
      legacyNames: [
        "POLLYCAR_AUTH_SMS_PROVIDER_ID",
        "POLLYCAR_AUTH_SMS_API_BASE_URL",
        "POLLYCAR_AUTH_SMS_SECRET_REFERENCE",
        "POLLYCAR_AUTH_SMS_SENDER_APPROVAL_REFERENCE",
        "POLLYCAR_AUTH_SMS_TEMPLATE_APPROVAL_REFERENCE",
      ],
      migration: "secret-provider",
    }),
    define({
      key: "server.providers.identity",
      category: "provider",
      valueType: "structured-policy",
      exposure: "secret-reference",
      sensitivity: "L2",
      consumers: ["server"],
      profiles: deployedProfiles,
      legacyNames: [
        "POLLYCAR_AUTH_IDENTITY_PROVIDER_ID",
        "POLLYCAR_AUTH_IDENTITY_API_BASE_URL",
        "POLLYCAR_AUTH_IDENTITY_SECRET_REFERENCE",
        "POLLYCAR_AUTH_IDENTITY_DATA_PROCESSING_APPROVAL_REFERENCE",
        "POLLYCAR_AUTH_IDENTITY_BIOMETRIC_APPROVAL_REFERENCE",
      ],
      migration: "secret-provider",
    }),
    define({
      key: "server.providers.adminOidc",
      category: "provider",
      valueType: "structured-policy",
      exposure: "secret-reference",
      sensitivity: "L2",
      consumers: ["server"],
      profiles: deployedProfiles,
      legacyNames: [
        "POLLYCAR_AUTH_ADMIN_OIDC_ISSUER_URL",
        "POLLYCAR_AUTH_ADMIN_OIDC_CLIENT_ID",
        "POLLYCAR_AUTH_ADMIN_OIDC_CLIENT_SECRET_REFERENCE",
        "POLLYCAR_AUTH_ADMIN_OIDC_TENANT_APPROVAL_REFERENCE",
      ],
      migration: "secret-provider",
    }),
    define({
      key: "server.cryptography.keyReferences",
      category: "security",
      valueType: "structured-policy",
      exposure: "secret-reference",
      sensitivity: "L2",
      consumers: ["server"],
      profiles: deployedProfiles,
      legacyNames: [
        "POLLYCAR_AUTH_PHONE_ENCRYPTION_KEY_REFERENCE",
        "POLLYCAR_AUTH_PHONE_DIGEST_KEY_REFERENCE",
        "POLLYCAR_AUTH_OTP_HMAC_KEY_REFERENCE",
        "POLLYCAR_AUTH_SESSION_SIGNING_KEY_REFERENCE",
      ],
      migration: "secret-provider",
    }),
    define({
      key: "capabilities.authentication",
      category: "capability",
      valueType: "structured-policy",
      exposure: "private",
      sensitivity: "L2",
      consumers: ["server"],
      profiles: deployedProfiles,
      legacyNames: [
        "POLLYCAR_PRODUCTION_AUTHENTICATION_ENABLED",
        "POLLYCAR_REAL_PHONE_DATA_ENABLED",
        "POLLYCAR_REAL_SMS_DELIVERY_ENABLED",
        "POLLYCAR_REAL_IDENTITY_VERIFICATION_ENABLED",
        "POLLYCAR_REAL_BIOMETRIC_VERIFICATION_ENABLED",
        "POLLYCAR_REAL_ADMIN_ACCOUNTS_ENABLED",
      ],
      migration: "server-config",
    }),
  ];
}

function mapDefinitions(): readonly ConfigurationDefinition[] {
  return [
    define({
      key: "maps.web",
      category: "provider",
      valueType: "structured-policy",
      exposure: "public",
      sensitivity: "L0",
      consumers: ["app", "ci", "eas"],
      profiles: allProfiles,
      legacyNames: [
        "POLLYCAR_AMAP_WEB_JS_ENABLED",
        "POLLYCAR_AMAP_WEB_ENABLED",
        "POLLYCAR_AMAP_WEB_JS_API_KEY",
        "POLLYCAR_AMAP_WEB_JS_SECURITY_CODE",
        "EXPO_PUBLIC_POLLYCAR_AMAP_WEB_ENABLED",
        "EXPO_PUBLIC_POLLYCAR_AMAP_WEB_JS_API_KEY",
        "EXPO_PUBLIC_POLLYCAR_AMAP_WEB_JS_SECURITY_CODE",
      ],
      migration: "generated-public-config",
    }),
    define({
      key: "maps.native",
      category: "build",
      valueType: "structured-policy",
      exposure: "secret",
      sensitivity: "L3",
      consumers: ["app", "ci", "eas"],
      profiles: ["test", "demo", "production-readiness", "production"],
      legacyNames: [
        "POLLYCAR_AMAP_NATIVE_SDK_ENABLED",
        "POLLYCAR_AMAP_ANDROID_SDK_ENABLED",
        "POLLYCAR_AMAP_IOS_SDK_ENABLED",
        "POLLYCAR_AMAP_ANDROID_API_KEY",
        "POLLYCAR_AMAP_IOS_API_KEY",
      ],
      migration: "build-profile",
    }),
    define({
      key: "maps.native.dependencies",
      category: "build",
      valueType: "structured-policy",
      exposure: "build",
      sensitivity: "L1",
      consumers: ["app", "ci", "eas"],
      profiles: allProfiles,
      legacyNames: [
        "POLLYCAR_AMAP_ANDROID_DEPENDENCIES",
        "POLLYCAR_AMAP_ANDROID_MAVEN_COORDINATES",
        "POLLYCAR_AMAP_MAVEN_REPOSITORY",
        "POLLYCAR_AMAP_IOS_PODS",
      ],
      migration: "build-profile",
    }),
    define({
      key: "approvals.maps",
      category: "capability",
      valueType: "structured-policy",
      exposure: "secret-reference",
      sensitivity: "L2",
      consumers: ["app", "server", "ci", "eas"],
      profiles: ["demo", "shared-preproduction", "production-readiness", "production"],
      legacyNames: [
        "POLLYCAR_AMAP_EXTERNAL_APPROVAL_GRANTED",
        "POLLYCAR_AMAP_APPROVAL_REFERENCE",
        "EXPO_PUBLIC_POLLYCAR_AMAP_APPROVAL_REFERENCE",
        "POLLYCAR_AMAP_APPROVED_ANDROID_PACKAGE",
        "POLLYCAR_AMAP_APPROVED_IOS_BUNDLE_IDENTIFIER",
      ],
      migration: "build-profile",
    }),
    define({
      key: "server.providers.amapWebService",
      category: "provider",
      valueType: "structured-policy",
      exposure: "secret-reference",
      sensitivity: "L2",
      consumers: ["server"],
      profiles: allProfiles,
      legacyNames: [
        "POLLYCAR_AMAP_WEB_SERVICE_API_BASE_URL",
        "POLLYCAR_AMAP_WEB_SERVICE_KEY_REFERENCE",
        "POLLYCAR_AMAP_WEB_SERVICE_APPROVAL_REFERENCE",
        "POLLYCAR_AMAP_WEB_SERVICE_KEY",
        "POLLYCAR_AMAP_API_KEY",
      ],
      migration: "secret-provider",
    }),
  ];
}

function isGovernedEnvironmentVariable(name: string): boolean {
  return (
    name.startsWith("POLLYCAR_") ||
    name.startsWith("EXPO_PUBLIC_POLLYCAR_") ||
    name.startsWith("EXPO_PUBLIC_BRAND_") ||
    name.startsWith("VITE_ADMIN_") ||
    name.startsWith("VITE_SYNTHETIC_ADMIN_")
  );
}

function defineProfile(
  definition: ConfigurationProfileDefinition,
): ConfigurationProfileDefinition {
  return Object.freeze({ ...definition });
}
