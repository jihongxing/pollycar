import type {
  MapPlace,
  MapProvider,
  PlaceSearchRequest,
  PlaceSearchResult,
  PlannedRoute,
  ReverseGeocodeRequest,
  RoutePlanningRequest,
} from "@pollycar/contracts";
import type { SecretProvider } from "../ports/secret-provider.js";

type AmapWebServiceConfig = Readonly<{
  enabled: boolean;
  apiBaseUrl: string;
  keyReference?: string;
}>;

export class AmapWebServiceProvider implements MapProvider {
  public constructor(
    private readonly config: AmapWebServiceConfig,
    private readonly secrets: SecretProvider,
    private readonly fetcher: typeof fetch = globalThis.fetch.bind(globalThis),
    private readonly now: () => Date = () => new Date(),
  ) {}

  public searchPlaces(request: PlaceSearchRequest): Promise<PlaceSearchResult> {
    return this.call("v5/place/text", {
      keywords: request.query,
      page_size: String(request.limit),
      ...(request.cityCode ? { region: request.cityCode } : {}),
      ...(request.biasLocation
        ? { location: pointParameter(requireGcj02(request.biasLocation)) }
        : {}),
    }, (payload) => {
      const record = successPayload(payload);
      const pois = requiredArray(record.pois);
      return {
        places: pois.map(parsePlace),
        provider: "amap",
        cache: {
          hit: false,
          keyScope: "query",
          expiresAt: new Date(this.now().getTime() + 300_000).toISOString(),
        },
      };
    });
  }

  public reverseGeocode(request: ReverseGeocodeRequest): Promise<MapPlace> {
    const location = requireGcj02(request.location);
    return this.call("v3/geocode/regeo", {
      location: pointParameter(location),
      radius: String(request.radiusMeters),
      extensions: "all",
    }, (payload) => parseReverseGeocode(successPayload(payload), location));
  }

  public planDrivingRoute(request: RoutePlanningRequest): Promise<PlannedRoute> {
    const origin = requireGcj02(request.origin);
    const destination = requireGcj02(request.destination);
    return this.call("v5/direction/driving", {
      origin: pointParameter(origin),
      destination: pointParameter(destination),
      strategy: routeStrategy(request.strategy),
      show_fields: "cost,polyline",
    }, (payload) => parseRoute(
      successPayload(payload),
      origin,
      destination,
      request.includeTraffic,
      this.now(),
    ));
  }

  private async call<T>(
    path: string,
    parameters: Readonly<Record<string, string>>,
    parse: (payload: unknown) => T,
  ): Promise<T> {
    if (!this.config.enabled) throw new Error("AMAP_WEB_SERVICE_DISABLED");
    if (!this.config.keyReference) {
      throw new Error("AMAP_WEB_SERVICE_KEY_REFERENCE_MISSING");
    }
    const key = await this.secrets.read(this.config.keyReference);
    if (!key) throw new Error("AMAP_WEB_SERVICE_KEY_MISSING");
    const query = new URLSearchParams({ ...parameters, key });
    const response = await this.fetcher(
      `${this.config.apiBaseUrl.replace(/\/$/, "")}/${path}?${query.toString()}`,
    );
    if (!response.ok) throw new Error("MAP_PROVIDER_UNAVAILABLE");
    return parse(await response.json());
  }
}

function successPayload(payload: unknown): Record<string, unknown> {
  const record = requiredRecord(payload);
  if (record.status !== "1" || record.infocode !== "10000") {
    throw new Error("MAP_PROVIDER_UNAVAILABLE");
  }
  return record;
}

function parsePlace(value: unknown): MapPlace {
  const record = requiredRecord(value);
  const providerPlaceId = requiredText(record.id);
  const location = parsePoint(record.location);
  const entranceLocation = optionalPoint(record.entr_location);
  const cityCode = optionalText(record.citycode);
  const district = optionalText(record.adname);
  return {
    placeId: `amap:${providerPlaceId}`,
    providerPlaceId,
    name: requiredText(record.name),
    formattedAddress: optionalText(record.address) ?? optionalText(record.pname) ?? requiredText(record.name),
    ...(cityCode ? { cityCode } : {}),
    ...(district ? { district } : {}),
    location,
    ...(entranceLocation ? { entranceLocation } : {}),
    kind: "poi",
    source: "provider",
    provider: "amap",
  };
}

