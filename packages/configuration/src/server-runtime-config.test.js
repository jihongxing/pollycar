import { describe, expect, it } from "vitest";
import {
  DEFAULT_MAXIMUM_JSON_BODY_BYTES,
  createEnvironmentSecretProvider,
  createInternalSandboxServerConfig,
  getLocalSandboxProfile,
  getLocalSandboxServerRuntimeConfig,
  getProductionAuthenticationReadinessConfig,
  getPostgresIntegrationTestConfig,
  getProductionReadinessServerConfig,
  getSandboxMigrationConfig,
} from "./index.js";

const productionEnvironment = Object.freeze({
  POLLYCAR_DATABASE_URL:
    "postgresql://pollycar@db.pollycar.example:5432/pollycar?sslmode=require",
  POLLYCAR_PRODUCTION_DATABASE_CA_PATH: "/run/secrets/postgres-ca.crt",
  POLLYCAR_PRODUCTION_PUBLIC_BASE_URL: "https://api.pollycar.example",
  POLLYCAR_PRODUCTION_ALLOWED_ORIGINS:
    "https://app.pollycar.example,https://admin.pollycar.example",
  POLLYCAR_SECRET_PROVIDER_REFERENCE: "vault://pollycar/production",
  POLLYCAR_OTLP_ENDPOINT: "https://otel.pollycar.example",
});

const productionProviderEnvironment = Object.freeze({
  POLLYCAR_AUTH_SMS_PROVIDER_ID: "sms-candidate",
  POLLYCAR_AUTH_SMS_API_BASE_URL: "https://sms.example.com",
  POLLYCAR_AUTH_SMS_SECRET_REFERENCE: "vault://pollycar/sms",
  POLLYCAR_AUTH_SMS_SENDER_APPROVAL_REFERENCE: "approval://sms-sender",
  POLLYCAR_AUTH_SMS_TEMPLATE_APPROVAL_REFERENCE: "approval://sms-template",
  POLLYCAR_AUTH_IDENTITY_PROVIDER_ID: "identity-candidate",
  POLLYCAR_AUTH_IDENTITY_API_BASE_URL: "https://identity.example.com",
  POLLYCAR_AUTH_IDENTITY_SECRET_REFERENCE: "vault://pollycar/identity",
  POLLYCAR_AUTH_IDENTITY_DATA_PROCESSING_APPROVAL_REFERENCE:
    "approval://identity-data",
  POLLYCAR_AUTH_IDENTITY_BIOMETRIC_APPROVAL_REFERENCE:
    "approval://identity-biometric",
  POLLYCAR_AUTH_ADMIN_OIDC_ISSUER_URL: "https://login.example.com",
  POLLYCAR_AUTH_ADMIN_OIDC_CLIENT_ID: "pollycar-admin",
  POLLYCAR_AUTH_ADMIN_OIDC_CLIENT_SECRET_REFERENCE:
    "vault://pollycar/admin-oidc",
  POLLYCAR_AUTH_ADMIN_OIDC_TENANT_APPROVAL_REFERENCE:
    "approval://admin-tenant",
  POLLYCAR_AUTH_PHONE_ENCRYPTION_KEY_REFERENCE:
    "vault://pollycar/phone-encryption",
  POLLYCAR_AUTH_PHONE_DIGEST_KEY_REFERENCE: "vault://pollycar/phone-digest",
  POLLYCAR_AUTH_OTP_HMAC_KEY_REFERENCE: "vault://pollycar/otp-hmac",
  POLLYCAR_AUTH_SESSION_SIGNING_KEY_REFERENCE:
    "vault://pollycar/session-signing",
  POLLYCAR_VEHICLE_OCR_PROVIDER_ID: "tencent-cloud-ocr",
  POLLYCAR_VEHICLE_OCR_API_BASE_URL: "https://ocr.tencentcloudapi.com",
  POLLYCAR_VEHICLE_OCR_SECRET_REFERENCE: "vault://pollycar/vehicle-ocr",
  POLLYCAR_AMAP_WEB_SERVICE_API_BASE_URL: "https://restapi.amap.com",
  POLLYCAR_AMAP_WEB_SERVICE_KEY_REFERENCE:
    "vault://pollycar/amap-web-service",
  POLLYCAR_AMAP_WEB_SERVICE_APPROVAL_REFERENCE:
    "approval://amap-web-service",
});

