import { describe, expect, it } from "vitest";
import {
  createAdminPublicConfig,
  createAppPublicConfig,
  createPublicConfigEnvironment,
  parseAdminPublicConfig,
  parseAppPublicConfig,
  serializePublicConfig,
} from "./index.js";

describe("前端公开配置", () => {
  it("生成并解析版本化 Admin 白名单快照", () => {
    const config = createAdminPublicConfig({
      profile: "local-sandbox",
      apiBaseUrl: "http://127.0.0.1:4321/path",
      capabilities: {
        authentication: true,
        financeOperations: true,
        unknownCapability: true,
      },
    });

    expect(parseAdminPublicConfig(serializePublicConfig(config))).toEqual({
      version: 1,
      consumer: "admin",
      profile: "local-sandbox",
      apiBaseUrl: "http://127.0.0.1:4321",
      capabilities: expect.objectContaining({
        authentication: true,
        financeOperations: true,
      }),
    });
    expect(config.capabilities).not.toHaveProperty("unknownCapability");
  });

  it("生成 App 快照且不携带批准引用", () => {
    const config = createAppPublicConfig({
      profile: "production",
      apiBaseUrl: "https://api.pollycar.example/v1",
      brandDisplayEnvironment: "production",
      maps: {
        web: {
          enabled: true,
          apiKey: "public-web-key",
          securityCode: "public-security-code",
        },
      },
    });

    expect(parseAppPublicConfig(serializePublicConfig(config))).toEqual(config);
    expect(JSON.stringify(config)).not.toContain("approval");
  });

  it("拒绝 consumer 混用、未知版本和非 HTTPS 部署地址", () => {
    const admin = serializePublicConfig(
      createAdminPublicConfig({
        profile: "test",
        apiBaseUrl: "http://127.0.0.1:4321",
      }),
    );
    expect(() => parseAppPublicConfig(admin)).toThrow(
      "APP_PUBLIC_CONFIG_CONSUMER_INVALID",
    );
    expect(() =>
      parseAdminPublicConfig(
        JSON.stringify({
          version: 2,
          consumer: "admin",
          profile: "test",
          apiBaseUrl: "http://127.0.0.1:4321",
          capabilities: {},
        }),
      ),
    ).toThrow("PUBLIC_CONFIG_VERSION_UNSUPPORTED");
    expect(() =>
      createAppPublicConfig({
        profile: "production",
        apiBaseUrl: "http://api.pollycar.example",
        brandDisplayEnvironment: "production",
      }),
    ).toThrow("PUBLIC_CONFIG_API_BASE_URL_HTTPS_REQUIRED");
  });

  it("拒绝缺失快照和不完整 Web 地图配置", () => {
    expect(() => parseAdminPublicConfig(undefined)).toThrow(
      "PUBLIC_CONFIG_REQUIRED",
    );
    expect(() =>
      createAppPublicConfig({
        profile: "demo",
        apiBaseUrl: "http://127.0.0.1:4321",
        brandDisplayEnvironment: "demo",
        maps: { web: { enabled: true, apiKey: "key" } },
      }),
    ).toThrow("APP_PUBLIC_WEB_MAP_CONFIGURATION_INCOMPLETE");
  });

  it("构建环境只保留单一公开快照变量", () => {
    const config = createAppPublicConfig({
      profile: "test",
      apiBaseUrl: "http://127.0.0.1:4321",
      brandDisplayEnvironment: "sandbox",
    });
    const environment = createPublicConfigEnvironment(
      {
        PATH: "preserved",
      },
      "EXPO_PUBLIC_POLLYCAR_PUBLIC_CONFIG",
      config,
    );

    expect(environment.PATH).toBe("preserved");
    expect(environment.EXPO_PUBLIC_POLLYCAR_PUBLIC_CONFIG).toBe(
      serializePublicConfig(config),
    );
  });

});