function parseReverseGeocode(
  payload: Record<string, unknown>,
  requestedLocation: MapPlace["location"],
): MapPlace {
  const regeocode = requiredRecord(payload.regeocode);
  const addressComponent = optionalRecord(regeocode.addressComponent);
  const firstPoi = optionalArray(regeocode.pois)?.[0];
  const poi = firstPoi ? optionalRecord(firstPoi) : undefined;
  const providerPlaceId = poi ? optionalText(poi.id) : undefined;
  const location = poi?.location ? parsePoint(poi.location) : requestedLocation;
  const name = poi ? optionalText(poi.name) : undefined;
  const cityCode = addressComponent ? optionalText(addressComponent.citycode) : undefined;
  const district = addressComponent ? optionalText(addressComponent.district) : undefined;
  return {
    placeId: providerPlaceId
      ? `amap:${providerPlaceId}`
      : `amap:reverse:${location.longitude.toFixed(6)},${location.latitude.toFixed(6)}`,
    ...(providerPlaceId ? { providerPlaceId } : {}),
    name: name ?? "地图选定位置",
    formattedAddress: requiredText(regeocode.formatted_address),
    ...(cityCode ? { cityCode } : {}),
    ...(district ? { district } : {}),
    location,
    kind: providerPlaceId ? "poi" : "address",
    source: "provider",
    provider: "amap",
  };
}

function parseRoute(
  payload: Record<string, unknown>,
  origin: PlannedRoute["origin"],
  destination: PlannedRoute["destination"],
  includeTraffic: boolean,
  generatedAt: Date,
): PlannedRoute {
  const route = requiredRecord(payload.route);
  const path = requiredRecord(requiredArray(route.paths)[0]);
  const distanceMeters = requiredNumber(path.distance);
  const cost = optionalRecord(path.cost);
  const durationSeconds = requiredNumber(cost?.duration ?? path.duration);
  const encodedPolyline = routePolyline(path);
  return {
    routeId: `amap-route-${hash(`${pointParameter(origin)}:${pointParameter(destination)}:${encodedPolyline}`)}`,
    origin,
    destination,
    distanceMeters,
    durationSeconds,
    ...(includeTraffic ? { trafficDurationSeconds: durationSeconds } : {}),
    encodedPolyline,
    generatedAt: generatedAt.toISOString(),
    expiresAt: new Date(generatedAt.getTime() + 60_000).toISOString(),
    provider: "amap",
    includesLiveTraffic: includeTraffic,
  };
}

function routePolyline(path: Record<string, unknown>): string {
  const direct = optionalText(path.polyline);
  if (direct) return direct;
  const steps = requiredArray(path.steps);
  const points: string[] = [];
  for (const stepValue of steps) {
    const polyline = requiredText(requiredRecord(stepValue).polyline);
    for (const point of polyline.split(";").filter(Boolean)) {
      if (points.at(-1) !== point) points.push(point);
    }
  }
  if (points.length < 2) throw new Error("AMAP_RESPONSE_UNSUPPORTED");
  return points.join(";");
}

function parsePoint(value: unknown): MapPlace["location"] {
  const text = requiredText(value);
  const [longitudeText, latitudeText, ...rest] = text.split(",");
  if (!longitudeText || !latitudeText || rest.length > 0) {
    throw new Error("AMAP_RESPONSE_UNSUPPORTED");
  }
  const longitude = Number(longitudeText);
  const latitude = Number(latitudeText);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    throw new Error("AMAP_RESPONSE_UNSUPPORTED");
  }
  return { latitude, longitude, coordinateSystem: "gcj02" };
}

function optionalPoint(value: unknown): MapPlace["location"] | undefined {
  const text = optionalText(value);
  return text ? parsePoint(text) : undefined;
}

function requireGcj02<T extends MapPlace["location"]>(point: T): T {
  if (point.coordinateSystem !== "gcj02") {
    throw new Error("MAP_COORDINATE_TRANSFORM_UNAVAILABLE");
  }
  return point;
}

function pointParameter(point: MapPlace["location"]): string {
  return `${point.longitude},${point.latitude}`;
}

function routeStrategy(strategy: RoutePlanningRequest["strategy"]): string {
  if (strategy === "avoid_congestion") return "4";
  if (strategy === "avoid_tolls") return "6";
  return "0";
}

function requiredRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("AMAP_RESPONSE_UNSUPPORTED");
  }
  return value as Record<string, unknown>;
}

function optionalRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function requiredArray(value: unknown): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error("AMAP_RESPONSE_UNSUPPORTED");
  return value;
}

function optionalArray(value: unknown): readonly unknown[] | undefined {
  return Array.isArray(value) ? value : undefined;
}

function requiredText(value: unknown): string {
  const text = optionalText(value);
  if (!text) throw new Error("AMAP_RESPONSE_UNSUPPORTED");
  return text;
}

function optionalText(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    const first = value.find((item): item is string => typeof item === "string" && item.trim().length > 0);
    return first?.trim();
  }
  return undefined;
}

function requiredNumber(value: unknown): number {
  const number = typeof value === "number" ? value : Number(optionalText(value));
  if (!Number.isFinite(number) || number < 0) throw new Error("AMAP_RESPONSE_UNSUPPORTED");
  return number;
}

function hash(value: string): string {
  let result = 0;
  for (const character of value) result = (result * 31 + character.charCodeAt(0)) >>> 0;
  return result.toString(36);
}
