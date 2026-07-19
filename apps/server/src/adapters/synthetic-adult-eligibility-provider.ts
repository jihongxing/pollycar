import type { AdultEligibilityFailureCode } from "@pollycar/contracts";
import type { AdultEligibilityProvider, AdultEligibilityProviderResult } from "../ports/adult-eligibility-provider.js";

export class SyntheticAdultEligibilityProvider implements AdultEligibilityProvider {
  public readonly providerId = "synthetic-adult-eligibility";
  public readonly realDataEnabled = false;

  public async createSession(request: Readonly<{
    accountId: string;
    scenario?: string;
    expiresAt: string;
  }>) {
    const scenario = request.scenario ?? "passed";
    return {
      sessionId: `synthetic-session-${request.accountId}-${scenario}`,
      providerId: this.providerId,
      clientToken: `synthetic-client-token-${request.accountId}`,
      expiresAt: request.expiresAt,
      sdkMode: "synthetic" as const,
      requestedChecks: [
        "identity_document",
        "adult_age",
        "liveness",
        "face_match",
      ] as const,
      realIdentityDataEnabled: false,
      realBiometricDataEnabled: false,
      externalIdentityProviderEnabled: false,
    };
  }

  public async verifyCallback(request: Readonly<{ signature: string; rawBody: string }>) {
    if (request.signature !== "synthetic-valid-signature") {
      throw new Error("AUTHORIZATION_DENIED");
    }
    const callback = JSON.parse(request.rawBody) as {
      callbackId: string;
      sessionId: string;
      requestId: string;
      occurredAt: string;
      status: "completed" | "pending" | "failed" | "unknown";
      failureCode?: AdultEligibilityFailureCode;
    };
    const scenario = callback.sessionId.split("-").at(-1) ?? "passed";
    return {
      callback: {
        ...callback,
        providerId: this.providerId,
        ...(callback.failureCode ? { failureCode: callback.failureCode } : {}),
        synthetic: true,
      },
      result: resultFor(callback.requestId, scenario),
    };
  }

  public async verify(request: Readonly<{
    accountId: string;
    scenario?: string;
    syntheticDocuments: true;
    syntheticFaceCapture: true;
  }>): Promise<AdultEligibilityProviderResult> {
    if (!request.syntheticDocuments || !request.syntheticFaceCapture) {
      throw new Error("REAL_IDENTITY_DATA_FORBIDDEN");
    }
    const requestId = `synthetic-provider-${request.accountId}-${request.scenario ?? "passed"}`;
    return resultFor(requestId, request.scenario ?? "passed");
  }

  public async refresh(requestId: string): Promise<AdultEligibilityProviderResult> {
    const scenario = requestId.split("-").at(-1) ?? "passed";
    return resultFor(requestId, scenario);
  }
}

function resultFor(requestId: string, scenario: string): AdultEligibilityProviderResult {
  if (scenario === "provider_timeout") return { requestId, status: "pending" };
  if (scenario === "provider_unavailable") {
    return { requestId, status: "failed", failureCode: "provider_unavailable" };
  }
  if (scenario === "result_unknown") {
    return { requestId, status: "unknown", failureCode: "result_unknown" };
  }
  const failure = scenario === "passed" ? undefined : scenario;
  return {
    requestId,
    status: "completed",
    completedAt: new Date().toISOString(),
    identity: {
      legalName: "合成人",
      documentNumber: "310101199001010000",
      birthDate: scenario === "underage" ? "2012-01-01" : "1990-01-01",
      legalGender: "female",
      documentStatus: failure === "document_invalid" || failure === "document_expired" ? "failed" : "passed",
      livenessStatus: failure === "liveness_failed" ? "failed" : "passed",
      faceMatchStatus: failure === "face_mismatch" ? "failed" : "passed",
      ...(failure === "document_invalid" || failure === "document_expired"
        ? { documentFailureCode: failure }
        : {}),
      ...(failure === "liveness_failed" ? { livenessFailureCode: failure } : {}),
      ...(failure === "face_mismatch" ? { faceMatchFailureCode: failure } : {}),
    },
  };
}
