import type {
  AdultEligibilityFailureCode,
  AdultEligibilityProviderCallback,
  AdultEligibilitySdkSession,
  LegalGender,
  VerificationCheckStatus,
} from "@pollycar/contracts";

export type AdultEligibilityProviderResult = Readonly<{
  requestId: string;
  status: "completed" | "pending" | "failed" | "unknown";
  completedAt?: string;
  failureCode?: AdultEligibilityFailureCode;
  identity?: Readonly<{
    legalName: string;
    documentNumber: string;
    birthDate: string;
    legalGender: LegalGender;
    documentStatus: Exclude<VerificationCheckStatus, "not_started" | "pending">;
    livenessStatus: Exclude<VerificationCheckStatus, "not_started" | "pending">;
    faceMatchStatus: Exclude<VerificationCheckStatus, "not_started" | "pending">;
    documentFailureCode?: AdultEligibilityFailureCode;
    livenessFailureCode?: AdultEligibilityFailureCode;
    faceMatchFailureCode?: AdultEligibilityFailureCode;
  }>;
}>;

export interface AdultEligibilityProvider {
  readonly providerId: string;
  readonly realDataEnabled: boolean;
  createSession(request: Readonly<{
    accountId: string;
    scenario?: string;
    expiresAt: string;
  }>): Promise<AdultEligibilitySdkSession>;
  verifyCallback(request: Readonly<{
    signature: string;
    rawBody: string;
  }>): Promise<Readonly<{
    callback: AdultEligibilityProviderCallback;
    result: AdultEligibilityProviderResult;
  }>>;
  verify(request: Readonly<{
    accountId: string;
    scenario?: string;
    syntheticDocuments: true;
    syntheticFaceCapture: true;
  }>): Promise<AdultEligibilityProviderResult>;
  refresh(requestId: string): Promise<AdultEligibilityProviderResult>;
}
