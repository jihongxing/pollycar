import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  collectProductionReleaseFailures,
} from "./production-release-readiness.mjs";

const productionEnvironment = {
  POLLYCAR_RELEASE_APPROVAL_GRANTED: "true",
  POLLYCAR_PRODUCTION_API_APPROVED: "true",
  POLLYCAR_REAL_SMS_DELIVERY_APPROVED: "true",
  POLLYCAR_REAL_IDENTITY_APPROVED: "true",
  POLLYCAR_AMAP_EXTERNAL_APPROVAL_GRANTED: "true",
  POLLYCAR_ANDROID_SIGNING_MODE: "eas-managed",
  POLLYCAR_IOS_SIGNING_MODE: "eas-managed",
  EXPO_PUBLIC_POLLYCAR_API_BASE_URL: "https://api.pollycar.example",
  EXPO_PUBLIC_POLLYCAR_API_MODE: "production",
};

const productionConfig = {
  slug: "pollycar",
  android: {
    package: "com.pollycar.app",
  },
  ios: {
    bundleIdentifier: "com.pollycar.app",
  },
};

describe("生产发布门禁", () => {
  it("拒绝缺少批准、正式服务和正式应用标识的构建", () => {
    expect(collectProductionReleaseFailures({
      config: {
        slug: "pollycar-internal-sandbox",
        android: { package: "com.yourcompany.pollycar" },
        ios: { bundleIdentifier: "com.yourcompany.pollycar" },
      },
      environment: {},
    })).toEqual(expect.arrayContaining([
      expect.stringContaining("POLLYCAR_RELEASE_APPROVAL_GRANTED=true"),
      expect.stringContaining("EXPO_PUBLIC_POLLYCAR_API_BASE_URL"),
      expect.stringContaining("Android 包名"),
      expect.stringContaining("iOS Bundle Identifier"),
      expect.stringContaining("Expo slug"),
      expect.stringContaining("POLLYCAR_ANDROID_SIGNING_MODE"),
      expect.stringContaining("POLLYCAR_IOS_SIGNING_MODE"),
    ]));
  });

  it("拒绝本机、非 HTTPS 和非生产 API", () => {
    expect(collectProductionReleaseFailures({
      config: productionConfig,
      environment: {
        ...productionEnvironment,
        EXPO_PUBLIC_POLLYCAR_API_BASE_URL: "http://localhost:4321",
        EXPO_PUBLIC_POLLYCAR_API_MODE: "sandbox",
      },
    })).toEqual([
      "EXPO_PUBLIC_POLLYCAR_API_BASE_URL 必须是非本机 HTTPS 地址",
      "EXPO_PUBLIC_POLLYCAR_API_MODE 必须为 production",
    ]);
  });

  it("在所有外部批准、正式服务和正式标识齐备时通过", () => {
    expect(collectProductionReleaseFailures({
      config: productionConfig,
      environment: productionEnvironment,
    })).toEqual([]);
  });

  it("本地 Android 发布签名要求完整的独立凭据", () => {
    expect(collectProductionReleaseFailures({
      config: productionConfig,
      environment: {
        ...productionEnvironment,
        POLLYCAR_ANDROID_SIGNING_MODE: "local-keystore",
      },
    })).toEqual(expect.arrayContaining([
      expect.stringContaining("POLLYCAR_ANDROID_RELEASE_STORE_FILE"),
      expect.stringContaining("POLLYCAR_ANDROID_RELEASE_STORE_PASSWORD"),
      expect.stringContaining("POLLYCAR_ANDROID_RELEASE_KEY_ALIAS"),
      expect.stringContaining("POLLYCAR_ANDROID_RELEASE_KEY_PASSWORD"),
    ]));
  });
});

describe("生产构建入口", () => {
  it("Web、Android、iOS、EAS 和 CI 全部使用统一门禁", async () => {
    const packageJson = JSON.parse(await readFile(
      new URL("../package.json", import.meta.url),
      "utf8",
    ));
    const easJson = JSON.parse(await readFile(
      new URL("../eas.json", import.meta.url),
      "utf8",
    ));

    expect(packageJson.scripts["build:production"]).toContain("run-production-gated-command.mjs");
    expect(packageJson.scripts["android:production"]).toContain("run-production-gated-command.mjs");
    expect(packageJson.scripts["ios:production"]).toContain("run-production-gated-command.mjs");
    expect(packageJson.scripts["eas:production"]).toContain("run-production-gated-command.mjs");
    expect(packageJson.scripts["ci:production:gate"]).toBe(
      "node scripts/check-production-release-readiness.mjs",
    );
    expect(packageJson.scripts["eas-build-pre-install"]).toBe(
      "node scripts/check-production-build-hook.mjs",
    );
    expect(easJson.build.production.env.POLLYCAR_PRODUCTION_BUILD).toBe("true");
  });
});
