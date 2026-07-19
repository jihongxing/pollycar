import type {
  AdultEligibilityChecks,
  AdultEligibilityFailureCode,
  AuthorizeAdultEligibilityVerificationRequest,
  ConfirmSyntheticIdentityResultRequest,
  RealNameVerificationView,
  RetryAdultEligibilityVerificationRequest,
  SaveSyntheticIdentityDocumentRequest,
  SubmitRealNameVerificationRequest,
  SubmitAdultEligibilityAppealRequest,
  ReviewAdultEligibilityAppealRequest,
  VerificationCheck,
  AdultEligibilityProviderTrace,
  AdultEligibilitySdkSession,
  CreateAdultEligibilitySdkSessionRequest,
} from "@pollycar/contracts";
import { SyntheticAdultEligibilityProvider } from "../adapters/synthetic-adult-eligibility-provider.js";
import type { AuditLog } from "../ports/audit.js";
import type { AdultEligibilityProvider, AdultEligibilityProviderResult } from "../ports/adult-eligibility-provider.js";
import type { Repository } from "../ports/storage.js";

export type RealNameVerificationRecord = RealNameVerificationView &
  Readonly<{ processedKeys: readonly string[] }>;

export class RealNameVerificationService {
  public constructor(
    private readonly repository: Repository<RealNameVerificationRecord>,
    private readonly audit: AuditLog,
    private readonly now: () => Date,
    private readonly provider: AdultEligibilityProvider = new SyntheticAdultEligibilityProvider(),
  ) {}

  public async get(accountId: string): Promise<RealNameVerificationView> {
    const stored = await this.repository.get(accountId);
    return stored?.value ?? initialVerification(accountId);
  }

  public async listProviderTraces(): Promise<readonly AdultEligibilityProviderTrace[]> {
    const records = await this.repository.list();
    return records.map(({ value }) => toProviderTrace(value));
  }

  public async getProviderTrace(accountId: string): Promise<AdultEligibilityProviderTrace> {
    const stored = await this.repository.get(accountId);
    if (!stored) throw new Error("ADULT_ELIGIBILITY_VERIFICATION_NOT_FOUND");
    return toProviderTrace(stored.value);
  }

  public async createSdkSession(
    request: CreateAdultEligibilitySdkSessionRequest,
    idempotencyKey: string,
  ): Promise<AdultEligibilitySdkSession> {
    const stored = await this.repository.get(request.accountId);
    const current = stored?.value ?? initialVerification(request.accountId);
    assertVersion(request.expectedVersion, current.version);
    assertMutable(current);
    assertAuthorized(current);
    if (this.provider.realDataEnabled) {
      throw new Error("EXTERNAL_IDENTITY_PROVIDER_DISABLED");
    }
    const expiresAt = new Date(this.now().getTime() + 10 * 60_000).toISOString();
    const session = await this.provider.createSession({
      accountId: request.accountId,
      expiresAt,
      ...(request.syntheticScenario ? { scenario: request.syntheticScenario } : {}),
    });
    const next: RealNameVerificationRecord = {
      ...current,
      state: "processing",
      version: current.version + 1,
      checks: {
        document: pendingCheck(),
        age: pendingCheck(),
        liveness: pendingCheck(),
        faceMatch: pendingCheck(),
      },
      recoveryAction: "wait_for_provider",
      captureStage: "automatic_processing",
      provider: {
        providerId: session.providerId,
        requestId: session.sessionId,
        status: "pending",
        submittedAt: this.now().toISOString(),
      },
      allowedActions: ["refresh_provider_result"],
      businessAccessAllowed: false,
      processedKeys: current.processedKeys.includes(idempotencyKey)
        ? current.processedKeys
        : [...current.processedKeys, idempotencyKey],
    };
    await this.repository.put(request.accountId, next, stored?.version ?? 0);
    await this.appendAudit(request.accountId, "adult_eligibility.sdk_session.create", idempotencyKey);
    return session;
  }

