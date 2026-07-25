import type {
  GeoPoint,
  MapPlace,
  PlaceSearchResult,
  PlannedRoute,
  RoutePlanningRequest,
  VehicleLocationStage,
  VehicleLocationUpdate,
  VehicleLocationView,
} from "@pollycar/contracts";
import { authorizationHeader } from "./session-credentials";

export class HttpMapLocationClient {
  public constructor(
    private readonly baseUrl: string,
    private readonly fetcher: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {}

  public searchPlaces(
    query: string,
    options: Readonly<{ limit?: number; cityCode?: string; biasLocation?: GeoPoint }> = {},
  ): Promise<PlaceSearchResult> {
    const search = new URLSearchParams({
      query,
      limit: String(options.limit ?? 10),
    });
    if (options.cityCode) search.set("city_code", options.cityCode);
    if (options.biasLocation) {
      search.set("bias_latitude", String(options.biasLocation.latitude));
      search.set("bias_longitude", String(options.biasLocation.longitude));
      search.set("bias_coordinate_system", options.biasLocation.coordinateSystem);
    }
    return this.request(
      `/v1/internal-sandbox/app/map/places/search?${search.toString()}`,
    );
  }

  public reverseGeocode(location: GeoPoint): Promise<MapPlace> {
    return this.write("/v1/internal-sandbox/app/map/reverse-geocode", {
      location,
      radiusMeters: 50,
    });
  }

  public planDrivingRoute(request: RoutePlanningRequest): Promise<PlannedRoute> {
    return this.write("/v1/internal-sandbox/app/map/routes/driving", request);
  }

  public getVehicleLocation(tripId: string): Promise<VehicleLocationView> {
    return this.request(
      `/v1/internal-sandbox/app/synthetic-trips/${encodeURIComponent(tripId)}/vehicle-location`,
    );
  }

  public uploadVehicleLocation(update: VehicleLocationUpdate): Promise<VehicleLocationView> {
    return this.write(
      `/v1/internal-sandbox/app/synthetic-trips/${encodeURIComponent(update.tripId)}/vehicle-location`,
      update,
    );
  }

  public setVehicleLocationStage(
    tripId: string,
    stage: VehicleLocationStage,
  ): Promise<VehicleLocationView> {
    return this.write(
      `/v1/internal-sandbox/app/synthetic-trips/${encodeURIComponent(tripId)}/vehicle-location/stage`,
      { stage },
    );
  }

  private async request<T>(path: string): Promise<T> {
    return this.send(path, { method: "GET" });
  }

  private async write<T>(path: string, body: unknown): Promise<T> {
    return this.send(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": createIdempotencyKey() },
      body: JSON.stringify(body),
    });
  }

  private async send<T>(path: string, init: RequestInit): Promise<T> {
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      ...init,
      headers: { ...init.headers, Authorization: authorizationHeader() },
    });
    const payload = await response.json() as T | { error: { code: string } };
    if (!response.ok) {
      const errorCode = typeof payload === "object" && payload !== null && "error" in payload
        ? payload.error.code
        : "SERVICE_UNAVAILABLE";
      throw new Error(errorCode);
    }
    return payload as T;
  }
}

function createIdempotencyKey(): string {
  return `map-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
