import { authorizationHeader } from "./session-credentials";
import type {
  ApiErrorResponse,
  ResubmitVehicleMaterialCommand,
  SaveVehicleDraftCommand,
  SubmitVehicleReviewCommand,
  VehicleReviewClient,
  VehicleReviewView,
} from "@pollycar/contracts";
import { reportSessionAuthenticationFailure } from "./session-credentials";

export class HttpVehicleReviewClient implements VehicleReviewClient {
  public constructor(
    private readonly baseUrl: string,
    private readonly fetcher: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {}

  public get(applicationId: string, _accountId: string): Promise<VehicleReviewView> {
    return this.request(
      `/v1/internal-sandbox/app/vehicle-reviews/${encodeURIComponent(applicationId)}`,
    );
  }

  public saveDraft(command: SaveVehicleDraftCommand): Promise<VehicleReviewView> {
    return this.write(
      `/v1/internal-sandbox/app/vehicle-reviews/${encodeURIComponent(command.applicationId)}/draft`,
      command.idempotencyKey,
      {
        vehicleType: command.vehicleType,
        maxPassengerCount: command.maxPassengerCount,
        insuranceExpiresOn: command.insuranceExpiresOn,
        syntheticAttachmentId: command.syntheticAttachmentId,
        expectedVersion: command.expectedVersion,
      },
    );
  }

  public submit(command: SubmitVehicleReviewCommand): Promise<VehicleReviewView> {
    return this.write(
      `/v1/internal-sandbox/app/vehicle-reviews/${encodeURIComponent(command.applicationId)}/submit`,
      command.idempotencyKey,
      { expectedVersion: command.expectedVersion },
    );
  }

  public resubmitMaterial(
    command: ResubmitVehicleMaterialCommand,
  ): Promise<VehicleReviewView> {
    return this.write(
      `/v1/internal-sandbox/app/vehicle-reviews/${encodeURIComponent(command.applicationId)}/material-resubmit`,
      command.idempotencyKey,
      {
        insuranceExpiresOn: command.insuranceExpiresOn,
        syntheticAttachmentId: command.syntheticAttachmentId,
        expectedVersion: command.expectedVersion,
      },
    );
  }

  private async write(
    path: string,
    idempotencyKey: string,
    body: Readonly<Record<string, unknown>>,
  ): Promise<VehicleReviewView> {
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

  private async request<TResult>(
    path: string,
    init: RequestInit = {},
  ): Promise<TResult> {
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
      const text = await response.text();
      if (text) {
        try {
          const payload = JSON.parse(text) as ApiErrorResponse;
          if (payload.error.code) {
            reportSessionAuthenticationFailure(payload.error.code);
            throw new Error(payload.error.code);
          }
        } catch (error) {
          if (error instanceof Error && error.message !== "Unexpected end of JSON input") throw error;
        }
      }
      throw new Error(response.status >= 500 ? "SERVICE_UNAVAILABLE" : "INTERNAL_UNEXPECTED_ERROR");
    }
    return await response.json() as TResult;
  }
}

function createCorrelationId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `app-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