  public async applyProviderCallback(
    accountId: string,
    signature: string,
    rawBody: string,
  ): Promise<RealNameVerificationView> {
    const verified = await this.provider.verifyCallback({ signature, rawBody });
    const stored = await this.repository.get(accountId);
    if (!stored) throw new Error("ADULT_ELIGIBILITY_VERIFICATION_NOT_FOUND");
    if (stored.value.processedKeys.includes(verified.callback.callbackId)) return stored.value;
    if (stored.value.provider.requestId !== verified.callback.sessionId) {
      throw new Error("AUTHORIZATION_DENIED");
    }
    await this.appendAudit(
      accountId,
      "adult_eligibility.provider_callback.receive",
      verified.callback.callbackId,
      verified.callback.failureCode,
    );
    return this.applyProviderResult(
      stored.value,
      stored.version,
      verified.result,
      verified.callback.callbackId,
    );
  }

  public async seedSyntheticVerified(
    accountId: string,
    legalGender: "female" | "male",
  ): Promise<void> {
    const current = await this.repository.get(accountId);
    if (current) return;
    const verifiedAt = this.now().toISOString();
    await this.repository.put(accountId, {
      ...initialVerification(accountId),
      state: "verified",
      version: 1,
      checks: {
        document: { status: "passed", checkedAt: verifiedAt },
        age: { status: "passed", checkedAt: verifiedAt },
        liveness: { status: "passed", checkedAt: verifiedAt },
        faceMatch: { status: "passed", checkedAt: verifiedAt },
      },
      result: {
        legalNameMasked: "合***",
        documentNumberMasked: "310***********0000",
        adultConfirmed: true,
        legalGender,
        source: "verified_identity_document",
        userEditable: false,
        verifiedAt,
      },
      consent: {
        privacyNoticeVersion: "synthetic-seed",
        identityProcessingAuthorized: true,
        biometricProcessingAuthorized: true,
        thirdPartyProcessingAuthorized: true,
        authorizedAt: verifiedAt,
      },
      recoveryAction: "none",
      captureStage: "verified",
      provider: {
        providerId: "synthetic-seed",
        requestId: `synthetic-seed-${accountId}`,
        status: "completed",
        submittedAt: verifiedAt,
        completedAt: verifiedAt,
      },
      allowedActions: [],
      businessAccessAllowed: true,
    }, 0);
  }

  public async saveDocument(
    request: SaveSyntheticIdentityDocumentRequest,
    idempotencyKey: string,
  ): Promise<RealNameVerificationView> {
    if (!request.syntheticDocument) throw new Error("REAL_IDENTITY_DATA_FORBIDDEN");
    const stored = await this.repository.get(request.accountId);
    const current = stored?.value ?? initialVerification(request.accountId);
    if (current.processedKeys.includes(idempotencyKey)) return current;
    assertVersion(request.expectedVersion, current.version);
    assertMutable(current);
    assertAuthorized(current);

    const document = {
      documentId: `synthetic-id-${request.accountId}-${request.side}`,
      side: request.side,
      fileName: request.fileName,
      mimeType: request.mimeType,
      syntheticWatermarkRequired: true as const,
      realDocumentAccepted: false as const,
    };
    const next: RealNameVerificationRecord = {
      ...current,
      state: "collecting",
      version: current.version + 1,
      uploadedDocuments: [
        ...current.uploadedDocuments.filter((item) => item.side !== request.side),
        document,
      ],
      checks: emptyChecks(),
      recoveryAction: "upload_document",
      captureStage: request.side === "front" ? "document_back" : "ocr_summary",
      allowedActions: request.side === "front"
        ? ["capture_document_back"]
        : ["confirm_ocr_summary", "capture_liveness"],
      businessAccessAllowed: false,
      processedKeys: [...current.processedKeys, idempotencyKey],
    };
    await this.repository.put(request.accountId, next, stored?.version ?? 0);
    await this.appendAudit(request.accountId, "adult_eligibility.document.save", idempotencyKey);
    return next;
  }

