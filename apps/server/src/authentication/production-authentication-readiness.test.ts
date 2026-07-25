import { describe, expect, it } from "vitest";
import {
  DisabledProductionAdultEligibilityProvider,
  DisabledProductionSmsDelivery,
} from "../adapters/disabled-production-authentication.js";
import { createProductionAuthenticationReadinessConfig } from "./production-authentication-readiness.js";

describe("生产认证接入准备配置", () => {
  it("在没有外部输入时保持全部真实认证能力关闭", () => {
    const config = createProductionAuthenticationReadinessConfig({});

    expect(config).toMatchObject({
      mode: "disabled",
      productionAuthenticationEnabled: false,
      realPhoneDataEnabled: false,
      realSmsDeliveryEnabled: false,
      realIdentityVerificationEnabled: false,
      realBiometricVerificationEnabled: false,
      realAdminAccountsEnabled: false,
      consumerPhone: { status: "unconfigured" },
      adultEligibility: { status: "unconfigured" },
      adminWorkforce: {
        status: "unconfigured",
        strategy: "pending_decision",
      },
      cryptography: { status: "unconfigured" },
    });
  });

  it("允许校验完整的供应商候选配置但仍保持禁用", () => {
    const config = createProductionAuthenticationReadinessConfig({
      POLLYCAR_AUTH_SMS_PROVIDER_ID: "approved-sms-candidate",
      POLLYCAR_AUTH_SMS_API_BASE_URL: "https://sms.example.com",
      POLLYCAR_AUTH_SMS_SECRET_REFERENCE: "vault://preproduction/sms",
      POLLYCAR_AUTH_SMS_SENDER_APPROVAL_REFERENCE: "approval://sms-sender",
      POLLYCAR_AUTH_SMS_TEMPLATE_APPROVAL_REFERENCE: "approval://sms-template",
      POLLYCAR_AUTH_IDENTITY_PROVIDER_ID: "approved-identity-candidate",
      POLLYCAR_AUTH_IDENTITY_API_BASE_URL: "https://identity.example.com",
      POLLYCAR_AUTH_IDENTITY_SECRET_REFERENCE: "vault://preproduction/identity",
      POLLYCAR_AUTH_IDENTITY_DATA_PROCESSING_APPROVAL_REFERENCE:
        "approval://identity-data-processing",
      POLLYCAR_AUTH_IDENTITY_BIOMETRIC_APPROVAL_REFERENCE:
        "approval://identity-biometric",
      POLLYCAR_AUTH_ADMIN_OIDC_ISSUER_URL: "https://login.example.com",
      POLLYCAR_AUTH_ADMIN_OIDC_CLIENT_ID: "pollycar-preproduction-admin",
      POLLYCAR_AUTH_ADMIN_OIDC_CLIENT_SECRET_REFERENCE:
        "vault://preproduction/admin-oidc",
      POLLYCAR_AUTH_ADMIN_OIDC_TENANT_APPROVAL_REFERENCE:
        "approval://admin-tenant",
      POLLYCAR_AUTH_PHONE_ENCRYPTION_KEY_REFERENCE:
        "vault://preproduction/phone-encryption",
      POLLYCAR_AUTH_PHONE_DIGEST_KEY_REFERENCE:
        "vault://preproduction/phone-digest",
      POLLYCAR_AUTH_OTP_HMAC_KEY_REFERENCE:
        "vault://preproduction/otp-hmac",
      POLLYCAR_AUTH_SESSION_SIGNING_KEY_REFERENCE:
        "vault://preproduction/session-signing",
    });

    expect(config.consumerPhone.status).toBe("configured_disabled");
    expect(config.adultEligibility.status).toBe("configured_disabled");
    expect(config.adminWorkforce).toMatchObject({
      status: "configured_disabled",
      strategy: "managed_oidc",
    });
    expect(config.cryptography.status).toBe("configured_disabled");
    expect(config.productionAuthenticationEnabled).toBe(false);
  });

  it("拒绝部分配置、不安全地址、原始密钥和未批准启用", () => {
    expect(() => createProductionAuthenticationReadinessConfig({
      POLLYCAR_AUTH_SMS_PROVIDER_ID: "partial",
    })).toThrow("PRODUCTION_AUTHENTICATION_CONFIGURATION_INCOMPLETE");
    expect(() => createProductionAuthenticationReadinessConfig({
      POLLYCAR_AUTH_ADMIN_OIDC_ISSUER_URL: "http://localhost:4310",
      POLLYCAR_AUTH_ADMIN_OIDC_CLIENT_ID: "client",
      POLLYCAR_AUTH_ADMIN_OIDC_CLIENT_SECRET_REFERENCE: "vault://admin",
      POLLYCAR_AUTH_ADMIN_OIDC_TENANT_APPROVAL_REFERENCE: "approval://tenant",
    })).toThrow("PRODUCTION_ADMIN_OIDC_ISSUER_HTTPS_REQUIRED");
    expect(() => createProductionAuthenticationReadinessConfig({
      POLLYCAR_AUTH_SMS_ACCESS_TOKEN: "raw-token",
    })).toThrow("PRODUCTION_AUTHENTICATION_RAW_SECRET_FORBIDDEN");
    expect(() => createProductionAuthenticationReadinessConfig({
      POLLYCAR_PRODUCTION_AUTHENTICATION_ENABLED: "true",
    })).toThrow("PRODUCTION_AUTHENTICATION_NOT_APPROVED");
  });

  it("生产短信和实名适配器始终失败关闭", async () => {
    const sms = new DisabledProductionSmsDelivery();
    const identity = new DisabledProductionAdultEligibilityProvider();

    await expect(sms.sendVerificationCode({
      maskedPhoneNumber: "138****0000",
      code: "000000",
      idempotencyKey: "test",
    })).rejects.toThrow("PRODUCTION_SMS_DELIVERY_DISABLED");
    await expect(identity.createSession({
      accountId: "account-1",
      expiresAt: new Date().toISOString(),
    })).rejects.toThrow("PRODUCTION_IDENTITY_PROVIDER_DISABLED");
  });
});
