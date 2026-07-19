export type AdultEligibilityVerificationState =
  | "not_started"
  | "collecting"
  | "processing"
  | "needs_retry"
  | "needs_review"
  | "verified"
  | "rejected"
  | "expired"
  | "suspended"
  | "revoked";

export type RealNameVerificationState = AdultEligibilityVerificationState;

export type LegalGender = "female" | "male";

export type IdentityDocumentSide = "front" | "back";

export type VerificationCheckStatus =
  | "not_started"
  | "pending"
  | "passed"
  | "failed"
  | "unknown";

export type AdultEligibilityFailureCode =
  | "document_incomplete"
  | "document_invalid"
  | "document_expired"
  | "document_unsupported"
  | "underage"
  | "liveness_failed"
  | "face_mismatch"
  | "provider_timeout"
  | "provider_unavailable"
  | "result_unknown"
  | "manual_review_required";

export type AdultEligibilityRecoveryAction =
  | "upload_document"
  | "retry_document_front"
  | "retry_document_back"
  | "retry_liveness"
  | "retry_verification"
  | "submit_appeal"
  | "wait_for_provider"
  | "contact_support"
  | "none";

export type AdultEligibilityCaptureStage =
  | "intro"
  | "document_front"
  | "document_back"
  | "ocr_summary"
  | "liveness"
  | "automatic_processing"
  | "retry_required"
  | "verified"
  | "rejected";

export type AdultEligibilityProviderStatus =
  | "not_started"
  | "pending"
  | "completed"
  | "failed"
  | "unknown";

export type AdultEligibilitySdkSession = Readonly<{
  sessionId: string;
  providerId: string;
  clientToken: string;
  expiresAt: string;
  sdkMode: "synthetic" | "native";
  requestedChecks: readonly [
    "identity_document",
    "adult_age",
    "liveness",
    "face_match",
  ];
  realIdentityDataEnabled: boolean;
  realBiometricDataEnabled: boolean;
  externalIdentityProviderEnabled: boolean;
}>;

export type CreateAdultEligibilitySdkSessionRequest = Readonly<{
  accountId: string;
  expectedVersion: number;
  syntheticScenario?:
    | "passed"
    | "document_invalid"
    | "document_expired"
    | "underage"
    | "liveness_failed"
    | "face_mismatch"
    | "provider_timeout"
    | "provider_unavailable"
    | "result_unknown";
}>;

export type AdultEligibilityProviderCallback = Readonly<{
  callbackId: string;
  providerId: string;
  sessionId: string;
  requestId: string;
  occurredAt: string;
  status: "completed" | "pending" | "failed" | "unknown";
  failureCode?: AdultEligibilityFailureCode;
  synthetic: boolean;
}>;

export type SyntheticIdentityDocument = Readonly<{
  documentId: string;
  side: IdentityDocumentSide;
  fileName: string;
  mimeType: "image/jpeg" | "image/png";
  syntheticWatermarkRequired: true;
  realDocumentAccepted: false;
}>;

export type VerificationCheck = Readonly<{
  status: VerificationCheckStatus;
  checkedAt?: string;
  failureCode?: AdultEligibilityFailureCode;
}>;

export type AdultEligibilityChecks = Readonly<{
  document: VerificationCheck;
  age: VerificationCheck;
  liveness: VerificationCheck;
  faceMatch: VerificationCheck;
}>;

export type VerifiedIdentityResult = Readonly<{
  legalNameMasked: string;
  documentNumberMasked: string;
  adultConfirmed: true;
  legalGender: LegalGender;
  source: "verified_identity_document";
  userEditable: false;
  verifiedAt: string;
  expiresAt?: string;
}>;

export type AdultEligibilityVerificationView = Readonly<{
  accountId: string;
  state: AdultEligibilityVerificationState;
  version: number;
  requiredDocumentSides: readonly ["front", "back"];
  uploadedDocuments: readonly SyntheticIdentityDocument[];
  checks: AdultEligibilityChecks;
  result?: VerifiedIdentityResult;
  failureCode?: AdultEligibilityFailureCode;
  recoveryAction: AdultEligibilityRecoveryAction;
  captureStage: AdultEligibilityCaptureStage;
  provider: Readonly<{
    providerId?: string;
    requestId?: string;
    status: AdultEligibilityProviderStatus;
    submittedAt?: string;
    completedAt?: string;
    lastErrorCode?: AdultEligibilityFailureCode;
  }>;
  allowedActions: readonly (
    | "authorize"
    | "capture_document_front"
    | "capture_document_back"
    | "confirm_ocr_summary"
    | "capture_liveness"
    | "start_automatic_verification"
    | "refresh_provider_result"
    | "retry_capture"
    | "submit_appeal"
  )[];
  businessAccessAllowed: boolean;
  realIdentityDataEnabled: false;
  realBiometricDataEnabled: false;
  externalIdentityProviderEnabled: false;
  consent: Readonly<{
    privacyNoticeVersion?: string;
    identityProcessingAuthorized: boolean;
    biometricProcessingAuthorized: boolean;
    thirdPartyProcessingAuthorized: boolean;
    authorizedAt?: string;
  }>;
  appeal?: Readonly<{
    reason: string;
    submittedAt: string;
    status: "submitted" | "under_review" | "approved" | "rejected";
    reviewedAt?: string;
  }>;
  synthetic: true;
}>;