  public async submit(
    request: SubmitRealNameVerificationRequest,
    idempotencyKey: string,
  ): Promise<RealNameVerificationView> {
    if (!request.syntheticFaceCapture) throw new Error("REAL_BIOMETRIC_DATA_FORBIDDEN");
    const stored = await this.repository.get(request.accountId);
    const current = stored?.value ?? initialVerification(request.accountId);
    if (current.processedKeys.includes(idempotencyKey)) return current;
    assertVersion(request.expectedVersion, current.version);
    assertMutable(current);
    assertAuthorized(current);
    if (!["front", "back"].every((side) => current.uploadedDocuments.some((item) => item.side === side))) {
      throw new Error("ADULT_ELIGIBILITY_DOCUMENT_INCOMPLETE");
    }

    const submittedAt = this.now().toISOString();
    const processing: RealNameVerificationRecord = {
      ...current,
      state: "processing",
      version: current.version + 1,
      checks: {
        document: pendingCheck(),
        age: pendingCheck(),
        liveness: pendingCheck(),
        faceMatch: pendingCheck(),
      },
      recoveryAction: "wait_for_provider",
      captureStage: "automatic_processing",
      provider: {
        providerId: this.provider.providerId,
        status: "pending",
        submittedAt,
      },
      allowedActions: ["refresh_provider_result"],
      businessAccessAllowed: false,
      processedKeys: [...current.processedKeys, idempotencyKey],
    };
    const persisted = await this.repository.put(request.accountId, processing, stored?.version ?? 0);
    await this.appendAudit(request.accountId, "adult_eligibility.submit", idempotencyKey);
    const providerResult = await this.provider.verify({
      accountId: request.accountId,
      ...(request.syntheticScenario ? { scenario: request.syntheticScenario } : {}),
      syntheticDocuments: true,
      syntheticFaceCapture: true,
    });
    return this.applyProviderResult(processing, persisted.version, providerResult, `${idempotencyKey}-provider`);
  }

  public async refreshProviderResult(
    accountId: string,
    idempotencyKey: string,
  ): Promise<RealNameVerificationView> {
    const stored = await this.repository.get(accountId);
    if (!stored) throw new Error("ADULT_ELIGIBILITY_VERIFICATION_NOT_FOUND");
    if (stored.value.processedKeys.includes(idempotencyKey)) return stored.value;
    if (stored.value.state !== "processing" || !stored.value.provider.requestId) {
      throw new Error("ADULT_ELIGIBILITY_INVALID_STATE");
    }
    const result = await this.provider.refresh(stored.value.provider.requestId);
    return this.applyProviderResult(stored.value, stored.version, result, idempotencyKey);
  }

