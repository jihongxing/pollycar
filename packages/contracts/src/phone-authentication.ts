import type { InternalAccountSessionView } from "./account-session.js";

export type AccountState =
  | "pending_adult_eligibility"
  | "active"
  | "restricted"
  | "closure_pending"
  | "closed"
  | "phone_reverification_required";

export type VerificationChallengeState =
  | "pending"
  | "consumed"
  | "expired"
  | "locked"
  | "superseded"
  | "delivery_unknown";

export type RequestPhoneCodeRequest = Readonly<{
  phoneNumber: string;
  consentAccepted: boolean;
  deviceId: string;
  idempotencyKey: string;
}>;

export type PhoneCodeChallengeView = Readonly<{
  challengeId: string;
  maskedPhoneNumber: string;
  state: VerificationChallengeState;
  expiresAt: string;
  resendAvailableAt: string;
  attemptsRemaining: number;
  synthetic: true;
}>;

export type VerifyPhoneCodeRequest = Readonly<{
  challengeId: string;
  code: string;
  deviceId: string;
  idempotencyKey: string;
}>;

export type AuthenticatedAccountView = Readonly<{
  accountId: string;
  state: AccountState;
  isNewAccount: boolean;
  adultEligibilityState: string;
  businessAccessAllowed: boolean;
  nextStep: "adult_eligibility" | "ride_home" | "restricted";
  synthetic: true;
}>;

export type PhoneAuthenticationResult = Readonly<{
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
  account: AuthenticatedAccountView;
  session: InternalAccountSessionView;
}>;

export type RefreshPhoneSessionRequest = Readonly<{
  refreshToken: string;
  deviceId: string;
  idempotencyKey: string;
}>;
