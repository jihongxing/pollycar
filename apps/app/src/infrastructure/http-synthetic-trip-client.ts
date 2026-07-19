import { authorizationHeader } from "./session-credentials";
import type {
  ApiErrorResponse,
  PassengerCount,
  SyntheticTripClient,
  SyntheticTripDashboard,
  SyntheticTripScene,
  SyntheticTripRevision,
  SyntheticTripView,
  TripBookingAvailability,
  TripCancellationEligibility,
  TripCancellationRequest,
  TripPlace,
  TripTiming,
} from "@pollycar/contracts";
import { reportSessionAuthenticationFailure } from "./session-credentials";

export class HttpSyntheticTripClient implements SyntheticTripClient {
  public constructor(
    private readonly baseUrl: string,
    private readonly fetcher: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {}

  public getDashboard(): Promise<SyntheticTripDashboard> {
    return this.request("/v1/internal-sandbox/app/synthetic-trips/dashboard");
  }

  public getBookingAvailability(): Promise<TripBookingAvailability> {
    return this.request("/v1/internal-sandbox/app/synthetic-trips/booking-availability");
  }

  public create(
    origin: string | TripPlace,
    destination: string | TripPlace,
    passengerCount: PassengerCount,
    scene?: SyntheticTripScene,
    timing?: TripTiming,
    estimatedDurationMinutes?: number,
  ): Promise<SyntheticTripView> {
    const suffix = createCorrelationId();
    return this.write("/v1/internal-sandbox/app/synthetic-trips", `trip-create-${suffix}`, {
      tripId: `synthetic-trip-${suffix}`,
      originLabel: typeof origin === "string" ? origin : origin.label,
      destinationLabel: typeof destination === "string" ? destination : destination.label,
      ...(typeof origin === "string" ? {} : { origin }),
      ...(typeof destination === "string" ? {} : { destination }),
      passengerCount,
      ...(scene ? { scene } : {}),
      ...(timing ? { timing } : {}),
      ...(estimatedDurationMinutes ? { estimatedDurationMinutes } : {}),
    });
  }

  public pay(tripId: string, expectedVersion: number): Promise<SyntheticTripView> {
    return this.action(tripId, "payment", expectedVersion);
  }

  public reschedule(
    tripId: string,
    expectedVersion: number,
    revision: SyntheticTripRevision,
  ): Promise<SyntheticTripView> {
    return this.write(
      `/v1/internal-sandbox/app/synthetic-trips/${encodeURIComponent(tripId)}/reschedule`,
      `trip-reschedule-${tripId}-${expectedVersion + 1}`,
      { expectedVersion, ...revision },
    );
  }

  public accept(
    tripId: string,
    expectedVersion: number,
    dispatchOfferId?: string,
  ): Promise<SyntheticTripView> {
    if (dispatchOfferId) {
      return this.write(
        `/v1/internal-sandbox/app/driver/offers/${encodeURIComponent(dispatchOfferId)}/accept`,
        `trip-accept-${tripId}-${expectedVersion + 1}`,
        { expectedTripVersion: expectedVersion },
      );
    }
    return this.action(tripId, "accept", expectedVersion);
  }

  public start(tripId: string, expectedVersion: number): Promise<SyntheticTripView> {
    return this.action(tripId, "start", expectedVersion);
  }

  public complete(tripId: string, expectedVersion: number): Promise<SyntheticTripView> {
    return this.action(tripId, "complete", expectedVersion);
  }

  public cancel(
    tripId: string,
    expectedVersion: number,
    details?: Omit<TripCancellationRequest, "tripId" | "expectedVersion">,
  ): Promise<SyntheticTripView> {
    return this.write(
      `/v1/internal-sandbox/app/synthetic-trips/${encodeURIComponent(tripId)}/cancel`,
      `trip-cancel-${tripId}-${expectedVersion + 1}`,
      { expectedVersion, ...details },
    );
  }

  public getCancellationEligibility(tripId: string): Promise<TripCancellationEligibility> {
    return this.request(
      `/v1/internal-sandbox/app/synthetic-trips/${encodeURIComponent(tripId)}/cancellation-eligibility`,
    );
  }

  public reconcileTimeout(tripId: string, expectedVersion: number): Promise<SyntheticTripView> {
    return this.action(tripId, "reconcile-timeout", expectedVersion);
  }

  private action(tripId: string, action: string, expectedVersion: number) {
    return this.write(
      `/v1/internal-sandbox/app/synthetic-trips/${encodeURIComponent(tripId)}/${action}`,
      `trip-${action}-${tripId}-${expectedVersion + 1}`,
      { expectedVersion },
    );
  }

  private async write(
    path: string,
    idempotencyKey: string,
    body: Readonly<Record<string, unknown>>,
  ): Promise<SyntheticTripView> {
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
      reportSessionAuthenticationFailure(payload.error.code);
      throw new Error(payload.error.code);
    }
    return (await response.json()) as TResult;
  }
}

function createCorrelationId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

