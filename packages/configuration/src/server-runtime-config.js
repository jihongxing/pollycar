import {
  defaultFeatureGates,
  resolveFeatureGates,
} from "@pollycar/contracts";
import { assertNoDeprecatedConfigurationEnvironmentVariables } from "./deprecated-environment.js";

export const DEFAULT_MAXIMUM_JSON_BODY_BYTES = 256 * 1024;
export const DEFAULT_AUTHENTICATION_SECURITY_POLICY = Object.freeze({
  phoneChallengeTtlSeconds: 300,
  phoneChallengeMaximumAttempts: 5,
  phoneChallengeResendSeconds: 60,
  phoneChallengeHourlyLimit: 5,
  accountSessionTtlSeconds: 1_800,
  driverLivenessChallengeTtlSeconds: 300,
  driverLivenessAuthorizationTtlSeconds: 300,
  adminLoginMaximumAttempts: 5,
  adminAccountLockSeconds: 1_800,
  adminLoginChallengeTtlSeconds: 300,
  adminWorkIdentitySelectionTtlSeconds: 300,
  adminAccessSessionTtlSeconds: 900,
  adminIdleSessionTtlSeconds: 1_800,
  adminAbsoluteSessionTtlSeconds: 28_800,
  adminMfaFreshnessSeconds: 900,
});

const MANAGED_REFERENCE_PATTERN =
  /^(?:aws-secrets-manager|azure-key-vault|gcp-secret-manager|vault|secret):\/\//;

export function loadProductionReadinessServerConfig() {
  return getProductionReadinessServerConfig(process.env);
}

export function loadProductionAuthenticationReadinessConfig() {
  return getProductionAuthenticationReadinessConfig(process.env);
}

export function loadSandboxMigrationConfig() {
  return getSandboxMigrationConfig(process.env);
}

export function loadPostgresIntegrationTestConfig() {
  return getPostgresIntegrationTestConfig(process.env);
}

export function createProcessEnvironmentSecretProvider() {
  return createEnvironmentSecretProvider(process.env);
}

/**
 * @param {Readonly<Record<string, string | undefined>>} environment
 * @param {ReturnType<import("./index.js").getLocalSandboxProfile>} profile
 */
export function getLocalSandboxServerRuntimeConfig(environment, profile) {
  assertNoDeprecatedConfigurationEnvironmentVariables(environment);
  const databaseUrl = optionalValue(environment, "POLLYCAR_DATABASE_URL");
  if (databaseUrl) assertLocalPostgresUrl(databaseUrl);
  const fixedNow = optionalIsoDate(environment, "POLLYCAR_SANDBOX_NOW");

  return deepFreeze({
    environment: "internal-sandbox",
    profile: "local-sandbox",
    dataMode: "synthetic",
    featureGates: resolveFeatureGates({
      ...defaultFeatureGates,
      ...createLocalSandboxFeatureGates(profile.capabilities),
    }),
    persistence: {
      mode: databaseUrl ? "postgres" : "memory",
      ...(databaseUrl ? { databaseUrl } : {}),
    },
    http: {
      host: profile.network.host,
      port: profile.network.serverPort,
      allowedOrigins: [...profile.network.allowedOrigins],
      maximumJsonBodyBytes: readInteger(
        environment.POLLYCAR_HTTP_MAXIMUM_JSON_BODY_BYTES,
        DEFAULT_MAXIMUM_JSON_BODY_BYTES,
        "HTTP_MAXIMUM_JSON_BODY_BYTES_INVALID",
        16 * 1024,
        2 * 1024 * 1024,
        "HTTP_MAXIMUM_JSON_BODY_BYTES_OUT_OF_RANGE",
      ),
    },
    sandbox: {
      ...(fixedNow ? { fixedNow: fixedNow.toISOString() } : {}),
      executiveStateDirectory:
        optionalValue(environment, "POLLYCAR_EXECUTIVE_STATE_DIR") ??
        ".codex-runtime/admin-executive-dashboard",
      avatarObjectDirectory: ".data/internal-sandbox/avatar-objects",
    },
    observability: {
      serviceName:
        optionalValue(environment, "POLLYCAR_OTEL_SERVICE_NAME") ??
        "pollycar-server-local-sandbox",
      logLevel: readLogLevel(environment.POLLYCAR_LOG_LEVEL),
      exporter: "memory",
      redactHeaders: [
        "authorization",
        "cookie",
        "set-cookie",
        "x-api-key",
      ],
    },
    secrets: {
      provider: "disabled",
      rawVendorSecretsAllowed: false,
    },
    providers: {
      sms: { status: "unconfigured" },
      identity: { status: "unconfigured" },
      adminOidc: { status: "unconfigured", strategy: "pending_decision" },
      vehicleOcr: {
        status: "unconfigured",
        providerId: "tencent-cloud-ocr",
        apiBaseUrl: "https://ocr.tencentcloudapi.com",
      },
      amapWebService: {
        status: "unconfigured",
        apiBaseUrl: "https://restapi.amap.com",
      },
    },
    cryptography: { status: "unconfigured" },
    securityPolicies: createAuthenticationSecurityPolicies(environment),
  });
}

