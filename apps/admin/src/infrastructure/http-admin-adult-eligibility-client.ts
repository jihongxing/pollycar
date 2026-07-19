import type {
  AdminAdultEligibilityTraceClient,
  AdultEligibilityProviderTrace,
  ApiErrorResponse,
} from "@pollycar/contracts";

export class HttpAdminAdultEligibilityClient implements AdminAdultEligibilityTraceClient {
  public constructor(
    private readonly baseUrl: string,
    private readonly fetcher: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {}

  public list(): Promise<readonly AdultEligibilityProviderTrace[]> {
    return this.request("/v1/internal-sandbox/admin/adult-eligibility");
  }

  public get(accountId: string): Promise<AdultEligibilityProviderTrace> {
    return this.request(`/v1/internal-sandbox/admin/adult-eligibility/${encodeURIComponent(accountId)}`);
  }

  private async request<TResult>(path: string): Promise<TResult> {
    let response: Response;
    try {
      response = await this.fetcher(`${this.baseUrl}${path}`, {
        headers: {
          Authorization: "Sandbox synthetic-reviewer-001",
          "X-Correlation-Id": `identity-trace-${Date.now()}`,
        },
      });
    } catch {
      throw new Error("SERVICE_UNAVAILABLE");
    }
    if (!response.ok) {
      const payload = (await response.json()) as ApiErrorResponse;
      throw new Error(payload.error.code);
    }
    return await response.json() as TResult;
  }
}
