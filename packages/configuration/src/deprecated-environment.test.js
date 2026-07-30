import { describe, expect, it } from "vitest";

import {
  assertNoDeprecatedConfigurationEnvironmentVariables,
  DEPRECATED_CONFIGURATION_ENVIRONMENT_NAMES,
} from "./index.js";

describe("批次七废弃配置入口", () => {
  it("拒绝旧公开变量、测试端口别名和生产数据库别名", () => {
    expect(() =>
      assertNoDeprecatedConfigurationEnvironmentVariables({
        EXPO_PUBLIC_POLLYCAR_API_BASE_URL: "http://127.0.0.1:4321",
        POLLYCAR_E2E_SERVER_PORT: "4321",
        POLLYCAR_PRODUCTION_DATABASE_URL: "postgresql://deprecated",
      }),
    ).toThrow(
      "DEPRECATED_CONFIGURATION_ENVIRONMENT_VARIABLE:EXPO_PUBLIC_POLLYCAR_API_BASE_URL,POLLYCAR_E2E_SERVER_PORT,POLLYCAR_PRODUCTION_DATABASE_URL",
    );
  });

  it("保留唯一正式入口", () => {
    expect(DEPRECATED_CONFIGURATION_ENVIRONMENT_NAMES).not.toContain(
      "EXPO_PUBLIC_POLLYCAR_PUBLIC_CONFIG",
    );
    expect(DEPRECATED_CONFIGURATION_ENVIRONMENT_NAMES).not.toContain(
      "POLLYCAR_DATABASE_URL",
    );
    expect(() =>
      assertNoDeprecatedConfigurationEnvironmentVariables({
        EXPO_PUBLIC_POLLYCAR_PUBLIC_CONFIG: "{}",
        POLLYCAR_DATABASE_URL: "postgresql://localhost/pollycar",
        POLLYCAR_LOCAL_SANDBOX_SERVER_PORT: "4321",
      }),
    ).not.toThrow();
  });
});
