const PUBLIC_AMAP_NAMES = [
  "EXPO_PUBLIC_POLLYCAR_AMAP_WEB_ENABLED",
  "EXPO_PUBLIC_POLLYCAR_AMAP_WEB_JS_API_KEY",
  "EXPO_PUBLIC_POLLYCAR_AMAP_WEB_JS_SECURITY_CODE",
  "EXPO_PUBLIC_POLLYCAR_AMAP_APPROVAL_REFERENCE",
];

export function createAmapClientEnvironment(environment) {
  const next = { ...environment };
  for (const name of PUBLIC_AMAP_NAMES) {
    next[name] = "";
  }

  if (environment.POLLYCAR_AMAP_WEB_JS_ENABLED !== "true") {
    return next;
  }
  if (environment.POLLYCAR_AMAP_EXTERNAL_APPROVAL_GRANTED !== "true") {
    throw new Error("AMAP_WEB_PRODUCTION_APPROVAL_REQUIRED");
  }

  next.EXPO_PUBLIC_POLLYCAR_AMAP_WEB_ENABLED = "true";
  next.EXPO_PUBLIC_POLLYCAR_AMAP_WEB_JS_API_KEY = requireValue(
    environment,
    "POLLYCAR_AMAP_WEB_JS_API_KEY",
  );
  next.EXPO_PUBLIC_POLLYCAR_AMAP_WEB_JS_SECURITY_CODE = requireValue(
    environment,
    "POLLYCAR_AMAP_WEB_JS_SECURITY_CODE",
  );
  next.EXPO_PUBLIC_POLLYCAR_AMAP_APPROVAL_REFERENCE = requireValue(
    environment,
    "POLLYCAR_AMAP_APPROVAL_REFERENCE",
  );
  return next;
}

function requireValue(environment, name) {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`AMAP_WEB_CONFIGURATION_REQUIRED:${name}`);
  return value;
}