/**
 * Pure internal-sandbox config for tests and embedded callers.
 * @param {{
 *   port?: number;
 *   allowedOrigins?: readonly string[];
 *   databaseUrl?: string;
 *   featureGates?: Partial<import("@pollycar/contracts").FeatureGates>;
 *   maximumJsonBodyBytes?: number;
 *   amapWebService?: {
 *     apiBaseUrl?: string;
 *     keyReference: string;
 *   };
 * }} [overrides]
 */
export function createInternalSandboxServerConfig(overrides = {}) {
  if (overrides.databaseUrl) assertLocalPostgresUrl(overrides.databaseUrl);
  const maximumJsonBodyBytes =
    overrides.maximumJsonBodyBytes ?? DEFAULT_MAXIMUM_JSON_BODY_BYTES;
  assertPositiveInteger(
    maximumJsonBodyBytes,
    "HTTP_MAXIMUM_JSON_BODY_BYTES_INVALID",
  );
  assertRange(
    maximumJsonBodyBytes,
    16 * 1024,
    2 * 1024 * 1024,
    "HTTP_MAXIMUM_JSON_BODY_BYTES_OUT_OF_RANGE",
  );

  return deepFreeze({
    environment: "internal-sandbox",
    profile: "local-sandbox",
    dataMode: "synthetic",
    featureGates: resolveFeatureGates({
      ...defaultFeatureGates,
      ...overrides.featureGates,
    }),
    persistence: {
      mode: overrides.databaseUrl ? "postgres" : "memory",
      ...(overrides.databaseUrl
        ? { databaseUrl: overrides.databaseUrl }
        : {}),
    },
    http: {
      host: "127.0.0.1",
      port: overrides.port ?? 4321,
      allowedOrigins: [
        ...(overrides.allowedOrigins ?? [
          "http://127.0.0.1:4173",
          "http://127.0.0.1:8181",
        ]),
      ],
      maximumJsonBodyBytes,
    },
    sandbox: {
      executiveStateDirectory: ".codex-runtime/admin-executive-dashboard",
      avatarObjectDirectory: ".data/internal-sandbox/avatar-objects",
    },
    observability: {
      serviceName: "pollycar-server-local-sandbox",
      logLevel: "info",
      exporter: "memory",
      redactHeaders: [
        "authorization",
        "cookie",
        "set-cookie",
        "x-api-key",
      ],
    },
    secrets: {
      provider: "disabled",
      rawVendorSecretsAllowed: false,
    },
    providers: {
      sms: { status: "unconfigured" },
      identity: { status: "unconfigured" },
      adminOidc: { status: "unconfigured", strategy: "pending_decision" },
      vehicleOcr: {
        status: "unconfigured",
        providerId: "tencent-cloud-ocr",
        apiBaseUrl: "https://ocr.tencentcloudapi.com",
      },
      amapWebService: {
        ...(overrides.amapWebService
          ? {
              status: "configured_disabled",
              apiBaseUrl:
                overrides.amapWebService.apiBaseUrl ??
                "https://restapi.amap.com",
              keyReference: overrides.amapWebService.keyReference,
            }
          : {
              status: "unconfigured",
              apiBaseUrl: "https://restapi.amap.com",
            }),
      },
    },
    cryptography: { status: "unconfigured" },
    securityPolicies: createAuthenticationSecurityPolicies({}),
  });
}

/**
 * @param {Readonly<Record<string, string | undefined>>} environment
 */
