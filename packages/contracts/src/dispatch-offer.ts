import type { AvailableDriverTripView } from "./synthetic-trip.js";

export type DispatchOfferState =
  | "offered"
  | "viewed"
  | "accepted"
  | "expired"
  | "withdrawn";

export type DriverDispatchLocation = Readonly<{
  latitude: number;
  longitude: number;
  coordinateSystem: "gcj02";
  accuracyMeters: number;
  capturedAt: string;
  synthetic: true;
}>;

export type DriverDispatchPresenceView = Readonly<{
  accountId: string;
  state: "online" | "offline";
  location?: DriverDispatchLocation;
  locationFreshUntil?: string;
  updatedAt: string;
  productionEnabled: false;
  realLocationEnabled: false;
  backgroundLocationEnabled: false;
  synthetic: true;
}>;

export type DispatchOfferView = Readonly<{
  offerId: string;
  tripId: string;
  tripVersion: number;
  driverAccountId: string;
  state: DispatchOfferState;
  dispatchRound: number;
  distanceMeters: number;
  offeredAt: string;
  expiresAt: string;
  trip: AvailableDriverTripView;
  synthetic: true;
}>;

export type DriverDispatchOffersView = Readonly<{
  offers: readonly DispatchOfferView[];
  serverTime: string;
  productionEnabled: false;
  realPushEnabled: false;
  synthetic: true;
}>;

export type UpdateDriverDispatchPresenceRequest = Readonly<{
  state: "online" | "offline";
  location?: DriverDispatchLocation;
}>;

export type AcceptDispatchOfferRequest = Readonly<{
  expectedTripVersion: number;
}>;

