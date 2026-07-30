const PUBLIC_CONFIG_VERSION = 1;
const PROFILE_IDS = new Set([
  "local-sandbox",
  "test",
  "demo",
  "shared-preproduction",
  "production-readiness",
  "production",
]);
const ADMIN_CAPABILITY_NAMES = Object.freeze([
  "multiOrganization",
  "authentication",
  "roleAccessMatrix",
  "operatorManagement",
  "driverVehicle",
  "tripOperations",
  "caseManagement",
  "financeOperations",
  "executiveDashboard",
  "auditSystem",
  "dataReports",
  "organizationAccounts",
]);

/**
 * @param {{
 *   profile: import("./index.js").PublicConfigurationProfile;
 *   apiBaseUrl: string;
 *   capabilities?: Readonly<Record<string, boolean>>;
 * }} input
 * @returns {import("./index.js").AdminPublicConfig}
 */
export function createAdminPublicConfig(input) {
  const profile = assertProfile(input.profile);
  const apiBaseUrl = assertPublicApiBaseUrl(input.apiBaseUrl, profile);
  const source = input.capabilities ?? {};
  const capabilities = {
    multiOrganization: source.multiOrganization === true,
    authentication: source.authentication === true,
    roleAccessMatrix: source.roleAccessMatrix === true,
    operatorManagement: source.operatorManagement === true,
    driverVehicle: source.driverVehicle === true,
    tripOperations: source.tripOperations === true,
    caseManagement: source.caseManagement === true,
    financeOperations: source.financeOperations === true,
    executiveDashboard: source.executiveDashboard === true,
    auditSystem: source.auditSystem === true,
    dataReports: source.dataReports === true,
    organizationAccounts: source.organizationAccounts === true,
  };

  return deepFreeze({
    version: PUBLIC_CONFIG_VERSION,
    consumer: "admin",
    profile,
    apiBaseUrl,
    capabilities,
  });
}

/**
 * @param {{
 *   profile: import("./index.js").PublicConfigurationProfile;
 *   apiBaseUrl: string;
 *   brandDisplayEnvironment: "sandbox" | "demo" | "production";
 *   maps?: Readonly<{
 *     web?: Readonly<{
 *       enabled?: boolean;
 *       apiKey?: string;
 *       securityCode?: string;
 *     }>;
 *   }>;
 * }} input
 * @returns {import("./index.js").AppPublicConfig}
 */
export function createAppPublicConfig(input) {
  const profile = assertProfile(input.profile);
  const apiBaseUrl = assertPublicApiBaseUrl(input.apiBaseUrl, profile);
  const brandDisplayEnvironment = assertBrandDisplayEnvironment(
    input.brandDisplayEnvironment,
    profile,
  );
  const webMap = input.maps?.web;
  const webMapEnabled = webMap?.enabled === true;
  const apiKey = optionalTrimmedValue(webMap?.apiKey);
  const securityCode = optionalTrimmedValue(webMap?.securityCode);
  if (webMapEnabled && (!apiKey || !securityCode)) {
    throw new Error("APP_PUBLIC_WEB_MAP_CONFIGURATION_INCOMPLETE");
  }
  const web = webMapEnabled
    ? {
        enabled: true,
        apiKey: /** @type {string} */ (apiKey),
        securityCode: /** @type {string} */ (securityCode),
      }
    : { enabled: false };

  return deepFreeze({
    version: PUBLIC_CONFIG_VERSION,
    consumer: "app",
    profile,
    apiBaseUrl,
    brandDisplayEnvironment,
    maps: {
      web,
    },
  });
}

/**
 * @param {import("./index.js").AdminPublicConfig | import("./index.js").AppPublicConfig} value
 */
export function serializePublicConfig(value) {
  assertPublicConfigObject(value);
  return JSON.stringify(value);
}

/**
 * @param {Readonly<Record<string, string | undefined>>} environment
 * @param {"VITE_POLLYCAR_PUBLIC_CONFIG" | "EXPO_PUBLIC_POLLYCAR_PUBLIC_CONFIG"} variableName
 * @param {import("./index.js").AdminPublicConfig | import("./index.js").AppPublicConfig} config
 */
export function createPublicConfigEnvironment(
  environment,
  variableName,
  config,
) {
  const sanitized = Object.fromEntries(
    Object.entries(environment).filter(
      ([name, value]) =>
        typeof value === "string" &&
        !name.startsWith("VITE_") &&
        !name.startsWith("EXPO_PUBLIC_"),
    ),
  );
  return deepFreeze({
    ...sanitized,
    [variableName]: serializePublicConfig(config),
  });
}

/**
 * @param {string | undefined} serialized
 * @returns {import("./index.js").AdminPublicConfig}
 */
export function parseAdminPublicConfig(serialized) {
  const value = parseSerializedPublicConfig(serialized);
  if (value.consumer !== "admin") {
    throw new Error("ADMIN_PUBLIC_CONFIG_CONSUMER_INVALID");
  }
  return createAdminPublicConfig({
    profile: assertProfile(value.profile),
    apiBaseUrl: assertString(
      value.apiBaseUrl,
      "ADMIN_PUBLIC_CONFIG_INVALID",
    ),
    capabilities: assertBooleanRecord(
      value.capabilities,
      "ADMIN_PUBLIC_CONFIG_INVALID",
    ),
  });
}