export function getProductionReadinessServerConfig(environment) {
  assertNoDeprecatedConfigurationEnvironmentVariables(environment);
  const databaseUrl = requireValue(
    environment,
    "POLLYCAR_DATABASE_URL",
  );
  const database = parseUrl(
    databaseUrl,
    "POLLYCAR_DATABASE_URL",
  );
  const caCertificatePath = requireValue(
    environment,
    "POLLYCAR_PRODUCTION_DATABASE_CA_PATH",
  );
  if (!["postgres:", "postgresql:"].includes(database.protocol)) {
    throw new Error("PRODUCTION_DATABASE_MUST_BE_POSTGRES");
  }
  if (isLocalHostname(database.hostname)) {
    throw new Error("PRODUCTION_DATABASE_MUST_BE_REMOTE");
  }
  if (
    !["require", "verify-full"].includes(
      database.searchParams.get("sslmode") ?? "",
    )
  ) {
    throw new Error("PRODUCTION_DATABASE_TLS_REQUIRED");
  }

  const publicBaseUrl = requireHttpsUrl(
    requireValue(environment, "POLLYCAR_PRODUCTION_PUBLIC_BASE_URL"),
    "PRODUCTION_PUBLIC_BASE_URL_HTTPS_REQUIRED",
  );
  const allowedOrigins = requireValue(
    environment,
    "POLLYCAR_PRODUCTION_ALLOWED_ORIGINS",
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map(
      (origin) =>
        requireHttpsUrl(
          origin,
          "PRODUCTION_ALLOWED_ORIGIN_HTTPS_REQUIRED",
        ).origin,
    );
  if (allowedOrigins.length === 0) {
    throw new Error("PRODUCTION_ALLOWED_ORIGINS_REQUIRED");
  }

  const secretProviderReference = requireValue(
    environment,
    "POLLYCAR_SECRET_PROVIDER_REFERENCE",
  );
  validateManagedReference(
    secretProviderReference,
    "PRODUCTION_SECRET_PROVIDER_REFERENCE_INVALID",
  );
  assertNoRawVendorSecrets(environment);

  const otlpEndpoint = requireHttpsUrl(
    requireValue(environment, "POLLYCAR_OTLP_ENDPOINT"),
    "PRODUCTION_OTLP_HTTPS_REQUIRED",
  );
  const featureGates = resolveFeatureGates({
    ...defaultFeatureGates,
    internalSandbox: false,
  });
  if (Object.values(featureGates).some(Boolean)) {
    throw new Error("PRODUCTION_BUSINESS_CAPABILITIES_MUST_REMAIN_DISABLED");
  }
  const authentication = getProductionAuthenticationReadinessConfig(environment);
  const vehicleOcr = readIntegration(
    environment,
    {
      providerId: "POLLYCAR_VEHICLE_OCR_PROVIDER_ID",
      apiBaseUrl: "POLLYCAR_VEHICLE_OCR_API_BASE_URL",
      secretReference: "POLLYCAR_VEHICLE_OCR_SECRET_REFERENCE",
    },
    "PRODUCTION_PROVIDER_CONFIGURATION_INCOMPLETE",
  );
  const amapWebService = readIntegration(
    environment,
    {
      apiBaseUrl: "POLLYCAR_AMAP_WEB_SERVICE_API_BASE_URL",
      keyReference: "POLLYCAR_AMAP_WEB_SERVICE_KEY_REFERENCE",
      approvalReference: "POLLYCAR_AMAP_WEB_SERVICE_APPROVAL_REFERENCE",
    },
    "PRODUCTION_PROVIDER_CONFIGURATION_INCOMPLETE",
  );
  validateHttpsValue(
    vehicleOcr.apiBaseUrl,
    "PRODUCTION_VEHICLE_OCR_API_HTTPS_REQUIRED",
  );
  validateHttpsValue(
    amapWebService.apiBaseUrl,
    "PRODUCTION_AMAP_WEB_SERVICE_API_HTTPS_REQUIRED",
  );
  for (const reference of [
    vehicleOcr.secretReference,
    amapWebService.keyReference,
  ]) {
    if (reference) {
      validateManagedReference(
        reference,
        "PRODUCTION_PROVIDER_SECRET_REFERENCE_INVALID",
      );
    }
  }

  return deepFreeze({
    environment: "production",
    profile: "production-readiness",
    releaseMode: "infrastructure-readiness",
    featureGates,
    dataMode: "real-disabled",
    persistence: {
      mode: "postgres",
      databaseUrl,
      caCertificatePath,
      requireTls: true,
      maximumPoolSize: readInteger(
        environment.POLLYCAR_PRODUCTION_DATABASE_POOL_SIZE,
        10,
        "PRODUCTION_DATABASE_POOL_SIZE_INVALID",
      ),
      connectionTimeoutMilliseconds: readInteger(
        environment.POLLYCAR_PRODUCTION_DATABASE_TIMEOUT_MS,
        5_000,
        "PRODUCTION_DATABASE_TIMEOUT_INVALID",
      ),
    },
    http: {
      host: optionalValue(environment, "POLLYCAR_PRODUCTION_HOST") ?? "0.0.0.0",
      port: readInteger(
        environment.POLLYCAR_PRODUCTION_PORT,
        4310,
        "PRODUCTION_PORT_INVALID",
      ),
      publicBaseUrl: publicBaseUrl.origin,
      allowedOrigins: [...new Set(allowedOrigins)],
      trustedProxyHops: readInteger(
        environment.POLLYCAR_TRUSTED_PROXY_HOPS,
        1,
        "PRODUCTION_TRUSTED_PROXY_HOPS_INVALID",
      ),
      requireForwardedHttps: true,
      maximumJsonBodyBytes: readInteger(
        environment.POLLYCAR_HTTP_MAXIMUM_JSON_BODY_BYTES,
        DEFAULT_MAXIMUM_JSON_BODY_BYTES,
        "HTTP_MAXIMUM_JSON_BODY_BYTES_INVALID",
        16 * 1024,
        2 * 1024 * 1024,
        "HTTP_MAXIMUM_JSON_BODY_BYTES_OUT_OF_RANGE",
      ),
    },
    secrets: {
      provider: "managed",
      reference: secretProviderReference,
      rawVendorSecretsAllowed: false,
    },
    monitoring: {
      serviceName:
        optionalValue(environment, "POLLYCAR_OTEL_SERVICE_NAME") ??
        "pollycar-server",
      otlpEndpoint: otlpEndpoint.origin,
      logLevel: readLogLevel(environment.POLLYCAR_LOG_LEVEL),
      healthPaths: {
        live: "/health/live",
        ready: "/health/ready",
      },
      redactHeaders: [
        "authorization",
        "cookie",
        "set-cookie",
        "x-api-key",
      ],
    },
    providers: {
      sms: authentication.consumerPhone,
      identity: authentication.adultEligibility,
      adminOidc: authentication.adminWorkforce,
      vehicleOcr,
      amapWebService,
    },
    cryptography: authentication.cryptography,
    securityPolicies: createAuthenticationSecurityPolicies(environment),
    authentication,
  });
}

/**
 * @param {Readonly<Record<string, string | undefined>>} environment
 */
export function getProductionAuthenticationReadinessConfig(environment) {
  assertNoDeprecatedConfigurationEnvironmentVariables(environment);
  assertProductionAuthenticationDisabled(environment);
  assertNoRawAuthenticationSecrets(environment);

  const consumerPhone = readIntegration(environment, {
    providerId: "POLLYCAR_AUTH_SMS_PROVIDER_ID",
    apiBaseUrl: "POLLYCAR_AUTH_SMS_API_BASE_URL",
    secretReference: "POLLYCAR_AUTH_SMS_SECRET_REFERENCE",
    senderApprovalReference: "POLLYCAR_AUTH_SMS_SENDER_APPROVAL_REFERENCE",
    templateApprovalReference:
      "POLLYCAR_AUTH_SMS_TEMPLATE_APPROVAL_REFERENCE",
  });
  const adultEligibility = readIntegration(environment, {
    providerId: "POLLYCAR_AUTH_IDENTITY_PROVIDER_ID",
    apiBaseUrl: "POLLYCAR_AUTH_IDENTITY_API_BASE_URL",
    secretReference: "POLLYCAR_AUTH_IDENTITY_SECRET_REFERENCE",
    dataProcessingApprovalReference:
      "POLLYCAR_AUTH_IDENTITY_DATA_PROCESSING_APPROVAL_REFERENCE",
    biometricApprovalReference:
      "POLLYCAR_AUTH_IDENTITY_BIOMETRIC_APPROVAL_REFERENCE",
  });
  const adminWorkforce = readIntegration(environment, {
    issuerUrl: "POLLYCAR_AUTH_ADMIN_OIDC_ISSUER_URL",
    clientId: "POLLYCAR_AUTH_ADMIN_OIDC_CLIENT_ID",
    clientSecretReference:
      "POLLYCAR_AUTH_ADMIN_OIDC_CLIENT_SECRET_REFERENCE",
    tenantApprovalReference:
      "POLLYCAR_AUTH_ADMIN_OIDC_TENANT_APPROVAL_REFERENCE",
  });
  const cryptography = readIntegration(environment, {
    phoneEncryptionKeyReference:
      "POLLYCAR_AUTH_PHONE_ENCRYPTION_KEY_REFERENCE",
    phoneDigestKeyReference: "POLLYCAR_AUTH_PHONE_DIGEST_KEY_REFERENCE",
    otpHmacKeyReference: "POLLYCAR_AUTH_OTP_HMAC_KEY_REFERENCE",
    sessionSigningKeyReference:
      "POLLYCAR_AUTH_SESSION_SIGNING_KEY_REFERENCE",
  });

  validateHttpsValue(
    consumerPhone.apiBaseUrl,
    "PRODUCTION_SMS_API_HTTPS_REQUIRED",
  );
  validateHttpsValue(
    adultEligibility.apiBaseUrl,
    "PRODUCTION_IDENTITY_API_HTTPS_REQUIRED",
  );
  validateHttpsValue(
    adminWorkforce.issuerUrl,
    "PRODUCTION_ADMIN_OIDC_ISSUER_HTTPS_REQUIRED",
  );
  for (const reference of [
    consumerPhone.secretReference,
    adultEligibility.secretReference,
    adminWorkforce.clientSecretReference,
    cryptography.phoneEncryptionKeyReference,
    cryptography.phoneDigestKeyReference,
    cryptography.otpHmacKeyReference,
    cryptography.sessionSigningKeyReference,
  ]) {
    if (reference) {
      validateManagedReference(
        reference,
        "PRODUCTION_AUTHENTICATION_SECRET_REFERENCE_INVALID",
      );
    }
  }

  return deepFreeze({
    mode: "disabled",
    productionAuthenticationEnabled: false,
    realPhoneDataEnabled: false,
    realSmsDeliveryEnabled: false,
    realIdentityVerificationEnabled: false,
    realBiometricVerificationEnabled: false,
    realDriverLivenessVerificationEnabled: false,
    realAdminAccountsEnabled: false,
    consumerPhone,
    adultEligibility,
    adminWorkforce: {
      ...adminWorkforce,
      strategy:
        adminWorkforce.status === "configured_disabled"
          ? "managed_oidc"
          : "pending_decision",
    },
    cryptography,
  });
}

/**
 * @param {Readonly<Record<string, string | undefined>>} environment
 */
export function getSandboxMigrationConfig(environment) {
  assertNoDeprecatedConfigurationEnvironmentVariables(environment);
  const databaseUrl = optionalValue(environment, "POLLYCAR_DATABASE_URL");
  if (!databaseUrl) throw new Error("POLLYCAR_DATABASE_URL_REQUIRED");
  assertLocalPostgresUrl(databaseUrl);
  return deepFreeze({
    profile: "local-sandbox",
    databaseUrl,
  });
}

/**
 * @param {Readonly<Record<string, string | undefined>>} environment
 */
export function getPostgresIntegrationTestConfig(environment) {
  assertNoDeprecatedConfigurationEnvironmentVariables(environment);
  return deepFreeze({
    dispatchDatabaseUrl: optionalValue(
      environment,
      "POLLYCAR_DATABASE_URL",
    ),
    ledgerPrototypeDatabaseUrl: optionalValue(
      environment,
      "POLLYCAR_LEDGER_PROTOTYPE_DATABASE_URL",
    ),
    ledgerKernelDatabaseUrl: optionalValue(
      environment,
      "POLLYCAR_LEDGER_KERNEL_DATABASE_URL",
    ),
    ledgerResilienceDatabaseUrl: optionalValue(
      environment,
      "POLLYCAR_LEDGER_RESILIENCE_DATABASE_URL",
    ),
    ledgerTemplatesDatabaseUrl: optionalValue(
      environment,
      "POLLYCAR_LEDGER_TEMPLATES_DATABASE_URL",
    ),
    reconciliationDatabaseUrl: optionalValue(
      environment,
      "POLLYCAR_RECONCILIATION_DATABASE_URL",
    ),
    operatorFundsDatabaseUrl: optionalValue(
      environment,
      "POLLYCAR_OPERATOR_FUNDS_DATABASE_URL",
    ),
    ledgerResiliencePhase: optionalValue(
      environment,
      "POLLYCAR_LEDGER_RESILIENCE_PHASE",
    ),
  });
}

/**
 * @param {Readonly<Record<string, string | undefined>>} environment
 */
export function createEnvironmentSecretProvider(environment) {
  assertNoDeprecatedConfigurationEnvironmentVariables(environment);
  void environment;
  return Object.freeze({
    /**
     * @param {string} name
     */
    async read(name) {
      void name;
      throw new Error("ENVIRONMENT_SECRET_PROVIDER_DISABLED");
    },
  });
}

/**
 * @param {import("./index.js").LocalSandboxProfile["capabilities"]} capabilities
 * @returns {Partial<import("@pollycar/contracts").FeatureGates>}
 */
function createLocalSandboxFeatureGates(capabilities) {
  const financeEnabled = capabilities.syntheticAdminFinanceOperations;
  return {
    ...capabilities,
    syntheticFinancialLedger: financeEnabled,
    syntheticFinancialReconciliation: financeEnabled,
    syntheticOperatorFunds: financeEnabled,
  };
}

/**
 * @param {string} value
 */
function assertLocalPostgresUrl(value) {
  const url = parseUrl(value, "POLLYCAR_DATABASE_URL");
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("INTERNAL_SANDBOX_DATABASE_MUST_BE_POSTGRES");
  }
  if (!isLocalHostname(url.hostname)) {
    throw new Error("INTERNAL_SANDBOX_DATABASE_MUST_BE_LOCAL");
  }
}