export type RealNameVerificationView = AdultEligibilityVerificationView;

export type SaveSyntheticIdentityDocumentRequest = Readonly<{
  accountId: string;
  expectedVersion: number;
  side: IdentityDocumentSide;
  fileName: string;
  mimeType: "image/jpeg" | "image/png";
  syntheticDocument: true;
}>;

export type SubmitAdultEligibilityVerificationRequest = Readonly<{
  accountId: string;
  expectedVersion: number;
  syntheticFaceCapture: true;
  syntheticScenario?:
    | "passed"
    | "document_invalid"
    | "document_expired"
    | "underage"
    | "liveness_failed"
    | "face_mismatch"
    | "provider_timeout"
    | "provider_unavailable"
    | "result_unknown";
}>;

export type SubmitRealNameVerificationRequest = SubmitAdultEligibilityVerificationRequest;

export type ConfirmSyntheticAdultEligibilityResultRequest = Readonly<{
  accountId: string;
  expectedVersion: number;
  legalName: string;
  documentNumber: string;
  birthDate: string;
  legalGender: LegalGender;
  documentStatus: Exclude<VerificationCheckStatus, "not_started" | "pending">;
  livenessStatus: Exclude<VerificationCheckStatus, "not_started" | "pending">;
  faceMatchStatus: Exclude<VerificationCheckStatus, "not_started" | "pending">;
  documentFailureCode?: Extract<
    AdultEligibilityFailureCode,
    "document_invalid" | "document_expired" | "document_unsupported" | "provider_timeout" | "provider_unavailable" | "result_unknown"
  >;
  livenessFailureCode?: Extract<
    AdultEligibilityFailureCode,
    "liveness_failed" | "provider_timeout" | "provider_unavailable" | "result_unknown"
  >;
  faceMatchFailureCode?: Extract<
    AdultEligibilityFailureCode,
    "face_mismatch" | "provider_timeout" | "provider_unavailable" | "result_unknown"
  >;
  syntheticResult: true;
}>;

export type ConfirmSyntheticIdentityResultRequest =
  ConfirmSyntheticAdultEligibilityResultRequest;

export type RetryAdultEligibilityVerificationRequest = Readonly<{
  accountId: string;
  expectedVersion: number;
}>;

export type AuthorizeAdultEligibilityVerificationRequest = Readonly<{
  accountId: string;
  expectedVersion: number;
  privacyNoticeVersion: string;
  identityProcessingAuthorized: true;
  biometricProcessingAuthorized: true;
  thirdPartyProcessingAuthorized: true;
}>;

export type SubmitAdultEligibilityAppealRequest = Readonly<{
  accountId: string;
  expectedVersion: number;
  reason: string;
}>;

export type ReviewAdultEligibilityAppealRequest = Readonly<{
  accountId: string;
  expectedVersion: number;
  decision: "approve" | "reject";
}>;

export type AdultEligibilityProviderTrace = Readonly<{
  accountId: string;
  state: AdultEligibilityVerificationState;
  providerId?: string;
  providerRequestId?: string;
  providerStatus: AdultEligibilityProviderStatus;
  submittedAt?: string;
  completedAt?: string;
  checks: AdultEligibilityChecks;
  failureCode?: AdultEligibilityFailureCode;
  businessAccessAllowed: boolean;
  appealStatus?: "submitted" | "under_review" | "approved" | "rejected";
  synthetic: true;
}>;

export interface AdultEligibilityVerificationClient {
  get(): Promise<AdultEligibilityVerificationView>;
  authorize(request: Omit<AuthorizeAdultEligibilityVerificationRequest, "accountId">): Promise<AdultEligibilityVerificationView>;
  saveDocument(request: Omit<SaveSyntheticIdentityDocumentRequest, "accountId">): Promise<AdultEligibilityVerificationView>;
  submit(request: Omit<SubmitAdultEligibilityVerificationRequest, "accountId">): Promise<AdultEligibilityVerificationView>;
  createSdkSession(request: Omit<CreateAdultEligibilitySdkSessionRequest, "accountId">): Promise<AdultEligibilitySdkSession>;
  refreshProviderResult(expectedVersion: number): Promise<AdultEligibilityVerificationView>;
  submitAppeal(request: Omit<SubmitAdultEligibilityAppealRequest, "accountId">): Promise<AdultEligibilityVerificationView>;
}

export interface AdminAdultEligibilityTraceClient {
  list(): Promise<readonly AdultEligibilityProviderTrace[]>;
  get(accountId: string): Promise<AdultEligibilityProviderTrace>;
}
