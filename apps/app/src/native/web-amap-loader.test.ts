import { afterEach, describe, expect, it } from "vitest";

import {
  buildWebAmapScriptUrl,
  ensureWebAmapContainerLayout,
  loadWebAmapSdk,
  resetWebAmapLoaderForTest,
  resolveWebAmapConfiguration,
  type WebAmapNamespace,
} from "./web-amap-loader";

afterEach(() => resetWebAmapLoaderForTest());

describe("resolveWebAmapConfiguration", () => {
  it("默认保持 Web 高德能力关闭", () => {
    expect(resolveWebAmapConfiguration({})).toBeUndefined();
  });

  it("只有显式启用且配置完整时才返回配置", () => {
    expect(
      resolveWebAmapConfiguration({
        EXPO_PUBLIC_POLLYCAR_AMAP_WEB_ENABLED: "true",
        EXPO_PUBLIC_POLLYCAR_AMAP_WEB_JS_API_KEY: "client-key",
        EXPO_PUBLIC_POLLYCAR_AMAP_WEB_JS_SECURITY_CODE: "security-code",
        EXPO_PUBLIC_POLLYCAR_AMAP_APPROVAL_REFERENCE: "approval",
      }),
    ).toEqual({
      apiKey: "client-key",
      securityCode: "security-code",
      approvalReference: "approval",
    });
  });

  it("缺少安全码或批准引用时失败关闭", () => {
    expect(
      resolveWebAmapConfiguration({
        EXPO_PUBLIC_POLLYCAR_AMAP_WEB_ENABLED: "true",
        EXPO_PUBLIC_POLLYCAR_AMAP_WEB_JS_API_KEY: "client-key",
      }),
    ).toBeUndefined();
  });
});

describe("loadWebAmapSdk", () => {
  it("在脚本请求前设置安全码并对并发加载去重", async () => {
    const listeners = new Map<string, () => void>();
    const script = {
      addEventListener: (name: string, listener: () => void) => listeners.set(name, listener),
      async: false,
      dataset: {} as Record<string, string>,
      referrerPolicy: "",
      remove: () => undefined,
      src: "",
    };
    const amap = { Map: class {} } as unknown as WebAmapNamespace;
    const browserWindow = {} as Window & typeof globalThis & {
      AMap?: WebAmapNamespace;
      _AMapSecurityConfig?: { securityJsCode: string };
    };
    const browserDocument = {
      createElement: () => script,
      head: {
        append: () => {
          browserWindow.AMap = amap;
          listeners.get("load")?.();
        },
      },
      querySelector: () => null,
    } as unknown as Document;
    const configuration = {
      apiKey: "client-key",
      securityCode: "security-code",
      approvalReference: "approval",
    };

    const first = loadWebAmapSdk(configuration, browserWindow, browserDocument);
    const second = loadWebAmapSdk(configuration, browserWindow, browserDocument);

    await expect(first).resolves.toBe(amap);
    await expect(second).resolves.toBe(amap);
    expect(browserWindow._AMapSecurityConfig).toEqual({
      securityJsCode: "security-code",
    });
    expect(script.src).toBe(buildWebAmapScriptUrl("client-key"));
  });
});

describe("ensureWebAmapContainerLayout", () => {
  it("为高德画布保留完整父容器尺寸", () => {
    const container = { style: {} } as HTMLElement;

    ensureWebAmapContainerLayout(container);

    expect(container.style).toMatchObject({
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      overflow: "hidden",
    });
  });
});