/**
 * @param {Readonly<Record<string, string | undefined>>} environment
 * @param {string} name
 */
function optionalIsoDate(environment, name) {
  const value = optionalValue(environment, name);
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${name}_INVALID`);
  }
  return parsed;
}

/**
 * @param {Readonly<Record<string, string | undefined>>} environment
 * @param {string} name
 */
function optionalValue(environment, name) {
  return environment[name]?.trim() || undefined;
}

/**
 * @param {Readonly<Record<string, string | undefined>>} environment
 * @param {string} name
 */
function requireValue(environment, name) {
  const value = optionalValue(environment, name);
  if (!value) throw new Error(`PRODUCTION_CONFIGURATION_REQUIRED:${name}`);
  return value;
}

/**
 * @param {string} value
 * @param {string} name
 */
function parseUrl(value, name) {
  try {
    return new URL(value);
  } catch {
    throw new Error(`PRODUCTION_CONFIGURATION_URL_INVALID:${name}`);
  }
}

/**
 * @param {string} value
 * @param {string} errorCode
 */
function requireHttpsUrl(value, errorCode) {
  const url = parseUrl(value, errorCode);
  if (url.protocol !== "https:" || isLocalHostname(url.hostname)) {
    throw new Error(errorCode);
  }
  return url;
}

/**
 * @param {string} hostname
 */
function isLocalHostname(hostname) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".local")
  );
}

/**
 * @param {string | undefined} value
 * @param {number} fallback
 * @param {string} errorCode
 */
function readInteger(
  value,
  fallback,
  errorCode,
  minimum = 1,
  maximum = 65_535_000,
  rangeErrorCode = errorCode,
) {
  if (value === undefined || value.trim() === "") return fallback;
  if (!/^\d+$/.test(value)) throw new Error(errorCode);
  const parsed = Number(value);
  assertPositiveInteger(parsed, errorCode);
  assertRange(parsed, minimum, maximum, rangeErrorCode);
  return parsed;
}

/**
 * @param {number} value
 * @param {string} errorCode
 */
function assertPositiveInteger(value, errorCode) {
  if (!Number.isSafeInteger(value) || value < 1 || value > 65_535_000) {
    throw new Error(errorCode);
  }
}

/**
 * @param {number} value
 * @param {number} minimum
 * @param {number} maximum
 * @param {string} errorCode
 */
function assertRange(value, minimum, maximum, errorCode) {
  if (value < minimum || value > maximum) {
    throw new Error(errorCode);
  }
}

/**
 * @param {string | undefined} value
 * @returns {"info" | "warn" | "error"}
 */
function readLogLevel(value) {
  const normalized = value?.trim().toLowerCase() || "info";
  if (!["info", "warn", "error"].includes(normalized)) {
    throw new Error("PRODUCTION_LOG_LEVEL_INVALID");
  }
  return /** @type {"info" | "warn" | "error"} */ (normalized);
}

/**
 * @param {string} reference
 * @param {string} errorCode
 */
function validateManagedReference(reference, errorCode) {
  if (!MANAGED_REFERENCE_PATTERN.test(reference)) {
    throw new Error(errorCode);
  }
}

/**
 * @param {Readonly<Record<string, string | undefined>>} environment
 */
function assertNoRawVendorSecrets(environment) {
  for (const [name, value] of Object.entries(environment)) {
    if (!value || !name.startsWith("POLLYCAR_")) continue;
    if (
      name.endsWith("_REFERENCE") ||
      name.endsWith("_PATH") ||
      name.endsWith("_URL")
    ) {
      continue;
    }
    if (
      /(?:API_KEY|ACCESS_KEY|SECRET_KEY|PRIVATE_KEY|PASSWORD|TOKEN|KEY)$/.test(
        name,
      )
    ) {
      throw new Error(`PRODUCTION_RAW_VENDOR_SECRET_FORBIDDEN:${name}`);
    }
  }
}

/**
 * @param {Readonly<Record<string, string | undefined>>} environment
 * @param {Readonly<Record<string, string>>} fields
 */
function readIntegration(
  environment,
  fields,
  incompleteErrorCode = "PRODUCTION_AUTHENTICATION_CONFIGURATION_INCOMPLETE",
) {
  const entries = Object.entries(fields).map(([field, environmentName]) =>
    /** @type {[string, string | undefined, string]} */ ([
      field,
      optionalValue(environment, environmentName),
      environmentName,
    ])
  );
  const configured = entries.filter(([, value]) => value !== undefined);
  if (configured.length !== 0 && configured.length !== entries.length) {
    const missing = entries
      .filter(([, value]) => value === undefined)
      .map(([, , environmentName]) => environmentName);
    throw new Error(
      `${incompleteErrorCode}:${missing.join(",")}`,
    );
  }
  return {
    status:
      configured.length === entries.length
        ? "configured_disabled"
        : "unconfigured",
    ...Object.fromEntries(configured),
  };
}

/**
 * @param {Readonly<Record<string, string | undefined>>} environment
 */
function createAuthenticationSecurityPolicies(environment) {
  return {
    version: "authentication.v1",
    authentication: {
      phoneChallengeTtlSeconds: readInteger(
        environment.POLLYCAR_AUTH_PHONE_CHALLENGE_TTL_SECONDS,
        DEFAULT_AUTHENTICATION_SECURITY_POLICY.phoneChallengeTtlSeconds,
        "AUTHENTICATION_POLICY_INVALID",
        120,
        600,
        "AUTHENTICATION_POLICY_OUT_OF_RANGE",
      ),
      phoneChallengeMaximumAttempts: readInteger(
        environment.POLLYCAR_AUTH_PHONE_CHALLENGE_MAXIMUM_ATTEMPTS,
        DEFAULT_AUTHENTICATION_SECURITY_POLICY.phoneChallengeMaximumAttempts,
        "AUTHENTICATION_POLICY_INVALID",
        3,
        10,
        "AUTHENTICATION_POLICY_OUT_OF_RANGE",
      ),
      phoneChallengeResendSeconds: readInteger(
        environment.POLLYCAR_AUTH_PHONE_CHALLENGE_RESEND_SECONDS,
        DEFAULT_AUTHENTICATION_SECURITY_POLICY.phoneChallengeResendSeconds,
        "AUTHENTICATION_POLICY_INVALID",
        30,
        180,
        "AUTHENTICATION_POLICY_OUT_OF_RANGE",
      ),
      phoneChallengeHourlyLimit: readInteger(
        environment.POLLYCAR_AUTH_PHONE_CHALLENGE_HOURLY_LIMIT,
        DEFAULT_AUTHENTICATION_SECURITY_POLICY.phoneChallengeHourlyLimit,
        "AUTHENTICATION_POLICY_INVALID",
        3,
        10,
        "AUTHENTICATION_POLICY_OUT_OF_RANGE",
      ),
      accountSessionTtlSeconds: readInteger(
        environment.POLLYCAR_AUTH_ACCOUNT_SESSION_TTL_SECONDS,
        DEFAULT_AUTHENTICATION_SECURITY_POLICY.accountSessionTtlSeconds,
        "AUTHENTICATION_POLICY_INVALID",
        900,
        43_200,
        "AUTHENTICATION_POLICY_OUT_OF_RANGE",
      ),
      driverLivenessChallengeTtlSeconds: readInteger(
        environment.POLLYCAR_AUTH_DRIVER_LIVENESS_CHALLENGE_TTL_SECONDS,
        DEFAULT_AUTHENTICATION_SECURITY_POLICY.driverLivenessChallengeTtlSeconds,
        "AUTHENTICATION_POLICY_INVALID",
        60,
        300,
        "AUTHENTICATION_POLICY_OUT_OF_RANGE",
      ),
      driverLivenessAuthorizationTtlSeconds: readInteger(
        environment.POLLYCAR_AUTH_DRIVER_LIVENESS_AUTHORIZATION_TTL_SECONDS,
        DEFAULT_AUTHENTICATION_SECURITY_POLICY
          .driverLivenessAuthorizationTtlSeconds,
        "AUTHENTICATION_POLICY_INVALID",
        60,
        300,
        "AUTHENTICATION_POLICY_OUT_OF_RANGE",
      ),
      adminLoginMaximumAttempts: readInteger(
        environment.POLLYCAR_AUTH_ADMIN_LOGIN_MAXIMUM_ATTEMPTS,
        DEFAULT_AUTHENTICATION_SECURITY_POLICY.adminLoginMaximumAttempts,
        "AUTHENTICATION_POLICY_INVALID",
        3,
        10,
        "AUTHENTICATION_POLICY_OUT_OF_RANGE",
      ),
      adminAccountLockSeconds: readInteger(
        environment.POLLYCAR_AUTH_ADMIN_ACCOUNT_LOCK_SECONDS,
        DEFAULT_AUTHENTICATION_SECURITY_POLICY.adminAccountLockSeconds,
        "AUTHENTICATION_POLICY_INVALID",
        300,
        86_400,
        "AUTHENTICATION_POLICY_OUT_OF_RANGE",
      ),
      adminLoginChallengeTtlSeconds: readInteger(
        environment.POLLYCAR_AUTH_ADMIN_LOGIN_CHALLENGE_TTL_SECONDS,
        DEFAULT_AUTHENTICATION_SECURITY_POLICY.adminLoginChallengeTtlSeconds,
        "AUTHENTICATION_POLICY_INVALID",
        120,
        600,
        "AUTHENTICATION_POLICY_OUT_OF_RANGE",
      ),
      adminWorkIdentitySelectionTtlSeconds: readInteger(
        environment.POLLYCAR_AUTH_ADMIN_WORK_IDENTITY_SELECTION_TTL_SECONDS,
        DEFAULT_AUTHENTICATION_SECURITY_POLICY
          .adminWorkIdentitySelectionTtlSeconds,
        "AUTHENTICATION_POLICY_INVALID",
        120,
        600,
        "AUTHENTICATION_POLICY_OUT_OF_RANGE",
      ),
      adminAccessSessionTtlSeconds: readInteger(
        environment.POLLYCAR_AUTH_ADMIN_ACCESS_SESSION_TTL_SECONDS,
        DEFAULT_AUTHENTICATION_SECURITY_POLICY.adminAccessSessionTtlSeconds,
        "AUTHENTICATION_POLICY_INVALID",
        300,
        3_600,
        "AUTHENTICATION_POLICY_OUT_OF_RANGE",
      ),
      adminIdleSessionTtlSeconds: readInteger(
        environment.POLLYCAR_AUTH_ADMIN_IDLE_SESSION_TTL_SECONDS,
        DEFAULT_AUTHENTICATION_SECURITY_POLICY.adminIdleSessionTtlSeconds,
        "AUTHENTICATION_POLICY_INVALID",
        600,
        7_200,
        "AUTHENTICATION_POLICY_OUT_OF_RANGE",
      ),
      adminAbsoluteSessionTtlSeconds: readInteger(
        environment.POLLYCAR_AUTH_ADMIN_ABSOLUTE_SESSION_TTL_SECONDS,
        DEFAULT_AUTHENTICATION_SECURITY_POLICY.adminAbsoluteSessionTtlSeconds,
        "AUTHENTICATION_POLICY_INVALID",
        3_600,
        43_200,
        "AUTHENTICATION_POLICY_OUT_OF_RANGE",
      ),
      adminMfaFreshnessSeconds: readInteger(
        environment.POLLYCAR_AUTH_ADMIN_MFA_FRESHNESS_SECONDS,
        DEFAULT_AUTHENTICATION_SECURITY_POLICY.adminMfaFreshnessSeconds,
        "AUTHENTICATION_POLICY_INVALID",
        300,
        3_600,
        "AUTHENTICATION_POLICY_OUT_OF_RANGE",
      ),
    },
  };
}

/**
 * @param {Readonly<Record<string, string | undefined>>} environment
 */
function assertProductionAuthenticationDisabled(environment) {
  for (const name of [
    "POLLYCAR_PRODUCTION_AUTHENTICATION_ENABLED",
    "POLLYCAR_REAL_PHONE_DATA_ENABLED",
    "POLLYCAR_REAL_SMS_DELIVERY_ENABLED",
    "POLLYCAR_REAL_IDENTITY_VERIFICATION_ENABLED",
    "POLLYCAR_REAL_BIOMETRIC_VERIFICATION_ENABLED",
    "POLLYCAR_REAL_ADMIN_ACCOUNTS_ENABLED",
  ]) {
    if (environment[name]?.trim().toLowerCase() === "true") {
      throw new Error(`PRODUCTION_AUTHENTICATION_NOT_APPROVED:${name}`);
    }
  }
}

/**
 * @param {Readonly<Record<string, string | undefined>>} environment
 */
function assertNoRawAuthenticationSecrets(environment) {
  for (const [name, value] of Object.entries(environment)) {
    if (!value || !name.startsWith("POLLYCAR_AUTH_")) continue;
    if (name.endsWith("_REFERENCE") || name.endsWith("_CLIENT_ID")) continue;
    if (/(?:SECRET|PRIVATE_KEY|ACCESS_KEY|TOKEN)/.test(name)) {
      throw new Error(`PRODUCTION_AUTHENTICATION_RAW_SECRET_FORBIDDEN:${name}`);
    }
  }
}

/**
 * @param {string | undefined} value
 * @param {string} errorCode
 */
function validateHttpsValue(value, errorCode) {
  if (!value) return;
  const url = parseUrl(value, errorCode);
  if (url.protocol !== "https:" || isLocalHostname(url.hostname)) {
    throw new Error(errorCode);
  }
}

/**
 * @template T
 * @param {T} value
 * @returns {Readonly<T>}
 */
function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return /** @type {Readonly<T>} */ (value);
}
