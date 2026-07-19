import { authorizationHeader } from "./session-credentials";
import type {
  ApiErrorResponse,
  SafetyCaseClient,
  SafetyCaseView,
  SafetyDashboard,
} from "@pollycar/contracts";

export class HttpSafetyCaseClient implements SafetyCaseClient {
  public constructor(
    private readonly baseUrl: string,
    private readonly fetcher: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {}

  public getDashboard(tripId: string): Promise<SafetyDashboard> {
    return this.request(`/v1/internal-sandbox/app/synthetic-trips/${encodeURIComponent(tripId)}/safety`);
  }

  public sendMessage(tripId: string, body: string): Promise<SafetyDashboard> {
    return this.write(
      `/v1/internal-sandbox/app/synthetic-trips/${encodeURIComponent(tripId)}/safety/messages`,
      `chat-${tripId}-${Date.now()}`,
      { body },
    );
  }

  public report(tripId: string, reasonCode: SafetyCaseView["reasonCode"]): Promise<SafetyDashboard> {
    return this.write(
      `/v1/internal-sandbox/app/synthetic-trips/${encodeURIComponent(tripId)}/safety/reports`,
      `report-${tripId}-${Date.now()}`,
      { reasonCode },
    );
  }

  public appeal(caseId: string, expectedVersion: number): Promise<SafetyCaseView> {
    return this.write(
      `/v1/internal-sandbox/app/safety-cases/${encodeURIComponent(caseId)}/appeal`,
      `appeal-${caseId}-${expectedVersion + 1}`,
      { expectedVersion },
    );
  }

  private async write<TResult>(
    path: string,
    idempotencyKey: string,
    body: Readonly<Record<string, unknown>>,
  ): Promise<TResult> {
    try {
      return await this.request(path, {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(body),
      });
    } catch (error) {
      if (error instanceof TypeError) throw new Error("UNKNOWN_RESULT");
      throw error;
    }
  }

  private async request<TResult>(path: string, init: RequestInit = {}): Promise<TResult> {
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
      throw new Error(payload.error.code);
    }
    return (await response.json()) as TResult;
  }
}

function createCorrelationId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `safety-${Date.now()}`;
}

