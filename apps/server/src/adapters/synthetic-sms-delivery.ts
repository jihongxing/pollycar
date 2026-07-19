import type { SmsDelivery, SmsDeliveryResult } from "../ports/sms-delivery.js";

export class SyntheticSmsDelivery implements SmsDelivery {
  public async sendVerificationCode(input: Readonly<{
    maskedPhoneNumber: string;
    code: string;
    idempotencyKey: string;
  }>): Promise<SmsDeliveryResult> {
    if (input.idempotencyKey.includes("unknown")) {
      return { state: "unknown", providerReference: `synthetic-unknown-${input.idempotencyKey}` };
    }
    return { state: "delivered", providerReference: `synthetic-${input.idempotencyKey}` };
  }
}
