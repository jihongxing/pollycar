import { describe, expect, it } from "vitest";

import {
  configurationCatalog,
  configurationProfiles,
  createRedactedConfigurationSummary,
  deprecatedConfigurationEnvironmentNames,
  findDeprecatedConfigurationEnvironmentVariables,
  findUnknownPollyCarEnvironmentVariables,
  getConfigurationDefinition,
  getConfigurationDefinitionsForProfile,
  getConfigurationProfile,
  isForbiddenRawSecretEnvironmentVariable,
  validateConfigurationCatalog,
  validateConfigurationProfiles,
} from "./configuration-governance.js";

describe("统一配置契约", () => {
  it("配置目录不存在重复键、重复旧名或公开敏感配置", () => {
    expect(validateConfigurationCatalog(configurationCatalog)).toEqual([]);
    expect(validateConfigurationProfiles(configurationProfiles)).toEqual([]);
  });

  it("批次七后旧变量只用于审计并被明确拒绝", () => {
    expect(deprecatedConfigurationEnvironmentNames).toContain(
      "EXPO_PUBLIC_POLLYCAR_API_BASE_URL",
    );
    expect(deprecatedConfigurationEnvironmentNames).toContain(
      "POLLYCAR_PRODUCTION_DATABASE_URL",
    );
    expect(deprecatedConfigurationEnvironmentNames).toContain(
      "VITE_SYNTHETIC_ADMIN_AUTHENTICATION",
    );
    expect(
      findDeprecatedConfigurationEnvironmentVariables({
        POLLYCAR_DATABASE_URL: "postgresql://localhost/pollycar",
        POLLYCAR_PRODUCTION_DATABASE_URL: "deprecated",
        EXPO_PUBLIC_POLLYCAR_API_BASE_URL: "deprecated",
      }),
    ).toEqual([
      "EXPO_PUBLIC_POLLYCAR_API_BASE_URL",
      "POLLYCAR_PRODUCTION_DATABASE_URL",
    ]);
  });

  it("为公开、私有、密钥引用和策略配置提供明确边界", () => {
    expect(getConfigurationDefinition("public.apiBaseUrl")).toMatchObject({
      exposure: "public",
      sensitivity: "L0",
      consumers: ["admin", "app"],
    });
    expect(
      getConfigurationDefinition("server.persistence.databaseUrl"),
    ).toMatchObject({
      exposure: "secret",
      sensitivity: "L3",
      consumers: ["server", "ci"],
    });
    expect(
      getConfigurationDefinition("server.secrets.providerReference"),
    ).toMatchObject({
      exposure: "secret-reference",
      sensitivity: "L2",
      consumers: ["server", "infrastructure"],
    });
    expect(
      getConfigurationDefinition("securityPolicies.authentication"),
    ).toMatchObject({
      exposure: "policy",
      sensitivity: "L1",
      consumers: ["server"],
    });
  });

  it("识别未登记的 PollyCar 配置变量，同时忽略普通进程变量", () => {
    expect(
      findUnknownPollyCarEnvironmentVariables({
        PATH: "ignored",
        POLLYCAR_LOCAL_SANDBOX_SERVER_PORT: "4321",
        VITE_POLLYCAR_PUBLIC_CONFIG: "{}",
        POLLYCAR_PRODUCTION_DATABASE_URL: "deprecated",
        POLLYCAR_UNREGISTERED_SECRET: "must-be-rejected",
      }),
    ).toEqual(["POLLYCAR_UNREGISTERED_SECRET"]);
  });

  it("禁止通过环境变量传入生产认证原始密钥", () => {
    expect(
      isForbiddenRawSecretEnvironmentVariable("POLLYCAR_AUTH_SMS_ACCESS_TOKEN"),
    ).toBe(true);
    expect(
      isForbiddenRawSecretEnvironmentVariable(
        "POLLYCAR_AUTH_ADMIN_OIDC_CLIENT_SECRET",
      ),
    ).toBe(true);
    expect(
      isForbiddenRawSecretEnvironmentVariable(
        "POLLYCAR_AUTH_ADMIN_OIDC_CLIENT_SECRET_REFERENCE",
      ),
    ).toBe(false);
    expect(
      isForbiddenRawSecretEnvironmentVariable(
        "POLLYCAR_AMAP_WEB_SERVICE_KEY",
      ),
    ).toBe(true);
    expect(
      isForbiddenRawSecretEnvironmentVariable(
        "POLLYCAR_AMAP_WEB_SERVICE_KEY_REFERENCE",
      ),
    ).toBe(false);
    expect(
      isForbiddenRawSecretEnvironmentVariable(
        "POLLYCAR_VEHICLE_OCR_SECRET_KEY",
      ),
    ).toBe(true);
  });

  it("六类 Profile 明确生产和沙箱能力边界", () => {
    expect(configurationProfiles.map((profile) => profile.id)).toEqual([
      "local-sandbox",
      "test",
      "demo",
      "shared-preproduction",
      "production-readiness",
      "production",
    ]);
    expect(getConfigurationProfile("local-sandbox")).toMatchObject({
      permitsSyntheticCapabilities: true,
      permitsRealCapabilities: false,
      requiresHttpsPublicUrls: false,
      allowsRawSecrets: false,
    });
    expect(getConfigurationProfile("production-readiness")).toMatchObject({
      permitsSyntheticCapabilities: false,
      permitsRealCapabilities: false,
      requiresHttpsPublicUrls: true,
      allowsRawSecrets: false,
    });
    expect(getConfigurationProfile("production")).toMatchObject({
      permitsSyntheticCapabilities: false,
      permitsRealCapabilities: true,
      requiresHttpsPublicUrls: true,
      allowsRawSecrets: false,
    });
  });

  it("只返回适用于目标 Profile 的配置定义", () => {
    const readinessKeys = getConfigurationDefinitionsForProfile(
      "production-readiness",
    ).map((definition) => definition.key);

    expect(readinessKeys).toContain("server.http.publicBaseUrl");
    expect(readinessKeys).toContain("server.persistence.databaseUrl");
    expect(readinessKeys).not.toContain("sandbox.fixedNow");
    expect(readinessKeys).not.toContain(
      "capabilities.syntheticAdmin.authentication",
    );
  });

  it("脱敏摘要只展示 L0 值，其余等级仅展示是否已配置", () => {
    expect(
      createRedactedConfigurationSummary({
        "public.apiBaseUrl": "https://api.example.com",
        "server.observability.logLevel": "info",
        "server.secrets.providerReference": "vault://pollycar/production",
        "server.persistence.databaseUrl":
          "postgresql://pollycar:secret@example.com/pollycar",
      }),
    ).toEqual([
      {
        key: "public.apiBaseUrl",
        sensitivity: "L0",
        configured: true,
        value: "https://api.example.com",
      },
      {
        key: "server.observability.logLevel",
        sensitivity: "L1",
        configured: true,
      },
      {
        key: "server.persistence.databaseUrl",
        sensitivity: "L3",
        configured: true,
      },
      {
        key: "server.secrets.providerReference",
        sensitivity: "L2",
        configured: true,
      },
    ]);
  });
});
