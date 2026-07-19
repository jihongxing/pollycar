import type { PassengerCount } from "./passenger-capacity.js";
import type {
  TripCancellationEligibility,
  TripCancellationRecord,
  TripCancellationRequest,
} from "./trip-cancellation.js";
import type {
  PickupVerification,
  SyntheticVehiclePosition,
  TripPartyPublicProfile,
  VehiclePublicSummary,
} from "./trip-party-profile.js";
import type { TripPlace, TripRouteSummary } from "./trip-place.js";
import type { TripRatingView } from "./trip-rating.js";
import type {
  TripBookingAvailability,
  TripScheduleNotice,
  TripTiming,
} from "./trip-scheduling.js";

export type SyntheticTripScene = "commute" | "airport" | "medical" | "other";

export type SyntheticTripState =
  | "pending_payment"
  | "paid_pending_match"
  | "scheduled"
  | "reserved"
  | "preparing"
  | "accepted"
  | "driver_en_route"
  | "driver_arrived"
  | "in_progress"
  | "safety_frozen"
  | "completed"
  | "unfulfilled"
  | "cancelled";

export type SyntheticTripClosureReason =
  | "passenger_cancelled"
  | "driver_cancelled"
  | "payment_timeout"
  | "matching_timeout";

export type SyntheticTripRecovery = Readonly<{
  state:
    | "none"
    | "driver_acceptance_released"
    | "cancellation_confirmed"
    | "timeout_closed";
  recoveredAt?: string;
  source?: "idempotency_replay" | "state_reconciliation" | "timeout_worker";
}>;

export type SyntheticTripView = Readonly<{
  tripId: string;
  passengerAccountId: string;
  driverAccountId?: string;
  state: SyntheticTripState;
  version: number;
  originLabel: string;
  destinationLabel: string;
  origin?: TripPlace;
  destination?: TripPlace;
  route?: TripRouteSummary;
  timing?: TripTiming;
  estimatedDurationMinutes?: number;
  scheduleNotices?: readonly TripScheduleNotice[];
  passengerCount: PassengerCount;
  scene?: SyntheticTripScene;
  passengerProfile?: TripPartyPublicProfile;
  driverProfile?: TripPartyPublicProfile;
  vehicle?: VehiclePublicSummary;
  pickupVerification?: PickupVerification;
  vehiclePosition?: SyntheticVehiclePosition;
  cancellationEligibility?: TripCancellationEligibility;
  cancellation?: TripCancellationRecord;
  rating?: TripRatingView;
  payment: Readonly<{
    amountMinor: 0;
    currency: "CNY";
    realPayment: false;
    state: "pending_payment" | "paid_pending_match" | "closed";
  }>;
  quotaPolicy?: "base" | "flex";
  createdAt: string;
  acceptedAt?: string;
  startedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  closureReason?: SyntheticTripClosureReason;
  recovery: SyntheticTripRecovery;
  synthetic: true;
}>;

export type AvailableDriverTripView = Readonly<{
  tripId: string;
  dispatchOfferId?: string;
  version: number;
  state: "paid_pending_match" | "scheduled";
  originLabel: string;
  destinationLabel: string;
  passengerCount: PassengerCount;
  scene?: SyntheticTripScene;
  timing?: TripTiming;
  estimatedDurationMinutes?: number;
  passengerProfile: TripPartyPublicProfile;
  synthetic: true;
}>;

export type SyntheticTripDashboard = Readonly<{
  passengerTrip?: SyntheticTripView;
  passengerTrips?: readonly SyntheticTripView[];
  availableDriverTrips: readonly SyntheticTripView[];
  reservedDriverTrips?: readonly SyntheticTripView[];
  activeDriverTrip?: SyntheticTripView;
  productionEnabled: false;
  realPayment: false;
  shanghaiPilot: false;
}>;

export type SyntheticTripRevision = Readonly<{
  originLabel?: string;
  destinationLabel?: string;
  passengerCount?: PassengerCount;
  scene?: SyntheticTripScene | null;
  timing: TripTiming;
  estimatedDurationMinutes?: number;
}>;

export interface SyntheticTripClient {
  getDashboard(): Promise<SyntheticTripDashboard>;
  getBookingAvailability(): Promise<TripBookingAvailability>;
  create(
    origin: string | TripPlace,
    destination: string | TripPlace,
    passengerCount: PassengerCount,
    scene?: SyntheticTripScene,
    timing?: TripTiming,
    estimatedDurationMinutes?: number,
  ): Promise<SyntheticTripView>;
  pay(tripId: string, expectedVersion: number): Promise<SyntheticTripView>;
  reschedule(
    tripId: string,
    expectedVersion: number,
    revision: SyntheticTripRevision,
  ): Promise<SyntheticTripView>;
  accept(
    tripId: string,
    expectedVersion: number,
    dispatchOfferId?: string,
  ): Promise<SyntheticTripView>;
  start(tripId: string, expectedVersion: number): Promise<SyntheticTripView>;
  complete(tripId: string, expectedVersion: number): Promise<SyntheticTripView>;
  cancel(
    tripId: string,
    expectedVersion: number,
    details?: Omit<TripCancellationRequest, "tripId" | "expectedVersion">,
  ): Promise<SyntheticTripView>;
  getCancellationEligibility(tripId: string): Promise<TripCancellationEligibility>;
  reconcileTimeout(tripId: string, expectedVersion: number): Promise<SyntheticTripView>;
}
