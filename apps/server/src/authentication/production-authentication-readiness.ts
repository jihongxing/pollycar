export type AuthenticationIntegrationStatus =
  | "unconfigured"
  | "configured_disabled";

export interface ProductionAuthenticationReadinessConfig {
  readonly mode: "disabled";
  readonly productionAuthenticationEnabled: false;
  readonly realPhoneDataEnabled: false;
  readonly realSmsDeliveryEnabled: false;
  readonly realIdentityVerificationEnabled: false;
  readonly realBiometricVerificationEnabled: false;
  readonly realAdminAccountsEnabled: false;
  readonly consumerPhone: Readonly<{
    status: AuthenticationIntegrationStatus;
    providerId?: string;
    apiBaseUrl?: string;
    secretReference?: string;
    senderApprovalReference?: string;
    templateApprovalReference?: string;
  }>;
  readonly adultEligibility: Readonly<{
    status: AuthenticationIntegrationStatus;
    providerId?: string;
    apiBaseUrl?: string;
    secretReference?: string;
    dataProcessingApprovalReference?: string;
    biometricApprovalReference?: string;
  }>;
  readonly adminWorkforce: Readonly<{
    status: AuthenticationIntegrationStatus;
    strategy: "pending_decision" | "managed_oidc";
    issuerUrl?: string;
    clientId?: string;
    clientSecretReference?: string;
    tenantApprovalReference?: string;
  }>;
  readonly cryptography: Readonly<{
    status: AuthenticationIntegrationStatus;
    phoneEncryptionKeyReference?: string;
    phoneDigestKeyReference?: string;
    otpHmacKeyReference?: string;
    sessionSigningKeyReference?: string;
  }>;
}

const managedReferencePattern =
  /^(?:aws-secrets-manager|azure-key-vault|gcp-secret-manager|vault|secret):\/\//;

export function createProductionAuthenticationReadinessConfig(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): ProductionAuthenticationReadinessConfig {
  assertProductionAuthenticationDisabled(environment);
  assertNoRawAuthenticationSecrets(environment);

  const consumerPhone = readIntegration(environment, {
    providerId: "POLLYCAR_AUTH_SMS_PROVIDER_ID",
    apiBaseUrl: "POLLYCAR_AUTH_SMS_API_BASE_URL",
    secretReference: "POLLYCAR_AUTH_SMS_SECRET_REFERENCE",
    senderApprovalReference: "POLLYCAR_AUTH_SMS_SENDER_APPROVAL_REFERENCE",
    templateApprovalReference: "POLLYCAR_AUTH_SMS_TEMPLATE_APPROVAL_REFERENCE",
  });
  const adultEligibility = readIntegration(environment, {
    providerId: "POLLYCAR_AUTH_IDENTITY_PROVIDER_ID",
    apiBaseUrl: "POLLYCAR_AUTH_IDENTITY_API_BASE_URL",
    secretReference: "POLLYCAR_AUTH_IDENTITY_SECRET_REFERENCE",
    dataProcessingApprovalReference:
      "POLLYCAR_AUTH_IDENTITY_DATA_PROCESSING_APPROVAL_REFERENCE",
    biometricApprovalReference:
      "POLLYCAR_AUTH_IDENTITY_BIOMETRIC_APPROVAL_REFERENCE",
  });
  const adminWorkforce = readIntegration(environment, {
    issuerUrl: "POLLYCAR_AUTH_ADMIN_OIDC_ISSUER_URL",
    clientId: "POLLYCAR_AUTH_ADMIN_OIDC_CLIENT_ID",
    clientSecretReference:
      "POLLYCAR_AUTH_ADMIN_OIDC_CLIENT_SECRET_REFERENCE",
    tenantApprovalReference:
      "POLLYCAR_AUTH_ADMIN_OIDC_TENANT_APPROVAL_REFERENCE",
  });
  const cryptography = readIntegration(environment, {
    phoneEncryptionKeyReference:
      "POLLYCAR_AUTH_PHONE_ENCRYPTION_KEY_REFERENCE",
    phoneDigestKeyReference: "POLLYCAR_AUTH_PHONE_DIGEST_KEY_REFERENCE",
    otpHmacKeyReference: "POLLYCAR_AUTH_OTP_HMAC_KEY_REFERENCE",
    sessionSigningKeyReference:
      "POLLYCAR_AUTH_SESSION_SIGNING_KEY_REFERENCE",
  });

  validateHttpsValue(consumerPhone.apiBaseUrl, "PRODUCTION_SMS_API_HTTPS_REQUIRED");
  validateHttpsValue(
    adultEligibility.apiBaseUrl,
    "PRODUCTION_IDENTITY_API_HTTPS_REQUIRED",
  );
  validateHttpsValue(
    adminWorkforce.issuerUrl,
    "PRODUCTION_ADMIN_OIDC_ISSUER_HTTPS_REQUIRED",
  );
  for (const reference of [
    consumerPhone.secretReference,
    adultEligibility.secretReference,
    adminWorkforce.clientSecretReference,
    cryptography.phoneEncryptionKeyReference,
    cryptography.phoneDigestKeyReference,
    cryptography.otpHmacKeyReference,
    cryptography.sessionSigningKeyReference,
  ]) {
    validateManagedReference(reference);
  }

  return Object.freeze({
    mode: "disabled",
    productionAuthenticationEnabled: false,
    realPhoneDataEnabled: false,
    realSmsDeliveryEnabled: false,
    realIdentityVerificationEnabled: false,
    realBiometricVerificationEnabled: false,
    realAdminAccountsEnabled: false,
    consumerPhone: Object.freeze(consumerPhone),
    adultEligibility: Object.freeze(adultEligibility),
    adminWorkforce: Object.freeze({
      ...adminWorkforce,
      strategy: adminWorkforce.status === "configured_disabled"
        ? "managed_oidc"
        : "pending_decision",
    }),
    cryptography: Object.freeze(cryptography),
  });
}