describe("Server runtime configuration", () => {
  it("从 local-sandbox Profile 派生网络、数据库、状态和 HTTP 策略", () => {
    const profile = getLocalSandboxProfile();
    const config = getLocalSandboxServerRuntimeConfig(
      {
        POLLYCAR_DATABASE_URL:
          "postgresql://pollycar@127.0.0.1:5432/pollycar",
        POLLYCAR_SANDBOX_NOW: "2026-07-30T00:00:00.000Z",
        POLLYCAR_EXECUTIVE_STATE_DIR: "D:/runtime/executive",
        POLLYCAR_HTTP_MAXIMUM_JSON_BODY_BYTES: "131072",
      },
      profile,
    );

    expect(config).toMatchObject({
      profile: "local-sandbox",
      persistence: {
        mode: "postgres",
      },
      http: {
        port: 4321,
        allowedOrigins: [
          "http://127.0.0.1:4173",
          "http://127.0.0.1:8181",
        ],
        maximumJsonBodyBytes: 131072,
      },
      sandbox: {
        fixedNow: "2026-07-30T00:00:00.000Z",
        executiveStateDirectory: "D:/runtime/executive",
      },
      observability: {
        exporter: "memory",
      },
      secrets: {
        provider: "disabled",
      },
    });
  });

  it("嵌入式沙箱默认使用统一端口、CORS 和 Body Limit", () => {
    expect(createInternalSandboxServerConfig()).toMatchObject({
      http: {
        host: "127.0.0.1",
        port: 4321,
        allowedOrigins: [
          "http://127.0.0.1:4173",
          "http://127.0.0.1:8181",
        ],
        maximumJsonBodyBytes: DEFAULT_MAXIMUM_JSON_BODY_BYTES,
      },
    });
  });

  it("拒绝远程沙箱数据库、非法时间和非法 HTTP 策略", () => {
    expect(() =>
      getLocalSandboxServerRuntimeConfig(
        {
          POLLYCAR_DATABASE_URL:
            "postgresql://pollycar@db.example.com/pollycar",
        },
        getLocalSandboxProfile(),
      ),
    ).toThrow("INTERNAL_SANDBOX_DATABASE_MUST_BE_LOCAL");
    expect(() =>
      getLocalSandboxServerRuntimeConfig(
        { POLLYCAR_SANDBOX_NOW: "not-a-date" },
        getLocalSandboxProfile(),
      ),
    ).toThrow("POLLYCAR_SANDBOX_NOW_INVALID");
    expect(() =>
      createInternalSandboxServerConfig({ maximumJsonBodyBytes: 0 }),
    ).toThrow("HTTP_MAXIMUM_JSON_BODY_BYTES_INVALID");
  });

  it("生产准备统一 PostgreSQL、HTTPS、托管密钥、监控和关闭态认证", () => {
    const config = getProductionReadinessServerConfig({
      ...productionEnvironment,
      ...productionProviderEnvironment,
      POLLYCAR_PRODUCTION_DATABASE_POOL_SIZE: "12",
      POLLYCAR_PRODUCTION_DATABASE_TIMEOUT_MS: "7000",
      POLLYCAR_TRUSTED_PROXY_HOPS: "2",
      POLLYCAR_HTTP_MAXIMUM_JSON_BODY_BYTES: "524288",
      POLLYCAR_OTEL_SERVICE_NAME: "pollycar-readiness",
      POLLYCAR_LOG_LEVEL: "warn",
      POLLYCAR_AUTH_PHONE_CHALLENGE_TTL_SECONDS: "420",
      POLLYCAR_AUTH_PHONE_CHALLENGE_MAXIMUM_ATTEMPTS: "4",
      POLLYCAR_AUTH_PHONE_CHALLENGE_RESEND_SECONDS: "90",
      POLLYCAR_AUTH_PHONE_CHALLENGE_HOURLY_LIMIT: "4",
      POLLYCAR_AUTH_ACCOUNT_SESSION_TTL_SECONDS: "2400",
      POLLYCAR_AUTH_DRIVER_LIVENESS_CHALLENGE_TTL_SECONDS: "150",
      POLLYCAR_AUTH_DRIVER_LIVENESS_AUTHORIZATION_TTL_SECONDS: "300",
      POLLYCAR_AUTH_ADMIN_LOGIN_MAXIMUM_ATTEMPTS: "4",
      POLLYCAR_AUTH_ADMIN_ACCOUNT_LOCK_SECONDS: "1200",
      POLLYCAR_AUTH_ADMIN_LOGIN_CHALLENGE_TTL_SECONDS: "360",
      POLLYCAR_AUTH_ADMIN_WORK_IDENTITY_SELECTION_TTL_SECONDS: "360",
      POLLYCAR_AUTH_ADMIN_ACCESS_SESSION_TTL_SECONDS: "1200",
      POLLYCAR_AUTH_ADMIN_IDLE_SESSION_TTL_SECONDS: "2400",
      POLLYCAR_AUTH_ADMIN_ABSOLUTE_SESSION_TTL_SECONDS: "21600",
      POLLYCAR_AUTH_ADMIN_MFA_FRESHNESS_SECONDS: "1200",
    });

    expect(config).toMatchObject({
      profile: "production-readiness",
      persistence: {
        maximumPoolSize: 12,
        connectionTimeoutMilliseconds: 7000,
        requireTls: true,
      },
      http: {
        trustedProxyHops: 2,
        requireForwardedHttps: true,
        maximumJsonBodyBytes: 524288,
      },
      secrets: {
        provider: "managed",
        rawVendorSecretsAllowed: false,
      },
      monitoring: {
        serviceName: "pollycar-readiness",
        logLevel: "warn",
      },
      providers: {
        sms: {
          status: "configured_disabled",
          secretReference: "vault://pollycar/sms",
        },
        identity: {
          status: "configured_disabled",
          secretReference: "vault://pollycar/identity",
        },
        adminOidc: {
          status: "configured_disabled",
          clientSecretReference: "vault://pollycar/admin-oidc",
        },
        vehicleOcr: {
          status: "configured_disabled",
          secretReference: "vault://pollycar/vehicle-ocr",
        },
        amapWebService: {
          status: "configured_disabled",
          keyReference: "vault://pollycar/amap-web-service",
        },
      },
      cryptography: {
        status: "configured_disabled",
        sessionSigningKeyReference: "vault://pollycar/session-signing",
      },
      securityPolicies: {
        version: "authentication.v1",
        authentication: {
          phoneChallengeTtlSeconds: 420,
          phoneChallengeMaximumAttempts: 4,
          phoneChallengeResendSeconds: 90,
          phoneChallengeHourlyLimit: 4,
          accountSessionTtlSeconds: 2400,
          driverLivenessChallengeTtlSeconds: 150,
          driverLivenessAuthorizationTtlSeconds: 300,
          adminLoginMaximumAttempts: 4,
          adminAccountLockSeconds: 1200,
          adminLoginChallengeTtlSeconds: 360,
          adminWorkIdentitySelectionTtlSeconds: 360,
          adminAccessSessionTtlSeconds: 1200,
          adminIdleSessionTtlSeconds: 2400,
          adminAbsoluteSessionTtlSeconds: 21600,
          adminMfaFreshnessSeconds: 1200,
        },
      },
    });
    expect(Object.values(config.featureGates).every((value) => !value)).toBe(
      true,
    );
  });

  it("生产准备拒绝不安全数据库、HTTP 端点和原始密钥", () => {
    expect(() =>
      getProductionReadinessServerConfig({
        ...productionEnvironment,
        POLLYCAR_DATABASE_URL:
          "postgresql://pollycar@127.0.0.1/pollycar?sslmode=require",
      }),
    ).toThrow("PRODUCTION_DATABASE_MUST_BE_REMOTE");
    expect(() =>
      getProductionReadinessServerConfig({
        ...productionEnvironment,
        POLLYCAR_OTLP_ENDPOINT: "http://otel.pollycar.example",
      }),
    ).toThrow("PRODUCTION_OTLP_HTTPS_REQUIRED");
    expect(() =>
      getProductionReadinessServerConfig({
        ...productionEnvironment,
        POLLYCAR_VENDOR_ACCESS_TOKEN: "raw-token",
      }),
    ).toThrow("PRODUCTION_RAW_VENDOR_SECRET_FORBIDDEN");
    expect(() =>
      getProductionReadinessServerConfig({
        ...productionEnvironment,
        POLLYCAR_AMAP_WEB_SERVICE_KEY: "raw-map-key",
      }),
    ).toThrow(
      "PRODUCTION_RAW_VENDOR_SECRET_FORBIDDEN:POLLYCAR_AMAP_WEB_SERVICE_KEY",
    );
  });

  it("认证安全策略保持版本化默认值并限制可配置范围", () => {
    const config = getProductionReadinessServerConfig(productionEnvironment);

    expect(config.securityPolicies).toEqual({
      version: "authentication.v1",
      authentication: {
        phoneChallengeTtlSeconds: 300,
        phoneChallengeMaximumAttempts: 5,
        phoneChallengeResendSeconds: 60,
        phoneChallengeHourlyLimit: 5,
        accountSessionTtlSeconds: 1800,
        driverLivenessChallengeTtlSeconds: 300,
        driverLivenessAuthorizationTtlSeconds: 300,
        adminLoginMaximumAttempts: 5,
        adminAccountLockSeconds: 1800,
        adminLoginChallengeTtlSeconds: 300,
        adminWorkIdentitySelectionTtlSeconds: 300,
        adminAccessSessionTtlSeconds: 900,
        adminIdleSessionTtlSeconds: 1800,
        adminAbsoluteSessionTtlSeconds: 28800,
        adminMfaFreshnessSeconds: 900,
      },
    });
    expect(() =>
      getProductionReadinessServerConfig({
        ...productionEnvironment,
        POLLYCAR_AUTH_PHONE_CHALLENGE_MAXIMUM_ATTEMPTS: "20",
      }),
    ).toThrow("AUTHENTICATION_POLICY_OUT_OF_RANGE");
    expect(() =>
      getProductionReadinessServerConfig({
        ...productionEnvironment,
        POLLYCAR_HTTP_MAXIMUM_JSON_BODY_BYTES: "2097153",
      }),
    ).toThrow("HTTP_MAXIMUM_JSON_BODY_BYTES_OUT_OF_RANGE");
  });

  it("生产认证候选可配置但始终保持关闭", () => {
    const config = getProductionAuthenticationReadinessConfig({
      POLLYCAR_AUTH_SMS_PROVIDER_ID: "sms-candidate",
      POLLYCAR_AUTH_SMS_API_BASE_URL: "https://sms.example.com",
      POLLYCAR_AUTH_SMS_SECRET_REFERENCE: "vault://sms",
      POLLYCAR_AUTH_SMS_SENDER_APPROVAL_REFERENCE: "approval://sender",
      POLLYCAR_AUTH_SMS_TEMPLATE_APPROVAL_REFERENCE: "approval://template",
    });

    expect(config.consumerPhone.status).toBe("configured_disabled");
    expect(config.productionAuthenticationEnabled).toBe(false);
  });

  it("迁移配置仅允许显式本机 PostgreSQL", () => {
    expect(
      getSandboxMigrationConfig({
        POLLYCAR_DATABASE_URL:
          "postgresql://pollycar@localhost:5432/pollycar",
      }),
    ).toEqual({
      profile: "local-sandbox",
      databaseUrl: "postgresql://pollycar@localhost:5432/pollycar",
    });
    expect(() => getSandboxMigrationConfig({})).toThrow(
      "POLLYCAR_DATABASE_URL_REQUIRED",
    );
  });

  it("环境 SecretProvider 不再读取原始供应商密钥", async () => {
    const provider = createEnvironmentSecretProvider({
      POLLYCAR_AMAP_WEB_SERVICE_KEY: "sandbox-key",
      POLLYCAR_VENDOR_ACCESS_TOKEN: "forbidden",
    });

    await expect(provider.read("vault://pollycar/amap")).rejects.toThrow(
      "ENVIRONMENT_SECRET_PROVIDER_DISABLED",
    );
    await expect(
      provider.read("POLLYCAR_VENDOR_ACCESS_TOKEN"),
    ).rejects.toThrow("ENVIRONMENT_SECRET_PROVIDER_DISABLED");
  });

  it("统一解析 PostgreSQL 集成测试数据库与韧性阶段", () => {
    expect(
      getPostgresIntegrationTestConfig({
        POLLYCAR_DATABASE_URL: "postgresql://localhost/dispatch",
        POLLYCAR_LEDGER_KERNEL_DATABASE_URL:
          "postgresql://localhost/ledger",
        POLLYCAR_LEDGER_RESILIENCE_PHASE: "before_restart",
      }),
    ).toEqual({
      dispatchDatabaseUrl: "postgresql://localhost/dispatch",
      ledgerKernelDatabaseUrl: "postgresql://localhost/ledger",
      ledgerResiliencePhase: "before_restart",
    });
  });
});