  public async confirmSyntheticResult(
    request: ConfirmSyntheticIdentityResultRequest,
    idempotencyKey: string,
    providerContext?: Readonly<{
      storageVersion: number;
      providerResult: AdultEligibilityProviderResult;
    }>,
  ): Promise<RealNameVerificationView> {
    if (!request.syntheticResult) throw new Error("REAL_IDENTITY_DATA_FORBIDDEN");
    const stored = await this.repository.get(request.accountId);
    if (!stored) throw new Error("ADULT_ELIGIBILITY_VERIFICATION_NOT_FOUND");
    if (stored.value.processedKeys.includes(idempotencyKey)) return stored.value;
    assertVersion(request.expectedVersion, stored.value.version);
    if (stored.value.state !== "processing") throw new Error("ADULT_ELIGIBILITY_INVALID_STATE");

    const checkedAt = this.now().toISOString();
    const agePassed = isAdult(request.birthDate, this.now());
    const checks: AdultEligibilityChecks = {
      document: resolvedCheck(request.documentStatus, request.documentFailureCode, checkedAt),
      age: agePassed
        ? { status: "passed", checkedAt }
        : { status: "failed", checkedAt, failureCode: "underage" },
      liveness: resolvedCheck(request.livenessStatus, request.livenessFailureCode, checkedAt),
      faceMatch: resolvedCheck(request.faceMatchStatus, request.faceMatchFailureCode, checkedAt),
    };
    const failureCode = firstFailure(checks);
    const allPassed = Object.values(checks).every((check) => check.status === "passed");
    const state = allPassed ? "verified" : failureState(failureCode);
    const { result: _previousResult, failureCode: _previousFailureCode, ...currentWithoutOutcome } =
      stored.value;
    const shared = {
      ...currentWithoutOutcome,
      state,
      version: stored.value.version + 1,
      checks,
      provider: providerContext
        ? {
            ...stored.value.provider,
            requestId: providerContext.providerResult.requestId,
            status: "completed" as const,
            completedAt: providerContext.providerResult.completedAt ?? checkedAt,
          }
        : stored.value.provider,
      processedKeys: [...stored.value.processedKeys, idempotencyKey],
    };
    const next: RealNameVerificationRecord = allPassed
      ? {
          ...shared,
          state: "verified",
          result: {
            legalNameMasked: maskName(request.legalName),
            documentNumberMasked: maskDocumentNumber(request.documentNumber),
            adultConfirmed: true,
            legalGender: request.legalGender,
            source: "verified_identity_document",
            userEditable: false,
            verifiedAt: checkedAt,
          },
          recoveryAction: "none",
          captureStage: "verified",
          allowedActions: [],
          businessAccessAllowed: true,
        }
      : {
          ...shared,
          state,
          failureCode: failureCode ?? "result_unknown",
          recoveryAction: recoveryFor(failureCode),
          captureStage: failureCode === "underage" ? "rejected" : "retry_required",
          allowedActions: failureCode === "underage"
            ? ["submit_appeal"]
            : ["retry_capture", "submit_appeal"],
          businessAccessAllowed: false,
        };
    await this.repository.put(
      request.accountId,
      next,
      providerContext?.storageVersion ?? stored.version,
    );
    await this.appendAudit(
      request.accountId,
      allPassed ? "adult_eligibility.verify" : "adult_eligibility.fail",
      idempotencyKey,
      failureCode,
    );
    return next;
  }

  public async retry(
    request: RetryAdultEligibilityVerificationRequest,
    idempotencyKey: string,
  ): Promise<RealNameVerificationView> {
    const stored = await this.repository.get(request.accountId);
    if (!stored) throw new Error("ADULT_ELIGIBILITY_VERIFICATION_NOT_FOUND");
    if (stored.value.processedKeys.includes(idempotencyKey)) return stored.value;
    assertVersion(request.expectedVersion, stored.value.version);
    if (stored.value.state !== "needs_retry") throw new Error("ADULT_ELIGIBILITY_INVALID_STATE");
    const { failureCode: _previousFailureCode, result: _previousResult, ...retryable } =
      stored.value;
    const next: RealNameVerificationRecord = {
      ...retryable,
      state: "collecting",
      version: stored.value.version + 1,
      checks: emptyChecks(),
      recoveryAction: "upload_document",
      captureStage: "document_front",
      provider: { status: "not_started" },
      allowedActions: ["capture_document_front"],
      businessAccessAllowed: false,
      processedKeys: [...stored.value.processedKeys, idempotencyKey],
    };
    await this.repository.put(request.accountId, next, stored.version);
    await this.appendAudit(request.accountId, "adult_eligibility.retry", idempotencyKey);
    return next;
  }

  public async authorize(
    request: AuthorizeAdultEligibilityVerificationRequest,
    idempotencyKey: string,
  ): Promise<RealNameVerificationView> {
    const stored = await this.repository.get(request.accountId);
    const current = stored?.value ?? initialVerification(request.accountId);
    if (current.processedKeys.includes(idempotencyKey)) return current;
    assertVersion(request.expectedVersion, current.version);
    if (
      !request.identityProcessingAuthorized ||
      !request.biometricProcessingAuthorized ||
      !request.thirdPartyProcessingAuthorized
    ) {
      throw new Error("ADULT_ELIGIBILITY_AUTHORIZATION_REQUIRED");
    }
    const next: RealNameVerificationRecord = {
      ...current,
      state: current.state === "not_started" ? "collecting" : current.state,
      version: current.version + 1,
      consent: {
        privacyNoticeVersion: request.privacyNoticeVersion,
        identityProcessingAuthorized: true,
        biometricProcessingAuthorized: true,
        thirdPartyProcessingAuthorized: true,
        authorizedAt: this.now().toISOString(),
      },
      captureStage: "document_front",
      recoveryAction: "upload_document",
      allowedActions: ["capture_document_front"],
      processedKeys: [...current.processedKeys, idempotencyKey],
    };
    await this.repository.put(request.accountId, next, stored?.version ?? 0);
    await this.appendAudit(request.accountId, "adult_eligibility.authorize", idempotencyKey);
    return next;
  }

