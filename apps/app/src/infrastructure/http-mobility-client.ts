import { authorizationHeader } from "./session-credentials";
import type {
  AvailableDriverTripView,
  ApiErrorResponse,
  DriverOrderDetail,
  DriverOrderState,
  DriverOrderSummary,
  DriverDispatchOffersView,
  DriverWalletView,
  PickupVerification,
  SyntheticTripView,
  TripCancellationEligibility,
  TripCancellationRequest,
} from "@pollycar/contracts";

export type DriverAvailabilityView = Readonly<{
  accountId: string;
  state: "offline" | "online" | "busy";
  returnOnlineAfterTrip: boolean;
  updatedAt: string;
  productionEnabled: false;
  synthetic: true;
}>;

export type CompletionIntent = Readonly<{
  token: string;
  tripId: string;
  driverAccountId: string;
  tripVersion: number;
  expiresAt: string;
  consumedAt?: string;
  synthetic: true;
}>;

export class HttpMobilityClient {
  public constructor(
    private readonly baseUrl: string,
    private readonly fetcher: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {}

  public getDriverAvailability(): Promise<DriverAvailabilityView> {
    return this.request("/v1/internal-sandbox/app/driver/availability");
  }

  public async setDriverAvailability(
    state: "online" | "offline",
    returnOnlineAfterTrip = true,
  ): Promise<DriverAvailabilityView> {
    const correlationId = createCorrelationId();
    await this.write(
      "/v1/internal-sandbox/app/driver/dispatch-presence",
      `driver-dispatch-presence-${state}-${correlationId}`,
      {
        state,
        ...(state === "online"
          ? {
              location: {
                latitude: 31.2304,
                longitude: 121.4737,
                coordinateSystem: "gcj02",
                accuracyMeters: 20,
                capturedAt: new Date().toISOString(),
                synthetic: true,
              },
            }
          : {}),
      },
    );
    return this.getDriverAvailability();
  }

  public async listAvailableTrips(): Promise<readonly AvailableDriverTripView[]> {
    const response = await this.request<DriverDispatchOffersView>(
      "/v1/internal-sandbox/app/driver/offers",
    );
    return response.offers.map((offer) => offer.trip);
  }

  public listDriverOrders(state?: DriverOrderState): Promise<readonly DriverOrderSummary[]> {
    const query = state ? `?state=${encodeURIComponent(state)}` : "";
    return this.request(`/v1/internal-sandbox/app/driver/orders${query}`);
  }

  public getDriverOrder(orderId: string): Promise<DriverOrderDetail> {
    return this.request(
      `/v1/internal-sandbox/app/driver/orders/${encodeURIComponent(orderId)}`,
    );
  }

  public getFinanceOverview(): Promise<DriverWalletView> {
    return this.request("/v1/internal-sandbox/app/driver/finance/overview");
  }

  public getCancellationEligibility(tripId: string): Promise<TripCancellationEligibility> {
    return this.request(
      `/v1/internal-sandbox/app/synthetic-trips/${encodeURIComponent(tripId)}/cancellation-eligibility`,
    );
  }

  public cancelAcceptedTrip(
    tripId: string,
    expectedVersion: number,
    details?: Omit<TripCancellationRequest, "tripId" | "expectedVersion">,
  ): Promise<SyntheticTripView> {
    return this.write(
      `/v1/internal-sandbox/app/synthetic-trips/${encodeURIComponent(tripId)}/cancel-accepted`,
      `mobility-cancel-accepted-${tripId}-${expectedVersion}`,
      { expectedVersion, ...details },
    );
  }

  public getPickupVerification(tripId: string): Promise<PickupVerification> {
    return this.request(
      `/v1/internal-sandbox/app/synthetic-trips/${encodeURIComponent(tripId)}/pickup-verification`,
    );
  }

  public markDriverEnRoute(tripId: string, expectedVersion: number): Promise<SyntheticTripView> {
    return this.tripAction(tripId, "driver-en-route", expectedVersion);
  }

  public markDriverArrived(tripId: string, expectedVersion: number): Promise<SyntheticTripView> {
    return this.tripAction(tripId, "driver-arrived", expectedVersion);
  }

  public verifyBoarding(
    tripId: string,
    expectedVersion: number,
    code: string,
  ): Promise<SyntheticTripView> {
    return this.tripAction(tripId, "verify-boarding", expectedVersion, { code });
  }

  public createCompletionIntent(
    tripId: string,
    expectedVersion: number,
  ): Promise<CompletionIntent> {
    return this.tripAction(tripId, "completion-intents", expectedVersion);
  }

  public completeWithIntent(
    tripId: string,
    expectedVersion: number,
    completionIntentToken: string,
  ): Promise<SyntheticTripView> {
    return this.tripAction(tripId, "complete-with-intent", expectedVersion, {
      completionIntentToken,
    });
  }

  private tripAction<TResult = SyntheticTripView>(
    tripId: string,
    action: string,
    expectedVersion: number,
    body: Readonly<Record<string, unknown>> = {},
  ): Promise<TResult> {
    return this.write(
      `/v1/internal-sandbox/app/synthetic-trips/${encodeURIComponent(tripId)}/${action}`,
      `mobility-${action}-${tripId}-${expectedVersion}-${createCorrelationId()}`,
      { expectedVersion, ...body },
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
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

