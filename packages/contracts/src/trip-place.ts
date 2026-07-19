export type TripPlaceSource = "synthetic_current_location" | "manual" | "saved" | "recent";

export type TripPlaceKind = "current_location" | "home" | "work" | "poi" | "custom";

export type TripCoordinate = Readonly<{
  latitude: number;
  longitude: number;
  synthetic: true;
}>;

export type TripPlace = Readonly<{
  placeId: string;
  label: string;
  address?: string;
  kind: TripPlaceKind;
  source: TripPlaceSource;
  coordinate?: TripCoordinate;
  synthetic: true;
}>;

export type TripRouteSummary = Readonly<{
  origin: TripPlace;
  destination: TripPlace;
  distanceMeters: number;
  estimatedDurationSeconds: number;
  encodedPath?: string;
  realMapEnabled: false;
  realLocationEnabled: false;
  realNavigationEnabled: false;
  synthetic: true;
}>;
