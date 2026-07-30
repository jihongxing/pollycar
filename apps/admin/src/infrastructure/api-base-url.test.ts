import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createAdminPublicConfig,
  serializePublicConfig,
} from "@pollycar/configuration/public";
import { resolveAdminApiBaseUrl } from "./api-base-url";

describe("resolveAdminApiBaseUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("只接受构建 Profile 注入的地址", () => {
    vi.stubEnv(
      "VITE_POLLYCAR_PUBLIC_CONFIG",
      serializePublicConfig(
        createAdminPublicConfig({
          profile: "test",
          apiBaseUrl: "http://127.0.0.1:5321",
        }),
      ),
    );
    expect(resolveAdminApiBaseUrl()).toBe("http://127.0.0.1:5321");
  });

  it("缺失配置时失败关闭且不按浏览器端口猜测", () => {
    vi.stubEnv("VITE_POLLYCAR_PUBLIC_CONFIG", "");
    expect(() => resolveAdminApiBaseUrl()).toThrow(
      "PUBLIC_CONFIG_REQUIRED",
    );
  });
});
