import { parseAppPublicConfig } from "./public-config.js";
import { assertNoDeprecatedConfigurationEnvironmentVariables } from "./deprecated-environment.js";

export const BUILD_TOOLCHAIN = Object.freeze({
  node: "22",
  pnpm: "10.22.0",
  java: "17",
  easCli: "21.4.0",
  postgresImage: "postgres:17-alpine",
});

const POSTGRES_DATABASE_NAMES = Object.freeze([
  "POLLYCAR_DATABASE_URL",
  "POLLYCAR_LEDGER_PROTOTYPE_DATABASE_URL",
  "POLLYCAR_LEDGER_KERNEL_DATABASE_URL",
  "POLLYCAR_LEDGER_RESILIENCE_DATABASE_URL",
  "POLLYCAR_LEDGER_TEMPLATES_DATABASE_URL",
  "POLLYCAR_RECONCILIATION_DATABASE_URL",
  "POLLYCAR_OPERATOR_FUNDS_DATABASE_URL",
]);
const IMAGE_DIGEST_NAMES = Object.freeze([
  "POLLYCAR_NODE_IMAGE_DIGEST",
  "POLLYCAR_POSTGRES_IMAGE_DIGEST",
  "POLLYCAR_OTEL_COLLECTOR_IMAGE_DIGEST",
  "POLLYCAR_CADDY_IMAGE_DIGEST",
]);
const RAW_NATIVE_SECRET_NAMES = Object.freeze([
  "POLLYCAR_AMAP_ANDROID_API_KEY",
  "POLLYCAR_AMAP_IOS_API_KEY",
  "POLLYCAR_ANDROID_RELEASE_STORE_PASSWORD",
  "POLLYCAR_ANDROID_RELEASE_KEY_PASSWORD",
]);

/**
 * @param {{
 *   target: "native-ci" | "postgres-ci" | "production-release" | "container-evidence" | "container-publication";
 *   environment: Readonly<Record<string, string | undefined>>;
 *   appConfig?: Readonly<Record<string, any>>;
 * }} input
 */
export function collectBuildConfigurationFailures(input) {
  /** @type {string[]} */
  const failures = [];
  try {
    assertNoDeprecatedConfigurationEnvironmentVariables(input.environment);
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  }
  validateToolchain(input.environment, failures);

  if (input.target === "native-ci") {
    validateNativeCi(input.environment, failures);
  } else if (input.target === "postgres-ci") {
    validatePostgresCi(input.environment, failures);
  } else if (input.target === "production-release") {
    validateProductionRelease(input.environment, input.appConfig, failures);
  } else if (input.target === "container-publication") {
    validateContainerPublication(input.environment, failures);
  } else if (input.target !== "container-evidence") {
    failures.push(`未知构建校验目标：${input.target}`);
  }

  return failures;
}

/**
 * @param {{
 *   target: "native-ci" | "postgres-ci" | "production-release" | "container-evidence" | "container-publication";
 *   environment: Readonly<Record<string, string | undefined>>;
 *   appConfig?: Readonly<Record<string, any>>;
 * }} input
 */
export function assertBuildConfiguration(input) {
  const failures = collectBuildConfigurationFailures(input);
  if (failures.length > 0) {
    throw new Error(
      `统一构建配置门禁未通过：\n${failures.map((item) => `- ${item}`).join("\n")}`,
    );
  }
  return `统一构建配置门禁通过：${input.target}`;
}

/**
 * @param {Readonly<Record<string, string | undefined>>} environment
 * @param {string[]} failures
 */
function validateToolchain(environment, failures) {
  /** @type {readonly (readonly [string, string])[]} */
  const requirements = [
    ["POLLYCAR_BUILD_NODE_VERSION", BUILD_TOOLCHAIN.node],
    ["POLLYCAR_BUILD_PNPM_VERSION", BUILD_TOOLCHAIN.pnpm],
    ["POLLYCAR_BUILD_JAVA_VERSION", BUILD_TOOLCHAIN.java],
    ["POLLYCAR_BUILD_EAS_CLI_VERSION", BUILD_TOOLCHAIN.easCli],
  ];
  for (const [name, expected] of requirements) {
    if (environment[name] !== expected) {
      failures.push(`${name} 必须为 ${expected}`);
    }
  }
}

/**
 * @param {Readonly<Record<string, string | undefined>>} environment
 * @param {string[]} failures
 */