/**
 * @param {string | undefined} serialized
 * @returns {import("./index.js").AppPublicConfig}
 */
export function parseAppPublicConfig(serialized) {
  const value = parseSerializedPublicConfig(serialized);
  if (value.consumer !== "app") {
    throw new Error("APP_PUBLIC_CONFIG_CONSUMER_INVALID");
  }
  const maps = assertObject(value.maps, "APP_PUBLIC_CONFIG_INVALID");
  const web = assertObject(maps.web, "APP_PUBLIC_CONFIG_INVALID");
  const apiKey = optionalString(web.apiKey);
  const securityCode = optionalString(web.securityCode);
  return createAppPublicConfig({
    profile: assertProfile(value.profile),
    apiBaseUrl: assertString(value.apiBaseUrl, "APP_PUBLIC_CONFIG_INVALID"),
    brandDisplayEnvironment: assertBrandDisplayEnvironment(
      value.brandDisplayEnvironment,
      assertProfile(value.profile),
    ),
    maps: {
      web:
        web.enabled === true
          ? {
              enabled: true,
              ...(apiKey ? { apiKey } : {}),
              ...(securityCode ? { securityCode } : {}),
            }
          : { enabled: false },
    },
  });
}

/**
 * @param {string | undefined} serialized
 * @returns {Record<string, unknown>}
 */
function parseSerializedPublicConfig(serialized) {
  if (!serialized?.trim()) throw new Error("PUBLIC_CONFIG_REQUIRED");
  let value;
  try {
    value = JSON.parse(serialized);
  } catch {
    throw new Error("PUBLIC_CONFIG_INVALID_JSON");
  }
  return assertPublicConfigObject(value);
}

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
function assertPublicConfigObject(value) {
  const object = assertObject(value, "PUBLIC_CONFIG_INVALID");
  if (object.version !== PUBLIC_CONFIG_VERSION) {
    throw new Error("PUBLIC_CONFIG_VERSION_UNSUPPORTED");
  }
  return object;
}

/**
 * @param {unknown} value
 * @param {string} errorCode
 * @returns {Record<string, unknown>}
 */
function assertObject(value, errorCode) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(errorCode);
  }
  return /** @type {Record<string, unknown>} */ (value);
}

/**
 * @param {unknown} value
 * @param {string} errorCode
 */
function assertString(value, errorCode) {
  if (typeof value !== "string") throw new Error(errorCode);
  return value;
}

/**
 * @param {unknown} value
 * @param {string} errorCode
 * @returns {Readonly<Record<string, boolean>>}
 */
function assertBooleanRecord(value, errorCode) {
  const object = assertObject(value, errorCode);
  if (Object.values(object).some((entry) => typeof entry !== "boolean")) {
    throw new Error(errorCode);
  }
  return /** @type {Readonly<Record<string, boolean>>} */ (object);
}

/**
 * @param {unknown} value
 * @returns {import("./index.js").PublicConfigurationProfile}
 */
function assertProfile(value) {
  if (typeof value !== "string" || !PROFILE_IDS.has(value)) {
    throw new Error("PUBLIC_CONFIG_PROFILE_INVALID");
  }
  return /** @type {import("./index.js").PublicConfigurationProfile} */ (value);
}

/**
 * @param {unknown} value
 * @param {import("./index.js").PublicConfigurationProfile} profile
 */
function assertPublicApiBaseUrl(value, profile) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("PUBLIC_CONFIG_API_BASE_URL_REQUIRED");
  }
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("PUBLIC_CONFIG_API_BASE_URL_INVALID");
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("PUBLIC_CONFIG_API_BASE_URL_INVALID");
  }
  if (
    ["shared-preproduction", "production-readiness", "production"].includes(
      profile,
    ) &&
    url.protocol !== "https:"
  ) {
    throw new Error("PUBLIC_CONFIG_API_BASE_URL_HTTPS_REQUIRED");
  }
  return url.origin;
}

/**
 * @param {unknown} value
 * @param {import("./index.js").PublicConfigurationProfile} profile
 * @returns {"sandbox" | "demo" | "production"}
 */
function assertBrandDisplayEnvironment(value, profile) {
  if (!["sandbox", "demo", "production"].includes(String(value))) {
    throw new Error("APP_PUBLIC_BRAND_ENVIRONMENT_INVALID");
  }
  if (profile === "production" && value !== "production") {
    throw new Error("APP_PUBLIC_BRAND_ENVIRONMENT_MISMATCH");
  }
  if (profile === "demo" && value !== "demo") {
    throw new Error("APP_PUBLIC_BRAND_ENVIRONMENT_MISMATCH");
  }
  return /** @type {"sandbox" | "demo" | "production"} */ (value);
}

/**
 * @param {unknown} value
 */
function optionalString(value) {
  return typeof value === "string" ? value : undefined;
}

/**
 * @param {unknown} value
 */
function optionalTrimmedValue(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/**
 * @template T
 * @param {T} value
 * @returns {T}
 */
function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}
