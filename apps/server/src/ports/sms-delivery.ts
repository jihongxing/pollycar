export type SmsDeliveryResult = Readonly<{
  state: "delivered" | "unknown";
  providerReference: string;
}>;

export interface SmsDelivery {
  sendVerificationCode(input: Readonly<{
    maskedPhoneNumber: string;
    code: string;
    idempotencyKey: string;
  }>): Promise<SmsDeliveryResult>;
}
