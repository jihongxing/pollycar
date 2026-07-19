import type {
  AdminSafetyCaseClient,
  AdminSafetyCaseDetail,
  AdminSafetyCaseSummary,
  ApiErrorResponse,
} from "@pollycar/contracts";

export class HttpAdminSafetyClient implements AdminSafetyCaseClient {
  public constructor(
    private readonly baseUrl: string,
    private readonly fetcher: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {}

  public listCases(): Promise<readonly AdminSafetyCaseSummary[]> {
    return this.request("/v1/internal-sandbox/admin/safety-cases");
  }

  public getCase(caseId: string): Promise<AdminSafetyCaseDetail> {
    return this.request(`/v1/internal-sandbox/admin/safety-cases/${encodeURIComponent(caseId)}`);
  }

  public resolveCase(
    caseId: string,
    expectedVersion: number,
    outcome: "restore_access" | "uphold_freeze",
  ): Promise<AdminSafetyCaseDetail> {
    return this.request(
      `/v1/internal-sandbox/admin/safety-cases/${encodeURIComponent(caseId)}/resolution`,
      {
        method: "POST",
        headers: { "Idempotency-Key": `safety-${outcome}-${caseId}-${expectedVersion + 1}` },
        body: JSON.stringify({ expectedVersion, outcome }),
      },
    );
  }

  private async request<TResult>(path: string, init: RequestInit = {}): Promise<TResult> {
    let response: Response;
    try {
      response = await this.fetcher(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          Authorization: "Sandbox synthetic-safety-001",
          "Content-Type": "application/json",
          "X-Correlation-Id": createCorrelationId(),
          ...init.headers,
        },
      });
    } catch {
      throw new Error(init.method === "POST" ? "UNKNOWN_RESULT" : "SERVICE_UNAVAILABLE");
    }
    if (!response.ok) {
      const payload = (await response.json()) as ApiErrorResponse;
      throw new Error(payload.error.code);
    }
    return await response.json() as TResult;
  }
}

function createCorrelationId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `safety-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
