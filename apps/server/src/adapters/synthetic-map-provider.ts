import type {
  GeoPoint,
  MapPlace,
  PlaceSearchRequest,
  PlaceSearchResult,
  PlannedRoute,
  ReverseGeocodeRequest,
  RoutePlanningRequest,
} from "@pollycar/contracts";
import type { CoordinateTransformer, MapProvider } from "../ports/map-location.js";

const places: readonly MapPlace[] = [
  place("synthetic-current", "人民广场", "黄浦区人民大道 · 合成上车点", 31.2304, 121.4737),
  place("synthetic-home", "静安寺", "静安寺 · 合成地址", 31.2235, 121.4455),
  place("synthetic-work", "陆家嘴", "陆家嘴 · 合成地址", 31.2397, 121.4998),
  place("synthetic-hongqiao", "虹桥站", "虹桥 · 合成终点", 31.1979, 121.3270),
  place("synthetic-xujiahui", "徐家汇", "徐家汇 · 合成终点", 31.1885, 121.4365),
];

export class StrictCoordinateTransformer implements CoordinateTransformer {
  public async transform(point: GeoPoint, target: GeoPoint["coordinateSystem"]): Promise<GeoPoint> {
    validateGeoPoint(point);
    if (point.coordinateSystem !== target) throw new Error("MAP_COORDINATE_TRANSFORM_UNAVAILABLE");
    return point;
  }
}

export class SyntheticMapProvider implements MapProvider {
  public constructor(private readonly now: () => Date = () => new Date()) {}

  public async searchPlaces(request: PlaceSearchRequest): Promise<PlaceSearchResult> {
    const query = request.query.trim().toLocaleLowerCase();
    const matches = places
      .filter((item) => `${item.name} ${item.formattedAddress}`.toLocaleLowerCase().includes(query))
      .slice(0, request.limit);
    return {
      places: matches,
      provider: "synthetic",
      cache: {
        hit: false,
        keyScope: "query",
        expiresAt: new Date(this.now().getTime() + 300_000).toISOString(),
      },
    };
  }

  public async reverseGeocode(request: ReverseGeocodeRequest): Promise<MapPlace> {
    validateGeoPoint(request.location);
    const nearest = places
      .map((item) => ({ item, distance: squaredDistance(item.location, request.location) }))
      .sort((left, right) => left.distance - right.distance)[0];
    return nearest && nearest.distance <= 0.01
      ? nearest.item
      : {
          placeId: `manual-${request.location.latitude.toFixed(5)}-${request.location.longitude.toFixed(5)}`,
          name: "地图选定位置",
          formattedAddress: `${request.location.latitude.toFixed(5)}, ${request.location.longitude.toFixed(5)}`,
          location: request.location,
          kind: "manual_pin",
          source: "manual",
          provider: "synthetic",
        };
  }

  public async planDrivingRoute(request: RoutePlanningRequest): Promise<PlannedRoute> {
    validateGeoPoint(request.origin);
    validateGeoPoint(request.destination);
    const distanceMeters = Math.max(800, Math.round(haversineMeters(request.origin, request.destination) * 1.18));
    const durationSeconds = Math.max(300, Math.round(distanceMeters / 8.5));
    const generatedAt = this.now();
    return {
      routeId: `synthetic-route-${hash(`${pointKey(request.origin)}:${pointKey(request.destination)}:${request.strategy}`)}`,
      origin: request.origin,
      destination: request.destination,
      distanceMeters,
      durationSeconds,
      encodedPolyline: `${pointKey(request.origin)};${pointKey(request.destination)}`,
      generatedAt: generatedAt.toISOString(),
      expiresAt: new Date(generatedAt.getTime() + 60_000).toISOString(),
      provider: "synthetic",
      includesLiveTraffic: false,
    };
  }
}

export function validateGeoPoint(point: GeoPoint): void {
  if (!point.coordinateSystem) throw new Error("MAP_COORDINATE_SYSTEM_REQUIRED");
  if (!Number.isFinite(point.latitude) || point.latitude < -90 || point.latitude > 90) {
    throw new Error("MAP_COORDINATE_INVALID");
  }
  if (!Number.isFinite(point.longitude) || point.longitude < -180 || point.longitude > 180) {
    throw new Error("MAP_COORDINATE_INVALID");
  }
  if (decimalPlaces(point.latitude) > 6 || decimalPlaces(point.longitude) > 6) {
    throw new Error("MAP_COORDINATE_PRECISION_EXCEEDED");
  }
}

function place(id: string, name: string, address: string, latitude: number, longitude: number): MapPlace {
  return {
    placeId: id,
    name,
    formattedAddress: address,
    location: { latitude, longitude, coordinateSystem: "gcj02" },
    kind: "poi",
    source: "provider",
    provider: "synthetic",
  };
}

function squaredDistance(left: GeoPoint, right: GeoPoint): number {
  return (left.latitude - right.latitude) ** 2 + (left.longitude - right.longitude) ** 2;
}

function haversineMeters(left: GeoPoint, right: GeoPoint): number {
  const radians = (value: number) => (value * Math.PI) / 180;
  const lat = radians(right.latitude - left.latitude);
  const lon = radians(right.longitude - left.longitude);
  const value = Math.sin(lat / 2) ** 2
    + Math.cos(radians(left.latitude)) * Math.cos(radians(right.latitude)) * Math.sin(lon / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function pointKey(point: GeoPoint): string {
  return `${point.latitude.toFixed(6)},${point.longitude.toFixed(6)},${point.coordinateSystem}`;
}

function decimalPlaces(value: number): number {
  const [, fraction = ""] = value.toString().split(".");
  return fraction.length;
}

function hash(value: string): string {
  let result = 0;
  for (const character of value) result = (result * 31 + character.charCodeAt(0)) >>> 0;
  return result.toString(36);
}
