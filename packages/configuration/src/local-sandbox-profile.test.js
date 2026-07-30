import { describe, expect, it } from "vitest";
import {
  createLocalSandboxAdminEnvironment,
  createLocalSandboxAppEnvironment,
  createLocalSandboxLaunchManifest,
  getLocalSandboxProfile,
  getLocalSandboxServerConfig,
  parseAdminPublicConfig,
  parseAppPublicConfig,
} from "./index.js";

describe("local-sandbox profile", () => {
  it("统一三端地址、端口与 CORS 来源", () => {
    const profile = getLocalSandboxProfile();

    expect(profile.network).toEqual({
      host: "127.0.0.1",
      serverPort: 4321,
      adminPort: 4173,
      appPort: 8181,
      apiBaseUrl: "http://127.0.0.1:4321",
      adminUrl: "http://127.0.0.1:4173",
      appUrl: "http://127.0.0.1:8181",
      allowedOrigins: [
        "http://127.0.0.1:4173",
        "http://127.0.0.1:8181",
      ],
    });
  });

  it("由同一能力对象派生 Admin 与 Server 配置", () => {
    const profile = getLocalSandboxProfile();
    const admin = createLocalSandboxAdminEnvironment();
    const server = getLocalSandboxServerConfig();
    const publicConfig = parseAdminPublicConfig(
      admin.VITE_POLLYCAR_PUBLIC_CONFIG,
    );

    expect(server.featureGates).toMatchObject(profile.capabilities);
    expect(publicConfig.capabilities.authentication).toBe(true);
    expect(publicConfig.capabilities.driverVehicle).toBe(true);
    expect(publicConfig.capabilities.auditSystem).toBe(true);
  });

  it("保持所有真实能力关闭", () => {
    const featureGates = getLocalSandboxServerConfig().featureGates;
    for (const [name, enabled] of Object.entries(featureGates)) {
      if (
        name.startsWith("real") ||
        name.startsWith("external") ||
        name.startsWith("production")
      ) {
        expect(enabled, name).toBe(false);
      }
    }
  });

  it("只向各端输出允许公开的环境项", () => {
    const admin = createLocalSandboxAdminEnvironment();
    const app = createLocalSandboxAppEnvironment();

    expect(Object.keys(admin).every((name) => name.startsWith("VITE_"))).toBe(
      true,
    );
    expect(
      Object.keys(app).every(
        (name) =>
          name.startsWith("EXPO_PUBLIC_") ||
          name === "POLLYCAR_PRODUCTION_BUILD",
      ),
    ).toBe(true);
    expect(admin).not.toHaveProperty("POLLYCAR_EXECUTIVE_STATE_DIR");
    expect(app).not.toHaveProperty("POLLYCAR_EXECUTIVE_STATE_DIR");
  });

  it("支持 E2E 使用显式测试端口覆盖", () => {
    const manifest = createLocalSandboxLaunchManifest({
      POLLYCAR_LOCAL_SANDBOX_SERVER_PORT: "5321",
      POLLYCAR_LOCAL_SANDBOX_ADMIN_PORT: "5174",
      POLLYCAR_LOCAL_SANDBOX_APP_PORT: "9181",
    });

    expect(manifest.profile.network.apiBaseUrl).toBe(
      "http://127.0.0.1:5321",
    );
    expect(
      parseAdminPublicConfig(
        manifest.adminEnvironment.VITE_POLLYCAR_PUBLIC_CONFIG,
      ).apiBaseUrl,
    ).toBe(
      "http://127.0.0.1:5321",
    );
    expect(
      parseAppPublicConfig(
        manifest.appEnvironment.EXPO_PUBLIC_POLLYCAR_PUBLIC_CONFIG,
      ).apiBaseUrl,
    ).toBe(
      "http://127.0.0.1:5321",
    );
  });

  it("拒绝非法或重复端口", () => {
    expect(() =>
      getLocalSandboxProfile({
        POLLYCAR_LOCAL_SANDBOX_SERVER_PORT: "not-a-port",
      }),
    ).toThrow("POLLYCAR_LOCAL_SANDBOX_SERVER_PORT_INVALID");
    expect(() =>
      getLocalSandboxProfile({
        POLLYCAR_LOCAL_SANDBOX_SERVER_PORT: "4173",
      }),
    ).toThrow("LOCAL_SANDBOX_PORTS_MUST_BE_DISTINCT");
  });

  it("返回深度冻结的只读配置", () => {
    const manifest = createLocalSandboxLaunchManifest();

    expect(Object.isFrozen(manifest)).toBe(true);
    expect(Object.isFrozen(manifest.profile.network)).toBe(true);
    expect(Object.isFrozen(manifest.profile.network.allowedOrigins)).toBe(true);
    expect(Object.isFrozen(manifest.serverEnvironment)).toBe(true);
  });
});
