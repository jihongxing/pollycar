import type {
  CoordinateSystem,
  GeoPoint,
  MapProvider,
} from "@pollycar/contracts";

export type { MapProvider };

export interface CoordinateTransformer {
  transform(point: GeoPoint, target: CoordinateSystem): Promise<GeoPoint>;
}

export interface MapQuotaUsage {
  read(service: "search" | "reverse_geocode" | "route"): number;
  increment(service: "search" | "reverse_geocode" | "route"): void;
}
