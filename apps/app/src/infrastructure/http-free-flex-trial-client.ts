import { authorizationHeader } from "./session-credentials";
import type { ApiErrorResponse, FreeFlexTrialClient, FreeFlexTrialView } from "@pollycar/contracts";
import { reportSessionAuthenticationFailure } from "./session-credentials";

export class HttpFreeFlexTrialClient implements FreeFlexTrialClient {
  public constructor(
    private readonly baseUrl: string,
    private readonly fetcher: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {}

  public get(): Promise<FreeFlexTrialView> {
    return this.request("/v1/internal-sandbox/app/free-flex-trial");
  }

  public submit(expectedVersion: number, idempotencyKey: string): Promise<FreeFlexTrialView> {
    return this.write("/v1/internal-sandbox/app/free-flex-trial", expectedVersion, idempotencyKey);
  }

  public confirm(expectedVersion: number, idempotencyKey: string): Promise<FreeFlexTrialView> {
    return this.write(
      "/v1/internal-sandbox/app/free-flex-trial/confirmation",
      expectedVersion,
      idempotencyKey,
    );
  }

  private async write(path: string, expectedVersion: number, idempotencyKey: string) {
    try {
      return await this.request(path, {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({ expectedVersion }),
      });
    } catch (error) {
      if (error instanceof TypeError) throw new Error("UNKNOWN_RESULT");
      throw error;
    }
  }

  private async request(path: string, init: RequestInit = {}): Promise<FreeFlexTrialView> {
    let response: Response;
    try {
      response = await this.fetcher(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          Authorization: authorizationHeader(),
          "Content-Type": "application/json",
          "X-Correlation-Id": createCorrelationId(),
          ...init.headers,
        },
      });
    } catch (error) {
      if (init.method === "POST") throw error;
      throw new Error("SERVICE_UNAVAILABLE");
    }
    if (!response.ok) {
      const payload = (await response.json()) as ApiErrorResponse;
      reportSessionAuthenticationFailure(payload.error.code);
      throw new Error(payload.error.code);
    }
    return (await response.json()) as FreeFlexTrialView;
  }
}

function createCorrelationId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `free-flex-${Date.now()}`;
}

