import type { LegalGender } from "./real-name-verification.js";

export type PublicRatingSummary = Readonly<{
  average: number;
  ratingCount: number;
}>;

export type TripPartyPublicProfile = Readonly<{
  accountId: string;
  displayName: string;
  avatarUrl?: string;
  gender: LegalGender;
  genderSource: "verified_identity_document";
  genderDisclosure:
    | "eligible_driver_pre_acceptance"
    | "matched_passenger_post_acceptance";
  rating?: PublicRatingSummary;
  synthetic: true;
}>;

export type PreMatchTripPartyProfile = TripPartyPublicProfile &
  Readonly<{ genderDisclosure: "eligible_driver_pre_acceptance" }>;

export type VehiclePublicSummary = Readonly<{
  vehicleId: string;
  color: string;
  make: string;
  model: string;
  licensePlate: string;
  maxPassengerCount: 1 | 2 | 3;
  synthetic: true;
}>;

export type PickupVerification = Readonly<{
  code: string;
  expiresAt?: string;
  synthetic: true;
}>;

export type SyntheticVehiclePosition = Readonly<{
  latitude: number;
  longitude: number;
  capturedAt: string;
  estimatedArrivalAt?: string;
  realLocationEnabled: false;
  synthetic: true;
}>;
