export type CoordinateSystem = "wgs84" | "gcj02";

export type GeoPoint = Readonly<{
  latitude: number;
  longitude: number;
  coordinateSystem: CoordinateSystem;
}>;

export type MapPlace = Readonly<{
  placeId: string;
  providerPlaceId?: string;
  name: string;
  formattedAddress: string;
  cityCode?: string;
  district?: string;
  location: GeoPoint;
  entranceLocation?: GeoPoint;
  kind: "poi" | "address" | "manual_pin" | "current_location";
  source: "device" | "provider" | "manual" | "saved" | "recent";
  confidence?: number;
  provider: "synthetic" | "amap";
}>;

export type PlaceSearchRequest = Readonly<{
  query: string;
  cityCode?: string;
  biasLocation?: GeoPoint;
  limit: number;
}>;

export type PlaceSearchResult = Readonly<{
  places: readonly MapPlace[];
  cache: MapCacheMetadata;
  provider: "synthetic" | "amap";
}>;

export type ReverseGeocodeRequest = Readonly<{
  location: GeoPoint;
  radiusMeters: number;
}>;

export type RoutePlanningRequest = Readonly<{
  origin: GeoPoint;
  destination: GeoPoint;
  strategy: "fastest" | "avoid_congestion" | "avoid_tolls";
  includeTraffic: boolean;
}>;

export type PlannedRoute = Readonly<{
  routeId: string;
  origin: GeoPoint;
  destination: GeoPoint;
  distanceMeters: number;
  durationSeconds: number;
  trafficDurationSeconds?: number;
  encodedPolyline: string;
  generatedAt: string;
  expiresAt: string;
  provider: "synthetic" | "amap";
  includesLiveTraffic: boolean;
}>;

export type VehicleLocationUpdate = Readonly<{
  tripId: string;
  accountId: string;
  sequence: number;
  capturedAt: string;
  location: GeoPoint;
  accuracyMeters: number;
  speedMetersPerSecond?: number;
  headingDegrees?: number;
  appState: "foreground" | "background";
}>;

export type VehicleLocationView = Readonly<{
  update?: VehicleLocationUpdate;
  freshness: "fresh" | "aging" | "stale" | "unavailable";
  receivedAt: string;
  nextUploadAllowedAt?: string;
  uploadIntervalSeconds: 3 | 5 | 10;
  stopped: boolean;
  stopReason?: "trip_not_active" | "trip_closed" | "gate_closed";
  realLocationEnabled: false;
  synthetic: true;
}>;

export type VehicleLocationStage =
  | "accepted"
  | "driver_en_route"
  | "driver_arrived"
  | "in_progress"
  | "closed";

export type VehicleLocationEvidenceHold = Readonly<{
  tripId: string;
  enabled: boolean;
  reason: "safety_case" | "released";
  updatedAt: string;
  synthetic: true;
}>;

export type MapCacheMetadata = Readonly<{
  hit: boolean;
  keyScope: "query" | "coordinate_grid" | "route";
  expiresAt: string;
}>;

export type MapCapabilityGates = Readonly<{
  realMapEnabled: boolean;
  externalMapProviderEnabled: boolean;
  realDeviceLocationEnabled: boolean;
  backgroundLocationEnabled: boolean;
  realVehicleLocationStreamEnabled: boolean;
  amapSdkEnabled: boolean;
  amapWebServiceEnabled: boolean;
}>;

export interface MapProvider {
  searchPlaces(request: PlaceSearchRequest): Promise<PlaceSearchResult>;
  reverseGeocode(request: ReverseGeocodeRequest): Promise<MapPlace>;
  planDrivingRoute(request: RoutePlanningRequest): Promise<PlannedRoute>;
}

export interface CoordinateTransformer {
  transform(point: GeoPoint, target: CoordinateSystem): Promise<GeoPoint>;
}