  public async submitAppeal(
    request: SubmitAdultEligibilityAppealRequest,
    idempotencyKey: string,
  ): Promise<RealNameVerificationView> {
    const stored = await this.repository.get(request.accountId);
    if (!stored) throw new Error("ADULT_ELIGIBILITY_VERIFICATION_NOT_FOUND");
    if (stored.value.processedKeys.includes(idempotencyKey)) return stored.value;
    assertVersion(request.expectedVersion, stored.value.version);
    if (!["rejected", "needs_review"].includes(stored.value.state)) {
      throw new Error("ADULT_ELIGIBILITY_INVALID_STATE");
    }
    const reason = request.reason.trim();
    if (reason.length < 2 || reason.length > 500) throw new Error("ADULT_ELIGIBILITY_APPEAL_INVALID");
    const next: RealNameVerificationRecord = {
      ...stored.value,
      state: "needs_review",
      version: stored.value.version + 1,
      appeal: {
        reason,
        submittedAt: this.now().toISOString(),
        status: "submitted",
      },
      recoveryAction: "contact_support",
      allowedActions: [],
      businessAccessAllowed: false,
      processedKeys: [...stored.value.processedKeys, idempotencyKey],
    };
    await this.repository.put(request.accountId, next, stored.version);
    await this.appendAudit(request.accountId, "adult_eligibility.appeal.submit", idempotencyKey);
    return next;
  }

  public async reviewAppeal(
    request: ReviewAdultEligibilityAppealRequest,
    reviewerId: string,
    idempotencyKey: string,
  ): Promise<RealNameVerificationView> {
    const stored = await this.repository.get(request.accountId);
    if (!stored?.value.appeal) throw new Error("ADULT_ELIGIBILITY_APPEAL_NOT_FOUND");
    if (stored.value.processedKeys.includes(idempotencyKey)) return stored.value;
    assertVersion(request.expectedVersion, stored.value.version);
    if (stored.value.state !== "needs_review") throw new Error("ADULT_ELIGIBILITY_INVALID_STATE");
    const approved = request.decision === "approve";
    const next: RealNameVerificationRecord = {
      ...stored.value,
      state: approved ? "collecting" : "rejected",
      version: stored.value.version + 1,
      appeal: {
        ...stored.value.appeal,
        status: approved ? "approved" : "rejected",
        reviewedAt: this.now().toISOString(),
      },
      recoveryAction: approved ? "upload_document" : "none",
      businessAccessAllowed: false,
      processedKeys: [...stored.value.processedKeys, idempotencyKey],
    };
    await this.repository.put(request.accountId, next, stored.version);
    await this.audit.append({
      id: `audit-adult-eligibility-review-${request.accountId}-${idempotencyKey}`,
      occurredAt: this.now().toISOString(),
      actorId: reviewerId,
      action: "adult_eligibility.appeal.review",
      subjectType: "adult_eligibility_verification",
      subjectId: request.accountId,
      outcome: "succeeded",
      reasonCode: request.decision,
      correlationId: idempotencyKey,
      synthetic: true,
    });
    return next;
  }

  private async appendAudit(
    accountId: string,
    action: string,
    correlationId: string,
    reasonCode?: AdultEligibilityFailureCode,
  ): Promise<void> {
    await this.audit.append({
      id: `audit-adult-eligibility-${accountId}-${correlationId}`,
      occurredAt: this.now().toISOString(),
      actorId: accountId,
      action,
      subjectType: "adult_eligibility_verification",
      subjectId: accountId,
      outcome: action.endsWith(".fail") ? "failed" : "succeeded",
      reasonCode: reasonCode ?? "synthetic_verification_flow",
      correlationId,
      synthetic: true,
    });
  }

