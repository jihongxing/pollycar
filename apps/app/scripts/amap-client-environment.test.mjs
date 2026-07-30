import { describe, expect, it } from "vitest";
import { createAmapPublicConfig } from "./amap-client-environment.mjs";

describe("高德 Web 客户端构建环境", () => {
  it("默认不把 Key 注入客户端构建", () => {
    expect(createAmapPublicConfig({
      POLLYCAR_AMAP_WEB_JS_API_KEY: "private-key",
      POLLYCAR_AMAP_WEB_JS_SECURITY_CODE: "private-code",
    })).toEqual({ web: { enabled: false } });
  });

  it("只有显式启用和批准后才映射 Web JS Key", () => {
    expect(createAmapPublicConfig({
      POLLYCAR_AMAP_WEB_JS_ENABLED: "true",
      POLLYCAR_AMAP_EXTERNAL_APPROVAL_GRANTED: "true",
      POLLYCAR_AMAP_WEB_JS_API_KEY: "web-key",
      POLLYCAR_AMAP_WEB_JS_SECURITY_CODE: "web-code",
      POLLYCAR_AMAP_APPROVAL_REFERENCE: "approval-reference",
    })).toEqual({
      web: {
        enabled: true,
        apiKey: "web-key",
        securityCode: "web-code",
      },
    });
  });

  it("拒绝未经批准或缺少安全码的启用", () => {
    expect(() => createAmapPublicConfig({
      POLLYCAR_AMAP_WEB_JS_ENABLED: "true",
    })).toThrow("AMAP_WEB_PRODUCTION_APPROVAL_REQUIRED");
    expect(() => createAmapPublicConfig({
      POLLYCAR_AMAP_WEB_JS_ENABLED: "true",
      POLLYCAR_AMAP_EXTERNAL_APPROVAL_GRANTED: "true",
      POLLYCAR_AMAP_WEB_JS_API_KEY: "web-key",
      POLLYCAR_AMAP_APPROVAL_REFERENCE: "approval-reference",
    })).toThrow("AMAP_WEB_CONFIGURATION_REQUIRED");
  });
});
