import { defaultFeatureGates, resolveFeatureGates, type FeatureGates } from "@pollycar/contracts";

export interface ServerConfig {
  readonly environment: "internal-sandbox";
  readonly featureGates: FeatureGates;
  readonly dataMode: "synthetic";
  readonly persistence: Readonly<{
    mode: "memory" | "postgres";
    databaseUrl?: string;
  }>;
  readonly http: Readonly<{
    host: "127.0.0.1";
    port: number;
    allowedOrigins: readonly string[];
  }>;
}

export interface ProductionConfig {
  readonly environment: "production";
  readonly releaseMode: "infrastructure-readiness";
  readonly featureGates: FeatureGates;
  readonly dataMode: "real-disabled";
  readonly persistence: Readonly<{
    mode: "postgres";
    databaseUrl: string;
    caCertificatePath: string;
    requireTls: true;
    maximumPoolSize: number;
    connectionTimeoutMilliseconds: number;
  }>;
  readonly http: Readonly<{
    host: string;
    port: number;
    publicBaseUrl: string;
    allowedOrigins: readonly string[];
    trustedProxyHops: number;
    requireForwardedHttps: true;
  }>;
  readonly secrets: Readonly<{
    provider: "managed";
    reference: string;
    rawVendorSecretsAllowed: false;
  }>;
  readonly monitoring: Readonly<{
    serviceName: string;
    otlpEndpoint: string;
    logLevel: "info" | "warn" | "error";
    healthPaths: Readonly<{
      live: "/health/live";
      ready: "/health/ready";
    }>;
    redactHeaders: readonly string[];
  }>;
}

export function createInternalSandboxConfig(
  overrides: Readonly<{
    port?: number;
    allowedOrigins?: readonly string[];
    databaseUrl?: string;
    featureGates?: Partial<FeatureGates>;
  }> = {},
): ServerConfig {
  const databaseUrl = overrides.databaseUrl ?? process.env.POLLYCAR_DATABASE_URL;
  if (
    databaseUrl &&
    !databaseUrl.includes("localhost") &&
    !databaseUrl.includes("127.0.0.1")
  ) {
    throw new Error("INTERNAL_SANDBOX_DATABASE_MUST_BE_LOCAL");
  }
  return Object.freeze({
    environment: "internal-sandbox",
    featureGates: resolveFeatureGates({
      ...defaultFeatureGates,
      ...overrides.featureGates,
    }),
    dataMode: "synthetic",
    persistence: Object.freeze({
      mode: databaseUrl ? "postgres" : "memory",
      ...(databaseUrl ? { databaseUrl } : {}),
    }),
    http: Object.freeze({
      host: "127.0.0.1",
      port: overrides.port ?? 4310,
      allowedOrigins: Object.freeze(
        overrides.allowedOrigins ?? [
          "http://127.0.0.1:4173",
          "http://localhost:4173",
          "http://127.0.0.1:4174",
          "http://localhost:4174",
          "http://127.0.0.1:8081",
          "http://localhost:8081",
          "http://127.0.0.1:8181",
          "http://localhost:8181",
        ],
      ),
    }),
  });
}