function validateNativeCi(environment, failures) {
  if (!["android", "ios"].includes(environment.POLLYCAR_NATIVE_PLATFORM ?? "")) {
    failures.push("POLLYCAR_NATIVE_PLATFORM 必须为 android 或 ios");
  }
  if (environment.POLLYCAR_NATIVE_RELEASE_UNSIGNED !== "true") {
    failures.push("原生 CI Release 必须显式声明无签名编译");
  }
  for (const name of RAW_NATIVE_SECRET_NAMES) {
    if (environment[name]?.trim()) {
      failures.push(`原生 CI 不得注入真实凭据：${name}`);
    }
  }
}

/**
 * @param {Readonly<Record<string, string | undefined>>} environment
 * @param {string[]} failures
 */
function validatePostgresCi(environment, failures) {
  if (environment.POLLYCAR_POSTGRES_TEST_IMAGE !== BUILD_TOOLCHAIN.postgresImage) {
    failures.push(
      `POLLYCAR_POSTGRES_TEST_IMAGE 必须为 ${BUILD_TOOLCHAIN.postgresImage}`,
    );
  }
  for (const name of POSTGRES_DATABASE_NAMES) {
    const value = environment[name]?.trim();
    if (!value) {
      failures.push(`缺少 PostgreSQL 集成测试配置：${name}`);
      continue;
    }
    try {
      const url = new URL(value);
      if (
        url.protocol !== "postgresql:" ||
        !["127.0.0.1", "localhost"].includes(url.hostname)
      ) {
        failures.push(`${name} 必须是本机 PostgreSQL URL`);
      }
    } catch {
      failures.push(`${name} 不是有效 PostgreSQL URL`);
    }
  }
}

/**
 * @param {Readonly<Record<string, string | undefined>>} environment
 * @param {Readonly<Record<string, any>> | undefined} appConfig
 * @param {string[]} failures
 */
function validateProductionRelease(environment, appConfig, failures) {
  for (const name of [
    "POLLYCAR_RELEASE_APPROVAL_GRANTED",
    "POLLYCAR_PRODUCTION_API_APPROVED",
    "POLLYCAR_REAL_SMS_DELIVERY_APPROVED",
    "POLLYCAR_REAL_IDENTITY_APPROVED",
    "POLLYCAR_AMAP_EXTERNAL_APPROVAL_GRANTED",
  ]) {
    if (environment[name] !== "true") failures.push(`缺少批准：${name}=true`);
  }

  try {
    const publicConfig = parseAppPublicConfig(
      environment.EXPO_PUBLIC_POLLYCAR_PUBLIC_CONFIG,
    );
    if (publicConfig.profile !== "production") {
      failures.push("App PublicConfig 必须使用 production Profile");
    }
  } catch {
    failures.push("缺少或无法解析生产 App PublicConfig");
  }

  const androidPackage = appConfig?.android?.package;
  const iosBundleIdentifier = appConfig?.ios?.bundleIdentifier;
  if (!androidPackage || isPlaceholderIdentifier(androidPackage)) {
    failures.push("Android 包名仍为占位或内部标识");
  }
  if (!iosBundleIdentifier || isPlaceholderIdentifier(iosBundleIdentifier)) {
    failures.push("iOS Bundle Identifier 仍为占位或内部标识");
  }
  if (!appConfig?.slug || /(?:internal|sandbox)/i.test(appConfig.slug)) {
    failures.push("Expo slug 不得包含 internal 或 sandbox");
  }

  const androidSigningMode = environment.POLLYCAR_ANDROID_SIGNING_MODE;
  if (!["local-keystore", "eas-managed"].includes(androidSigningMode ?? "")) {
    failures.push(
      "POLLYCAR_ANDROID_SIGNING_MODE 必须为 local-keystore 或 eas-managed",
    );
  } else if (androidSigningMode === "local-keystore") {
    for (const name of [
      "POLLYCAR_ANDROID_RELEASE_STORE_FILE",
      "POLLYCAR_ANDROID_RELEASE_STORE_PASSWORD",
      "POLLYCAR_ANDROID_RELEASE_KEY_ALIAS",
      "POLLYCAR_ANDROID_RELEASE_KEY_PASSWORD",
    ]) {
      if (!environment[name]?.trim()) {
        failures.push(`缺少 Android 发布签名配置：${name}`);
      }
    }
  }
  if (!["xcode-managed", "eas-managed"].includes(
    environment.POLLYCAR_IOS_SIGNING_MODE ?? "",
  )) {
    failures.push(
      "POLLYCAR_IOS_SIGNING_MODE 必须为 xcode-managed 或 eas-managed",
    );
  }
  validateNativeAmap(environment, appConfig, failures);
}

