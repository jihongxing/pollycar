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
