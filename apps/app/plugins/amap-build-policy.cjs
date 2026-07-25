const INTERNAL_IDENTIFIER_PATTERN = /(?:^|\.)internal(?:\.|$)|(?:^|\.)sandbox(?:\.|$)/i;
const AMAP_ANDROID_COORDINATE_PATTERN = /^com\.amap\.api:[a-z0-9-]+:[A-Za-z0-9._-]+$/;

function readBoolean(environment, name) {
  return environment[name] === "true";
}

function requireValue(environment, name) {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`AMAP_BUILD_CONFIGURATION_REQUIRED:${name}`);
  return value;
}

function assertSecretBoundary(environment) {
  for (const name of Object.keys(environment)) {
    const isAmapPublicKey = /^EXPO_PUBLIC_.*AMAP.*KEY/i.test(name);
    const isApprovedWebJsKey =
      name === "EXPO_PUBLIC_POLLYCAR_AMAP_WEB_JS_API_KEY";
    if (isAmapPublicKey && !isApprovedWebJsKey && environment[name]) {
      throw new Error("AMAP_KEY_PUBLIC_ENV_FORBIDDEN");
    }
  }

  if (environment.EXPO_PUBLIC_POLLYCAR_AMAP_WEB_JS_API_KEY) {
    if (
      environment.EXPO_PUBLIC_POLLYCAR_AMAP_WEB_ENABLED !== "true" ||
      environment.POLLYCAR_AMAP_EXTERNAL_APPROVAL_GRANTED !== "true" ||
      !environment.EXPO_PUBLIC_POLLYCAR_AMAP_WEB_JS_SECURITY_CODE?.trim() ||
      !environment.EXPO_PUBLIC_POLLYCAR_AMAP_APPROVAL_REFERENCE?.trim()
    ) {
      throw new Error("AMAP_WEB_PRODUCTION_APPROVAL_REQUIRED");
    }
  }
}

function resolveAmapBuildPolicy(config, environment = process.env) {
  assertSecretBoundary(environment);

  const enabled = readBoolean(environment, "POLLYCAR_AMAP_NATIVE_SDK_ENABLED");
  if (!enabled) {
    return Object.freeze({
      enabled: false,
      androidEnabled: false,
      iosEnabled: false,
    });
  }

  if (!readBoolean(environment, "POLLYCAR_AMAP_EXTERNAL_APPROVAL_GRANTED")) {
    throw new Error("AMAP_SDK_PRODUCTION_APPROVAL_REQUIRED");
  }

  const approvalReference = requireValue(environment, "POLLYCAR_AMAP_APPROVAL_REFERENCE");
  const androidPackage = config.android?.package;
  const iosBundleIdentifier = config.ios?.bundleIdentifier;

  if (!androidPackage || !iosBundleIdentifier) {
    throw new Error("AMAP_APP_IDENTIFIER_REQUIRED");
  }
  if (
    INTERNAL_IDENTIFIER_PATTERN.test(androidPackage) ||
    INTERNAL_IDENTIFIER_PATTERN.test(iosBundleIdentifier)
  ) {
    throw new Error("AMAP_PRODUCTION_IDENTIFIER_REQUIRED");
  }

  const expectedAndroidPackage = requireValue(
    environment,
    "POLLYCAR_AMAP_APPROVED_ANDROID_PACKAGE",
  );
  const expectedIosBundleIdentifier = requireValue(
    environment,
    "POLLYCAR_AMAP_APPROVED_IOS_BUNDLE_IDENTIFIER",
  );
  if (androidPackage !== expectedAndroidPackage) {
    throw new Error("AMAP_ANDROID_PACKAGE_APPROVAL_MISMATCH");
  }
  if (iosBundleIdentifier !== expectedIosBundleIdentifier) {
    throw new Error("AMAP_IOS_BUNDLE_IDENTIFIER_APPROVAL_MISMATCH");
  }

  const androidEnabled = readBoolean(environment, "POLLYCAR_AMAP_ANDROID_SDK_ENABLED");
  const iosEnabled = readBoolean(environment, "POLLYCAR_AMAP_IOS_SDK_ENABLED");
  if (!androidEnabled && !iosEnabled) {
    throw new Error("AMAP_NATIVE_PLATFORM_REQUIRED");
  }

  const policy = {
    enabled: true,
    approvalReference,
    androidEnabled,
    iosEnabled,
    androidPackage,
    iosBundleIdentifier,
  };

  if (androidEnabled) {
    const androidApiKey = requireValue(environment, "POLLYCAR_AMAP_ANDROID_API_KEY");
    const coordinates = requireValue(
      environment,
      "POLLYCAR_AMAP_ANDROID_MAVEN_COORDINATES",
    )
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    if (coordinates.length === 0 || coordinates.some((item) => !AMAP_ANDROID_COORDINATE_PATTERN.test(item))) {
      throw new Error("AMAP_ANDROID_MAVEN_COORDINATES_INVALID");
    }
    Object.assign(policy, { androidApiKey, androidCoordinates: coordinates });
  }

  if (iosEnabled) {
    const iosApiKey = requireValue(environment, "POLLYCAR_AMAP_IOS_API_KEY");
    Object.assign(policy, {
      iosApiKey,
      iosPods: ["AMap3DMap-NO-IDFA", "AMapSearch-NO-IDFA"],
    });
  }

  return Object.freeze(policy);
}

module.exports = {
  resolveAmapBuildPolicy,
};
