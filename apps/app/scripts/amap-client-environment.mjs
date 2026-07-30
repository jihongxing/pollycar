export function createAmapPublicConfig(environment) {
  if (environment.POLLYCAR_AMAP_WEB_JS_ENABLED !== "true") {
    return { web: { enabled: false } };
  }
  if (environment.POLLYCAR_AMAP_EXTERNAL_APPROVAL_GRANTED !== "true") {
    throw new Error("AMAP_WEB_PRODUCTION_APPROVAL_REQUIRED");
  }

  requireValue(
    environment,
    "POLLYCAR_AMAP_APPROVAL_REFERENCE",
  );
  return {
    web: {
      enabled: true,
      apiKey: requireValue(environment, "POLLYCAR_AMAP_WEB_JS_API_KEY"),
      securityCode: requireValue(
        environment,
        "POLLYCAR_AMAP_WEB_JS_SECURITY_CODE",
      ),
    },
  };
}

function requireValue(environment, name) {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`AMAP_WEB_CONFIGURATION_REQUIRED:${name}`);
  return value;
}
