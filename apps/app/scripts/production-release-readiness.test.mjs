import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  collectProductionReleaseFailures,
} from "./production-release-readiness.mjs";
import {
  BUILD_TOOLCHAIN,
  createAppPublicConfig,
  serializePublicConfig,
} from "@pollycar/configuration";

const productionEnvironment = {
  POLLYCAR_BUILD_NODE_VERSION: BUILD_TOOLCHAIN.node,
  POLLYCAR_BUILD_PNPM_VERSION: BUILD_TOOLCHAIN.pnpm,
  POLLYCAR_BUILD_JAVA_VERSION: BUILD_TOOLCHAIN.java,
  POLLYCAR_BUILD_EAS_CLI_VERSION: BUILD_TOOLCHAIN.easCli,
  POLLYCAR_RELEASE_APPROVAL_GRANTED: "true",
  POLLYCAR_PRODUCTION_API_APPROVED: "true",
  POLLYCAR_REAL_SMS_DELIVERY_APPROVED: "true",
  POLLYCAR_REAL_IDENTITY_APPROVED: "true",
  POLLYCAR_AMAP_EXTERNAL_APPROVAL_GRANTED: "true",
  POLLYCAR_ANDROID_SIGNING_MODE: "eas-managed",
  POLLYCAR_IOS_SIGNING_MODE: "eas-managed",
  EXPO_PUBLIC_POLLYCAR_PUBLIC_CONFIG: serializePublicConfig(
    createAppPublicConfig({
      profile: "production",
      apiBaseUrl: "https://api.pollycar.example",
      brandDisplayEnvironment: "production",
    }),
  ),
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
      expect.stringContaining("POLLYCAR_BUILD_NODE_VERSION"),
      expect.stringContaining("App PublicConfig"),
      expect.stringContaining("Android 包名"),
      expect.stringContaining("iOS Bundle Identifier"),
      expect.stringContaining("Expo slug"),
      expect.stringContaining("POLLYCAR_ANDROID_SIGNING_MODE"),
      expect.stringContaining("POLLYCAR_IOS_SIGNING_MODE"),
    ]));
  });

  it("拒绝非生产 PublicConfig", () => {
    expect(collectProductionReleaseFailures({
      config: productionConfig,
      environment: {
        ...productionEnvironment,
        EXPO_PUBLIC_POLLYCAR_PUBLIC_CONFIG: serializePublicConfig(
          createAppPublicConfig({
            profile: "demo",
            apiBaseUrl: "https://demo.pollycar.example",
            brandDisplayEnvironment: "demo",
          }),
        ),
      },
    })).toContain("App PublicConfig 必须使用 production Profile");
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
    expect(easJson.build.production.env.POLLYCAR_BUILD_PNPM_VERSION).toBe(
      BUILD_TOOLCHAIN.pnpm,
    );
  });
});
