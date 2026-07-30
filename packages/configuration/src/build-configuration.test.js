import { describe, expect, it } from "vitest";
import {
  BUILD_TOOLCHAIN,
  collectBuildConfigurationFailures,
} from "./build-configuration.js";
import { createAppPublicConfig, serializePublicConfig } from "./public-config.js";

const toolchain = {
  POLLYCAR_BUILD_NODE_VERSION: BUILD_TOOLCHAIN.node,
  POLLYCAR_BUILD_PNPM_VERSION: BUILD_TOOLCHAIN.pnpm,
  POLLYCAR_BUILD_JAVA_VERSION: BUILD_TOOLCHAIN.java,
  POLLYCAR_BUILD_EAS_CLI_VERSION: BUILD_TOOLCHAIN.easCli,
};

describe("统一原生、CI 与供应链构建配置", () => {
  it("原生 CI 只允许无签名 Release 编译且拒绝真实凭据", () => {
    expect(collectBuildConfigurationFailures({
      target: "native-ci",
      environment: {
        ...toolchain,
        POLLYCAR_NATIVE_PLATFORM: "android",
        POLLYCAR_NATIVE_RELEASE_UNSIGNED: "true",
      },
    })).toEqual([]);
    expect(collectBuildConfigurationFailures({
      target: "native-ci",
      environment: {
        ...toolchain,
        POLLYCAR_NATIVE_PLATFORM: "android",
        POLLYCAR_NATIVE_RELEASE_UNSIGNED: "true",
        POLLYCAR_AMAP_ANDROID_API_KEY: "raw-key",
      },
    })).toContain(
      "原生 CI 不得注入真实凭据：POLLYCAR_AMAP_ANDROID_API_KEY",
    );
  });

  it("PostgreSQL CI 统一测试镜像和七套本机数据库", () => {
    const environment = {
      ...toolchain,
      POLLYCAR_POSTGRES_TEST_IMAGE: BUILD_TOOLCHAIN.postgresImage,
      POLLYCAR_DATABASE_URL: "postgresql://pollycar@127.0.0.1/dispatch",
      POLLYCAR_LEDGER_PROTOTYPE_DATABASE_URL:
        "postgresql://pollycar@127.0.0.1/prototype",
      POLLYCAR_LEDGER_KERNEL_DATABASE_URL:
        "postgresql://pollycar@127.0.0.1/kernel",
      POLLYCAR_LEDGER_RESILIENCE_DATABASE_URL:
        "postgresql://pollycar@127.0.0.1/resilience",
      POLLYCAR_LEDGER_TEMPLATES_DATABASE_URL:
        "postgresql://pollycar@127.0.0.1/templates",
      POLLYCAR_RECONCILIATION_DATABASE_URL:
        "postgresql://pollycar@127.0.0.1/reconciliation",
      POLLYCAR_OPERATOR_FUNDS_DATABASE_URL:
        "postgresql://pollycar@127.0.0.1/operator-funds",
    };
    expect(collectBuildConfigurationFailures({
      target: "postgres-ci",
      environment,
    })).toEqual([]);
  });

  it("生产发布只消费版本化 PublicConfig 并验证正式标识和签名模式", () => {
    const environment = {
      ...toolchain,
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
    expect(collectBuildConfigurationFailures({
      target: "production-release",
      environment,
      appConfig: {
        slug: "pollycar",
        android: { package: "com.pollycar.app" },
        ios: { bundleIdentifier: "com.pollycar.app" },
      },
    })).toEqual([]);
  });

  it("原生高德按批准应用标识、平台 Key 和依赖版本失败关闭", () => {
    const environment = {
      ...toolchain,
      POLLYCAR_RELEASE_APPROVAL_GRANTED: "true",
      POLLYCAR_PRODUCTION_API_APPROVED: "true",
      POLLYCAR_REAL_SMS_DELIVERY_APPROVED: "true",
      POLLYCAR_REAL_IDENTITY_APPROVED: "true",
      POLLYCAR_AMAP_EXTERNAL_APPROVAL_GRANTED: "true",
      POLLYCAR_ANDROID_SIGNING_MODE: "eas-managed",
      POLLYCAR_IOS_SIGNING_MODE: "eas-managed",
      POLLYCAR_AMAP_NATIVE_SDK_ENABLED: "true",
      POLLYCAR_AMAP_APPROVAL_REFERENCE: "approval://amap",
      POLLYCAR_AMAP_APPROVED_ANDROID_PACKAGE: "com.pollycar.app",
      POLLYCAR_AMAP_APPROVED_IOS_BUNDLE_IDENTIFIER: "com.pollycar.app",
      POLLYCAR_AMAP_ANDROID_SDK_ENABLED: "true",
      POLLYCAR_AMAP_ANDROID_API_KEY: "android-key",
      POLLYCAR_AMAP_ANDROID_MAVEN_COORDINATES:
        "com.amap.api:3dmap:11.2.0,com.amap.api:search:9.8.0",
      EXPO_PUBLIC_POLLYCAR_PUBLIC_CONFIG: serializePublicConfig(
        createAppPublicConfig({
          profile: "production",
          apiBaseUrl: "https://api.pollycar.example",
          brandDisplayEnvironment: "production",
        }),
      ),
    };
    expect(collectBuildConfigurationFailures({
      target: "production-release",
      environment,
      appConfig: {
        slug: "pollycar",
        android: { package: "com.pollycar.app" },
        ios: { bundleIdentifier: "com.pollycar.app" },
      },
    })).toEqual([]);
  });

  it("本地容器证据只要求统一固定工具链", () => {
    expect(collectBuildConfigurationFailures({
      target: "container-evidence",
      environment: toolchain,
    })).toEqual([]);
  });

  it("镜像发布要求四项不可变 digest、仓库、签名身份和批准", () => {
    const digest = `sha256:${"a".repeat(64)}`;
    expect(collectBuildConfigurationFailures({
      target: "container-publication",
      environment: {
        ...toolchain,
        POLLYCAR_IMAGE_PUBLICATION_APPROVED: "true",
        POLLYCAR_IMAGE_REGISTRY: "ghcr.io/pollycar",
        POLLYCAR_IMAGE_SIGNING_IDENTITY: "https://github.com/pollycar",
        POLLYCAR_NODE_IMAGE_DIGEST: `docker.io/library/node@${digest}`,
        POLLYCAR_POSTGRES_IMAGE_DIGEST: `docker.io/library/postgres@${digest}`,
        POLLYCAR_OTEL_COLLECTOR_IMAGE_DIGEST:
          `docker.io/otel/opentelemetry-collector-contrib@${digest}`,
        POLLYCAR_CADDY_IMAGE_DIGEST: `docker.io/library/caddy@${digest}`,
      },
    })).toEqual([]);
  });
});
