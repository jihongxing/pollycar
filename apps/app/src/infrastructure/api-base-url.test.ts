import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createAppPublicConfig,
  serializePublicConfig,
} from "@pollycar/configuration/public";
import { resolveApiBaseUrl } from "./api-base-url";

describe("resolveApiBaseUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("只接受构建 Profile 注入的地址", () => {
    vi.stubEnv(
      "EXPO_PUBLIC_POLLYCAR_PUBLIC_CONFIG",
      serializePublicConfig(
        createAppPublicConfig({
          profile: "test",
          apiBaseUrl: "http://127.0.0.1:5321",
          brandDisplayEnvironment: "sandbox",
        }),
      ),
    );
    expect(resolveApiBaseUrl()).toBe("http://127.0.0.1:5321");
  });

  it("缺失配置时失败关闭且不按浏览器端口猜测", () => {
    vi.stubEnv("EXPO_PUBLIC_POLLYCAR_PUBLIC_CONFIG", "");
    expect(() => resolveApiBaseUrl()).toThrow("PUBLIC_CONFIG_REQUIRED");
  });
});