export function createProductionConfig(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): ProductionConfig {
  const databaseUrl = requireEnvironmentValue(
    environment,
    "POLLYCAR_PRODUCTION_DATABASE_URL",
  );
  const database = parseUrl(databaseUrl, "POLLYCAR_PRODUCTION_DATABASE_URL");
  const caCertificatePath = requireEnvironmentValue(
    environment,
    "POLLYCAR_PRODUCTION_DATABASE_CA_PATH",
  );
  if (!["postgres:", "postgresql:"].includes(database.protocol)) {
    throw new Error("PRODUCTION_DATABASE_MUST_BE_POSTGRES");
  }
  if (isLocalHostname(database.hostname)) {
    throw new Error("PRODUCTION_DATABASE_MUST_BE_REMOTE");
  }
  if (!["require", "verify-full"].includes(database.searchParams.get("sslmode") ?? "")) {
    throw new Error("PRODUCTION_DATABASE_TLS_REQUIRED");
  }

  const publicBaseUrl = requireHttpsUrl(
    requireEnvironmentValue(environment, "POLLYCAR_PRODUCTION_PUBLIC_BASE_URL"),
    "PRODUCTION_PUBLIC_BASE_URL_HTTPS_REQUIRED",
  );
  const allowedOrigins = requireEnvironmentValue(
    environment,
    "POLLYCAR_PRODUCTION_ALLOWED_ORIGINS",
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) =>
      requireHttpsUrl(origin, "PRODUCTION_ALLOWED_ORIGIN_HTTPS_REQUIRED").origin
    );
  if (allowedOrigins.length === 0) {
    throw new Error("PRODUCTION_ALLOWED_ORIGINS_REQUIRED");
  }

  const secretProviderReference = requireEnvironmentValue(
    environment,
    "POLLYCAR_SECRET_PROVIDER_REFERENCE",
  );
  if (!/^(?:aws-secrets-manager|azure-key-vault|gcp-secret-manager|vault|secret):\/\//.test(
    secretProviderReference,
  )) {
    throw new Error("PRODUCTION_SECRET_PROVIDER_REFERENCE_INVALID");
  }
  assertNoRawVendorSecrets(environment);

  const otlpEndpoint = requireHttpsUrl(
    requireEnvironmentValue(environment, "POLLYCAR_OTLP_ENDPOINT"),
    "PRODUCTION_OTLP_HTTPS_REQUIRED",
  );
  const featureGates = resolveFeatureGates({
    ...defaultFeatureGates,
    internalSandbox: false,
  });
  if (Object.values(featureGates).some(Boolean)) {
    throw new Error("PRODUCTION_BUSINESS_CAPABILITIES_MUST_REMAIN_DISABLED");
  }

  return Object.freeze({
    environment: "production",
    releaseMode: "infrastructure-readiness",
    featureGates,
    dataMode: "real-disabled",
    persistence: Object.freeze({
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
    }),
    http: Object.freeze({
      host: environment.POLLYCAR_PRODUCTION_HOST?.trim() || "0.0.0.0",
      port: readInteger(
        environment.POLLYCAR_PRODUCTION_PORT,
        4310,
        "PRODUCTION_PORT_INVALID",
      ),
      publicBaseUrl: publicBaseUrl.origin,
      allowedOrigins: Object.freeze([...new Set(allowedOrigins)]),
      trustedProxyHops: readInteger(
        environment.POLLYCAR_TRUSTED_PROXY_HOPS,
        1,
        "PRODUCTION_TRUSTED_PROXY_HOPS_INVALID",
      ),
      requireForwardedHttps: true,
    }),
    secrets: Object.freeze({
      provider: "managed",
      reference: secretProviderReference,
      rawVendorSecretsAllowed: false,
    }),
    monitoring: Object.freeze({
      serviceName: environment.POLLYCAR_OTEL_SERVICE_NAME?.trim() || "pollycar-server",
      otlpEndpoint: otlpEndpoint.origin,
      logLevel: readLogLevel(environment.POLLYCAR_LOG_LEVEL),
      healthPaths: Object.freeze({
        live: "/health/live",
        ready: "/health/ready",
      }),
      redactHeaders: Object.freeze([
        "authorization",
        "cookie",
        "set-cookie",
        "x-api-key",
      ]),
    }),
  });
}

function requireEnvironmentValue(
  environment: Readonly<Record<string, string | undefined>>,
  name: string,
): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`PRODUCTION_CONFIGURATION_REQUIRED:${name}`);
  return value;
}

function parseUrl(value: string, name: string): URL {
  try {
    return new URL(value);
  } catch {
    throw new Error(`PRODUCTION_CONFIGURATION_URL_INVALID:${name}`);
  }
}

function requireHttpsUrl(value: string, errorCode: string): URL {
  const url = parseUrl(value, errorCode);
  if (url.protocol !== "https:" || isLocalHostname(url.hostname)) {
    throw new Error(errorCode);
  }
  return url;
}

function isLocalHostname(hostname: string): boolean {
  return hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".local");
}

function readInteger(
  value: string | undefined,
  fallback: number,
  errorCode: string,
): number {
  if (!value?.trim()) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(errorCode);
  return parsed;
}

function readLogLevel(value: string | undefined): "info" | "warn" | "error" {
  if (!value?.trim()) return "info";
  if (value === "info" || value === "warn" || value === "error") return value;
  throw new Error("PRODUCTION_LOG_LEVEL_INVALID");
}

function assertNoRawVendorSecrets(
  environment: Readonly<Record<string, string | undefined>>,
): void {
  for (const [name, value] of Object.entries(environment)) {
    if (
      value &&
      /^POLLYCAR_.*(?:API_KEY|ACCESS_KEY|SECRET_KEY|PRIVATE_KEY|TOKEN)$/.test(name)
    ) {
      throw new Error(`PRODUCTION_RAW_VENDOR_SECRET_FORBIDDEN:${name}`);
    }
  }
}
