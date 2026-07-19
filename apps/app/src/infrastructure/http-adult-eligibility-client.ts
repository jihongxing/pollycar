import { authorizationHeader } from "./session-credentials";
import type {
  AdultEligibilityVerificationClient,
  AdultEligibilityVerificationView,
  AdultEligibilitySdkSession,
  ApiErrorResponse,
  AuthorizeAdultEligibilityVerificationRequest,
  SaveSyntheticIdentityDocumentRequest,
  SubmitAdultEligibilityAppealRequest,
  SubmitAdultEligibilityVerificationRequest,
} from "@pollycar/contracts";

export class HttpAdultEligibilityClient implements AdultEligibilityVerificationClient {
  public constructor(
    private readonly baseUrl: string,
    private readonly fetcher: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {}

  public get() {
    return this.request();
  }
  public authorize(request: Omit<AuthorizeAdultEligibilityVerificationRequest, "accountId">) {
    return this.write("/authorization", request);
  }
  public saveDocument(request: Omit<SaveSyntheticIdentityDocumentRequest, "accountId">) {
    return this.write("/documents", request);
  }
  public submit(request: Omit<SubmitAdultEligibilityVerificationRequest, "accountId">) {
    return this.write("/submission", request);
  }
  public createSdkSession(request: Readonly<{ expectedVersion: number; syntheticScenario?: "passed" }>) {
    return this.writeSession("/sdk-session", request);
  }
  public refreshProviderResult(expectedVersion: number) {
    return this.write("/provider-result", { expectedVersion });
  }
  public submitAppeal(request: Omit<SubmitAdultEligibilityAppealRequest, "accountId">) {
    return this.write("/appeal", request);
  }

  private write(path: string, body: object) {
    return this.request(path, {
      method: "POST",
      headers: { "Idempotency-Key": `adult-${Date.now()}-${Math.random().toString(16).slice(2)}` },
      body: JSON.stringify(body),
    });
  }

  private async writeSession(path: string, body: object): Promise<AdultEligibilitySdkSession> {
    const response = await this.fetcher(
      `${this.baseUrl}/v1/internal-sandbox/app/adult-eligibility${path}`,
      {
        method: "POST",
        headers: {
          Authorization: authorizationHeader(),
          "Content-Type": "application/json",
          "X-Correlation-Id": `adult-sdk-${Date.now()}`,
          "Idempotency-Key": `adult-sdk-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        },
        body: JSON.stringify(body),
      },
    );
    if (!response.ok) {
      const payload = (await response.json()) as ApiErrorResponse;
      throw new Error(payload.error.code);
    }
    return (await response.json()) as AdultEligibilitySdkSession;
  }

  private async request(path = "", init: RequestInit = {}): Promise<AdultEligibilityVerificationView> {
    const response = await this.fetcher(
      `${this.baseUrl}/v1/internal-sandbox/app/adult-eligibility${path}`,
      {
        ...init,
        headers: {
          Authorization: authorizationHeader(),
          "Content-Type": "application/json",
          "X-Correlation-Id": `adult-${Date.now()}`,
          ...init.headers,
        },
      },
    );
    if (!response.ok) {
      const payload = (await response.json()) as ApiErrorResponse;
      throw new Error(payload.error.code);
    }
    return (await response.json()) as AdultEligibilityVerificationView;
  }
}