/**
 * @param {Readonly<Record<string, string | undefined>>} environment
 * @param {Readonly<Record<string, any>> | undefined} appConfig
 * @param {string[]} failures
 */
function validateNativeAmap(environment, appConfig, failures) {
  const enabled = environment.POLLYCAR_AMAP_NATIVE_SDK_ENABLED === "true";
  if (!enabled) {
    for (const name of [
      "POLLYCAR_AMAP_ANDROID_API_KEY",
      "POLLYCAR_AMAP_IOS_API_KEY",
    ]) {
      if (environment[name]?.trim()) {
        failures.push(`原生高德关闭时不得注入 Key：${name}`);
      }
    }
    return;
  }
  for (const name of [
    "POLLYCAR_AMAP_EXTERNAL_APPROVAL_GRANTED",
    "POLLYCAR_AMAP_APPROVAL_REFERENCE",
    "POLLYCAR_AMAP_APPROVED_ANDROID_PACKAGE",
    "POLLYCAR_AMAP_APPROVED_IOS_BUNDLE_IDENTIFIER",
  ]) {
    if (!environment[name]?.trim() || (
      name.endsWith("_GRANTED") && environment[name] !== "true"
    )) {
      failures.push(`缺少原生高德批准配置：${name}`);
    }
  }
  if (
    appConfig?.android?.package &&
    environment.POLLYCAR_AMAP_APPROVED_ANDROID_PACKAGE !==
      appConfig.android.package
  ) {
    failures.push("高德批准 Android 包名与生产应用标识不一致");
  }
  if (
    appConfig?.ios?.bundleIdentifier &&
    environment.POLLYCAR_AMAP_APPROVED_IOS_BUNDLE_IDENTIFIER !==
      appConfig.ios.bundleIdentifier
  ) {
    failures.push("高德批准 iOS Bundle Identifier 与生产应用标识不一致");
  }

  const androidEnabled =
    environment.POLLYCAR_AMAP_ANDROID_SDK_ENABLED === "true";
  const iosEnabled = environment.POLLYCAR_AMAP_IOS_SDK_ENABLED === "true";
  if (!androidEnabled && !iosEnabled) {
    failures.push("启用原生高德时至少选择一个平台");
  }
  if (androidEnabled) {
    if (!environment.POLLYCAR_AMAP_ANDROID_API_KEY?.trim()) {
      failures.push("缺少 Android 高德 Key");
    }
    const coordinates =
      environment.POLLYCAR_AMAP_ANDROID_MAVEN_COORDINATES?.split(",")
        .map((item) => item.trim())
        .filter(Boolean) ?? [];
    if (
      coordinates.length === 0 ||
      coordinates.some(
        (item) => !/^com\.amap\.api:[a-z0-9-]+:\d+\.\d+\.\d+$/i.test(item),
      )
    ) {
      failures.push("Android 高德 Maven 依赖版本无效");
    }
  }
  if (iosEnabled && !environment.POLLYCAR_AMAP_IOS_API_KEY?.trim()) {
    failures.push("缺少 iOS 高德 Key");
  }
}

/**
 * @param {Readonly<Record<string, string | undefined>>} environment
 * @param {string[]} failures
 */
function validateContainerPublication(environment, failures) {
  if (environment.POLLYCAR_IMAGE_PUBLICATION_APPROVED !== "true") {
    failures.push("缺少镜像发布批准");
  }
  if (!environment.POLLYCAR_IMAGE_REGISTRY?.trim()) {
    failures.push("缺少镜像仓库");
  }
  if (!environment.POLLYCAR_IMAGE_SIGNING_IDENTITY?.trim()) {
    failures.push("缺少镜像签名身份");
  }
  for (const name of IMAGE_DIGEST_NAMES) {
    const value = environment[name]?.trim();
    if (!value || !/^[a-z0-9./_-]+@sha256:[a-f0-9]{64}$/i.test(value)) {
      failures.push(`${name} 必须是不可变镜像 digest`);
    }
  }
}

/** @param {string} value */
function isPlaceholderIdentifier(value) {
  return /(?:yourcompany|internal|sandbox)/i.test(value);
}