function readIntegration<T extends Readonly<Record<string, string>>>(
  environment: Readonly<Record<string, string | undefined>>,
  fields: T,
): Readonly<Partial<Record<keyof T, string>>> & {
  readonly status: AuthenticationIntegrationStatus;
} {
  const entries = Object.entries(fields).map(([field, environmentName]) => [
    field,
    environment[environmentName]?.trim() || undefined,
  ] as const);
  const configured = entries.filter(([, value]) => value !== undefined);
  if (configured.length !== 0 && configured.length !== entries.length) {
    const missing = entries
      .filter(([, value]) => value === undefined)
      .map(([field]) => fields[field as keyof T]);
    throw new Error(
      `PRODUCTION_AUTHENTICATION_CONFIGURATION_INCOMPLETE:${missing.join(",")}`,
    );
  }
  return {
    status: configured.length === entries.length
      ? "configured_disabled"
      : "unconfigured",
    ...Object.fromEntries(configured),
  } as Readonly<Partial<Record<keyof T, string>>> & {
    readonly status: AuthenticationIntegrationStatus;
  };
}

function assertProductionAuthenticationDisabled(
  environment: Readonly<Record<string, string | undefined>>,
): void {
  for (const name of [
    "POLLYCAR_PRODUCTION_AUTHENTICATION_ENABLED",
    "POLLYCAR_REAL_PHONE_DATA_ENABLED",
    "POLLYCAR_REAL_SMS_DELIVERY_ENABLED",
    "POLLYCAR_REAL_IDENTITY_VERIFICATION_ENABLED",
    "POLLYCAR_REAL_BIOMETRIC_VERIFICATION_ENABLED",
    "POLLYCAR_REAL_ADMIN_ACCOUNTS_ENABLED",
  ]) {
    if (environment[name]?.trim().toLowerCase() === "true") {
      throw new Error(`PRODUCTION_AUTHENTICATION_NOT_APPROVED:${name}`);
    }
  }
}

function assertNoRawAuthenticationSecrets(
  environment: Readonly<Record<string, string | undefined>>,
): void {
  for (const [name, value] of Object.entries(environment)) {
    if (!value || !name.startsWith("POLLYCAR_AUTH_")) continue;
    if (name.endsWith("_REFERENCE") || name.endsWith("_CLIENT_ID")) continue;
    if (/(?:SECRET|PRIVATE_KEY|ACCESS_KEY|TOKEN)/.test(name)) {
      throw new Error(`PRODUCTION_AUTHENTICATION_RAW_SECRET_FORBIDDEN:${name}`);
    }
  }
}

function validateHttpsValue(value: string | undefined, errorCode: string): void {
  if (!value) return;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(errorCode);
  }
  if (
    url.protocol !== "https:" ||
    ["localhost", "127.0.0.1", "::1"].includes(url.hostname)
  ) {
    throw new Error(errorCode);
  }
}

function validateManagedReference(reference: string | undefined): void {
  if (reference && !managedReferencePattern.test(reference)) {
    throw new Error("PRODUCTION_AUTHENTICATION_SECRET_REFERENCE_INVALID");
  }
}
