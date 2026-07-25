export type WebAmapConfiguration = Readonly<{
  apiKey: string;
  securityCode: string;
  approvalReference: string;
}>;

export type WebAmapLngLat = Readonly<{
  getLat(): number;
  getLng(): number;
}>;

export type WebAmapMap = Readonly<{
  destroy(): void;
  getCenter(): WebAmapLngLat;
  getZoom(): number;
  off(eventName: string, listener: (event?: unknown) => void): void;
  on(eventName: string, listener: (event?: unknown) => void): void;
  resize(): void;
  setCenter(center: readonly [number, number]): void;
}>;

export type WebAmapNamespace = Readonly<{
  Map: new (
    container: HTMLElement,
    options: Readonly<{
      center: readonly [number, number];
      dragEnable: boolean;
      jogEnable: boolean;
      pitchEnable: boolean;
      rotateEnable: boolean;
      viewMode: "2D";
      zoom: number;
      zoomEnable: boolean;
    }>,
  ) => WebAmapMap;
}>;

type WebAmapWindow = Window &
  typeof globalThis & {
    AMap?: WebAmapNamespace;
    _AMapSecurityConfig?: Readonly<{
      securityJsCode: string;
    }>;
  };

let pendingLoad: Promise<WebAmapNamespace> | undefined;

export function resolveWebAmapConfiguration(
  environment: Readonly<Record<string, string | undefined>> = {
    EXPO_PUBLIC_POLLYCAR_AMAP_WEB_ENABLED:
      process.env.EXPO_PUBLIC_POLLYCAR_AMAP_WEB_ENABLED,
    EXPO_PUBLIC_POLLYCAR_AMAP_WEB_JS_API_KEY:
      process.env.EXPO_PUBLIC_POLLYCAR_AMAP_WEB_JS_API_KEY,
    EXPO_PUBLIC_POLLYCAR_AMAP_WEB_JS_SECURITY_CODE:
      process.env.EXPO_PUBLIC_POLLYCAR_AMAP_WEB_JS_SECURITY_CODE,
    EXPO_PUBLIC_POLLYCAR_AMAP_APPROVAL_REFERENCE:
      process.env.EXPO_PUBLIC_POLLYCAR_AMAP_APPROVAL_REFERENCE,
  },
): WebAmapConfiguration | undefined {
  if (environment.EXPO_PUBLIC_POLLYCAR_AMAP_WEB_ENABLED !== "true") return undefined;

  const apiKey = environment.EXPO_PUBLIC_POLLYCAR_AMAP_WEB_JS_API_KEY?.trim();
  const securityCode =
    environment.EXPO_PUBLIC_POLLYCAR_AMAP_WEB_JS_SECURITY_CODE?.trim();
  const approvalReference =
    environment.EXPO_PUBLIC_POLLYCAR_AMAP_APPROVAL_REFERENCE?.trim();
  if (!apiKey || !securityCode || !approvalReference) return undefined;

  return { apiKey, securityCode, approvalReference };
}

export function buildWebAmapScriptUrl(apiKey: string): string {
  return `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(apiKey)}`;
}

export function ensureWebAmapContainerLayout(container: HTMLElement): void {
  container.style.position = "absolute";
  container.style.inset = "0";
  container.style.width = "100%";
  container.style.height = "100%";
  container.style.overflow = "hidden";
}

export function loadWebAmapSdk(
  configuration: WebAmapConfiguration,
  browserWindow: WebAmapWindow = window as WebAmapWindow,
  browserDocument: Document = document,
): Promise<WebAmapNamespace> {
  if (browserWindow.AMap) return Promise.resolve(browserWindow.AMap);
  if (pendingLoad) return pendingLoad;

  browserWindow._AMapSecurityConfig = {
    securityJsCode: configuration.securityCode,
  };

  pendingLoad = new Promise<WebAmapNamespace>((resolve, reject) => {
    const existingScript = browserDocument.querySelector<HTMLScriptElement>(
      'script[data-pollycar-amap="web-js-v2"]',
    );
    const script = existingScript ?? browserDocument.createElement("script");

    const finish = () => {
      if (browserWindow.AMap) {
        resolve(browserWindow.AMap);
        return;
      }
      pendingLoad = undefined;
      reject(new Error("AMAP_WEB_SDK_UNAVAILABLE"));
    };
    const fail = () => {
      pendingLoad = undefined;
      script.remove();
      reject(new Error("AMAP_WEB_SDK_LOAD_FAILED"));
    };

    script.addEventListener("load", finish, { once: true });
    script.addEventListener("error", fail, { once: true });
    if (!existingScript) {
      script.async = true;
      script.dataset.pollycarAmap = "web-js-v2";
      script.referrerPolicy = "strict-origin-when-cross-origin";
      script.src = buildWebAmapScriptUrl(configuration.apiKey);
      browserDocument.head.append(script);
    }
  });

  return pendingLoad;
}

export function resetWebAmapLoaderForTest(): void {
  pendingLoad = undefined;
}