  private async applyProviderResult(
    current: RealNameVerificationRecord,
    storageVersion: number,
    providerResult: AdultEligibilityProviderResult,
    idempotencyKey: string,
  ): Promise<RealNameVerificationView> {
    if (providerResult.status === "pending") {
      const pending: RealNameVerificationRecord = {
        ...current,
        version: current.version + 1,
        provider: {
          ...current.provider,
          requestId: providerResult.requestId,
          status: "pending",
        },
        processedKeys: [...current.processedKeys, idempotencyKey],
      };
      await this.repository.put(current.accountId, pending, storageVersion);
      await this.appendAudit(current.accountId, "adult_eligibility.provider.pending", idempotencyKey, "provider_timeout");
      return pending;
    }
    if (providerResult.status === "failed" || providerResult.status === "unknown" || !providerResult.identity) {
      const failureCode = providerResult.failureCode ?? "result_unknown";
      const failed: RealNameVerificationRecord = {
        ...current,
        state: "needs_retry",
        version: current.version + 1,
        failureCode,
        checks: {
          document: { status: "unknown", failureCode },
          age: { status: "unknown", failureCode },
          liveness: { status: "unknown", failureCode },
          faceMatch: { status: "unknown", failureCode },
        },
        recoveryAction: failureCode === "result_unknown" ? "contact_support" : "retry_verification",
        captureStage: "retry_required",
        provider: {
          ...current.provider,
          requestId: providerResult.requestId,
          status: providerResult.status,
          completedAt: providerResult.completedAt ?? this.now().toISOString(),
          lastErrorCode: failureCode,
        },
        allowedActions: failureCode === "result_unknown"
          ? ["refresh_provider_result", "submit_appeal"]
          : ["retry_capture", "submit_appeal"],
        processedKeys: [...current.processedKeys, idempotencyKey],
      };
      await this.repository.put(current.accountId, failed, storageVersion);
      await this.appendAudit(current.accountId, "adult_eligibility.fail", idempotencyKey, failureCode);
      return failed;
    }
    const identity = providerResult.identity;
    return this.confirmSyntheticResult({
      accountId: current.accountId,
      expectedVersion: current.version,
      legalName: identity.legalName,
      documentNumber: identity.documentNumber,
      birthDate: identity.birthDate,
      legalGender: identity.legalGender,
      documentStatus: identity.documentStatus,
      livenessStatus: identity.livenessStatus,
      faceMatchStatus: identity.faceMatchStatus,
      ...(identity.documentFailureCode ? { documentFailureCode: identity.documentFailureCode as never } : {}),
      ...(identity.livenessFailureCode ? { livenessFailureCode: identity.livenessFailureCode as never } : {}),
      ...(identity.faceMatchFailureCode ? { faceMatchFailureCode: identity.faceMatchFailureCode as never } : {}),
      syntheticResult: true,
    }, idempotencyKey, {
      storageVersion,
      providerResult,
    });
  }
}

function initialVerification(accountId: string): RealNameVerificationRecord {
  return {
    accountId,
    state: "not_started",
    version: 0,
    requiredDocumentSides: ["front", "back"],
    uploadedDocuments: [],
    checks: emptyChecks(),
    recoveryAction: "upload_document",
    captureStage: "intro",
    provider: { status: "not_started" },
    allowedActions: ["authorize"],
    businessAccessAllowed: false,
    realIdentityDataEnabled: false,
    realBiometricDataEnabled: false,
    externalIdentityProviderEnabled: false,
    consent: {
      identityProcessingAuthorized: false,
      biometricProcessingAuthorized: false,
      thirdPartyProcessingAuthorized: false,
    },
    synthetic: true,
    processedKeys: [],
  };
}

