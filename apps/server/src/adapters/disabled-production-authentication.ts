import type { AdultEligibilityProvider } from "../ports/adult-eligibility-provider.js";
import type { SmsDelivery } from "../ports/sms-delivery.js";

export class DisabledProductionSmsDelivery implements SmsDelivery {
  public async sendVerificationCode(_input: Readonly<{
    maskedPhoneNumber: string;
    code: string;
    idempotencyKey: string;
  }>): Promise<never> {
    throw new Error("PRODUCTION_SMS_DELIVERY_DISABLED");
  }
}

export class DisabledProductionAdultEligibilityProvider
implements AdultEligibilityProvider {
  public readonly providerId = "production-identity-disabled";
  public readonly realDataEnabled = false;

  public async createSession(_request: Readonly<{
    accountId: string;
    scenario?: string;
    expiresAt: string;
  }>): Promise<never> {
    throw new Error("PRODUCTION_IDENTITY_PROVIDER_DISABLED");
  }

  public async verifyCallback(_request: Readonly<{
    signature: string;
    rawBody: string;
  }>): Promise<never> {
    throw new Error("PRODUCTION_IDENTITY_PROVIDER_DISABLED");
  }

  public async verify(_request: Readonly<{
    accountId: string;
    scenario?: string;
    syntheticDocuments: true;
    syntheticFaceCapture: true;
  }>): Promise<never> {
    throw new Error("PRODUCTION_IDENTITY_PROVIDER_DISABLED");
  }

  public async refresh(_requestId: string): Promise<never> {
    throw new Error("PRODUCTION_IDENTITY_PROVIDER_DISABLED");
  }
}
