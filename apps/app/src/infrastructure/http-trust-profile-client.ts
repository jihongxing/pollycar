import { authorizationHeader } from "./session-credentials";
import type {
  AccountTrustProfile,
  ApiErrorResponse,
  FairnessMonitoringReport,
  SubmitAvatarCommand,
  SubmitTripRatingCommand,
  TripRatingView,
  TrustProfileClient,
} from "@pollycar/contracts";

export class HttpTrustProfileClient implements TrustProfileClient {
  constructor(
    private readonly baseUrl: string,
    private readonly fetcher: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {}

  getProfile(): Promise<AccountTrustProfile> {
    return this.request("/v1/internal-sandbox/app/trust-profile");
  }

  submitAvatar(command: SubmitAvatarCommand): Promise<AccountTrustProfile> {
    return this.request("/v1/internal-sandbox/app/trust-profile/avatar", {
      method: "POST",
      headers: { "Idempotency-Key": command.idempotencyKey },
      body: JSON.stringify({ asset: command.asset }),
    });
  }

  getFairnessReport(): Promise<FairnessMonitoringReport> {
    return this.request("/v1/internal-sandbox/app/trust-profile/fairness");
  }

  getRating(tripId: string): Promise<TripRatingView | undefined> {
    return this.request(`/v1/internal-sandbox/app/synthetic-trips/${encodeURIComponent(tripId)}/rating`);
  }

  submitRating(command: SubmitTripRatingCommand): Promise<TripRatingView> {
    return this.request(`/v1/internal-sandbox/app/synthetic-trips/${encodeURIComponent(command.tripId)}/rating`, {
      method: "POST",
      headers: { "Idempotency-Key": command.idempotencyKey },
      body: JSON.stringify({
        score: command.score,
        tags: command.tags ?? [],
        ...(command.note ? { note: command.note } : {}),
      }),
    });
  }

  private async request<TResult>(path: string, init: RequestInit = {}): Promise<TResult> {
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: authorizationHeader(),
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
    if (!response.ok) {
      const payload = await response.json() as ApiErrorResponse;
      throw new Error(payload.error.code);
    }
    if (response.status === 204) return undefined as TResult;
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as TResult;
  }
}