function toProviderTrace(value: RealNameVerificationRecord): AdultEligibilityProviderTrace {
  return {
    accountId: value.accountId,
    state: value.state,
    ...(value.provider.providerId ? { providerId: value.provider.providerId } : {}),
    ...(value.provider.requestId ? { providerRequestId: value.provider.requestId } : {}),
    providerStatus: value.provider.status,
    ...(value.provider.submittedAt ? { submittedAt: value.provider.submittedAt } : {}),
    ...(value.provider.completedAt ? { completedAt: value.provider.completedAt } : {}),
    checks: value.checks,
    ...(value.failureCode ? { failureCode: value.failureCode } : {}),
    businessAccessAllowed: value.businessAccessAllowed,
    ...(value.appeal ? { appealStatus: value.appeal.status } : {}),
    synthetic: true,
  };
}

function assertAuthorized(view: RealNameVerificationView): void {
  if (
    !view.consent.identityProcessingAuthorized ||
    !view.consent.biometricProcessingAuthorized ||
    !view.consent.thirdPartyProcessingAuthorized
  ) {
    throw new Error("ADULT_ELIGIBILITY_AUTHORIZATION_REQUIRED");
  }
}

function emptyChecks(): AdultEligibilityChecks {
  return {
    document: { status: "not_started" },
    age: { status: "not_started" },
    liveness: { status: "not_started" },
    faceMatch: { status: "not_started" },
  };
}

function pendingCheck(): VerificationCheck {
  return { status: "pending" };
}

function resolvedCheck(
  status: "passed" | "failed" | "unknown",
  failureCode: AdultEligibilityFailureCode | undefined,
  checkedAt: string,
): VerificationCheck {
  if (status === "passed") return { status, checkedAt };
  return {
    status,
    checkedAt,
    failureCode: failureCode ?? (status === "unknown" ? "result_unknown" : "manual_review_required"),
  };
}

function firstFailure(checks: AdultEligibilityChecks): AdultEligibilityFailureCode | undefined {
  for (const check of [checks.document, checks.age, checks.liveness, checks.faceMatch]) {
    if (check.status !== "passed") return check.failureCode ?? "result_unknown";
  }
  return undefined;
}

function failureState(
  failureCode: AdultEligibilityFailureCode | undefined,
): "needs_retry" | "needs_review" | "rejected" {
  if (failureCode === "underage") return "rejected";
  if (failureCode === "manual_review_required") return "needs_review";
  return "needs_retry";
}

function recoveryFor(
  failureCode: AdultEligibilityFailureCode | undefined,
): "retry_verification" | "submit_appeal" | "contact_support" {
  if (failureCode === "underage") return "submit_appeal";
  if (failureCode === "manual_review_required") return "contact_support";
  return "retry_verification";
}

function isAdult(birthDate: string, now: Date): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!match) throw new Error("ADULT_ELIGIBILITY_BIRTH_DATE_INVALID");
  const birth = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (
    birth.getUTCFullYear() !== Number(match[1]) ||
    birth.getUTCMonth() !== Number(match[2]) - 1 ||
    birth.getUTCDate() !== Number(match[3])
  ) {
    throw new Error("ADULT_ELIGIBILITY_BIRTH_DATE_INVALID");
  }
  const threshold = new Date(
    Date.UTC(now.getUTCFullYear() - 18, now.getUTCMonth(), now.getUTCDate()),
  );
  return birth <= threshold;
}

function assertVersion(expected: number, actual: number): void {
  if (expected !== actual) throw new Error("CONFLICT_VERSION_MISMATCH");
}

function assertMutable(view: RealNameVerificationView): void {
  if (["verified", "suspended", "revoked"].includes(view.state)) {
    throw new Error("ADULT_ELIGIBILITY_INVALID_STATE");
  }
}

function maskName(value: string): string {
  const normalized = value.trim();
  return normalized.length <= 1 ? "*" : `${normalized[0]}${"*".repeat(normalized.length - 1)}`;
}

function maskDocumentNumber(value: string): string {
  const normalized = value.trim();
  return normalized.length < 8
    ? "*".repeat(normalized.length)
    : `${normalized.slice(0, 3)}***********${normalized.slice(-4)}`;
}
