import type {
  AvailableDriverTripView,
  PassengerCount,
  SyntheticTripScene,
  SyntheticTripState,
  SyntheticTripView,
  TripTiming,
} from "@pollycar/contracts";

export type DriverAvailability = "offline" | "online" | "busy" | "blocked";
export type PublicGender = "female" | "male" | "undisclosed";
export type DriverOrderFilter = "all" | "active" | "completed" | "cancelled";

export type DriverEligibility = Readonly<{
  vehicleApproved: boolean;
  qualificationActive: boolean;
  quotaAvailable: boolean;
  safetyClear: boolean;
}>;

export type RiderPublicProfile = Readonly<{
  displayName: string;
  avatarUri?: string;
  gender: PublicGender;
  rating?: number;
  ratingCount?: number;
}>;

export type DriverTripCard = Readonly<{
  id: string;
  state: SyntheticTripState;
  pickupLabel: string;
  destinationLabel: string;
  passengerCount: PassengerCount;
  scene?: SyntheticTripScene;
  estimatedPickupDistanceKm?: number;
  estimatedDurationMinutes?: number;
  timing?: TripTiming;
  syntheticAmountCents: number;
  createdAt: string;
  rider: RiderPublicProfile;
}>;

export type DriverOrderDetail = DriverTripCard &
  Readonly<{
    acceptedAt?: string;
    startedAt?: string;
    completedAt?: string;
    cancelledAt?: string;
    cancellationSummary?: string;
    safetySummary?: string;
    settlementSummary: string;
  }>;

export type DriverTodaySummary = Readonly<{
  completedOrders: number;
  activeOrders: number;
  syntheticAmountCents: number;
}>;

export function canDriverGoOnline(eligibility: DriverEligibility): boolean {
  return (
    eligibility.vehicleApproved &&
    eligibility.qualificationActive &&
    eligibility.quotaAvailable &&
    eligibility.safetyClear
  );
}

export function resolveDriverAvailability(
  requestedOnline: boolean,
  eligibility: DriverEligibility,
  hasActiveTrip: boolean,
): DriverAvailability {
  if (!canDriverGoOnline(eligibility)) return "blocked";
  if (hasActiveTrip) return "busy";
  return requestedOnline ? "online" : "offline";
}

export function canAcceptDriverTrip(
  availability: DriverAvailability,
  trip: Pick<DriverTripCard, "passengerCount" | "state">,
  maxPassengerCount: PassengerCount,
): boolean {
  return (
    availability === "online" &&
    ["paid_pending_match", "scheduled"].includes(trip.state) &&
    trip.passengerCount <= maxPassengerCount
  );
}

export function filterDriverOrders(
  orders: readonly DriverOrderDetail[],
  filter: DriverOrderFilter,
): readonly DriverOrderDetail[] {
  if (filter === "all") return orders;
  if (filter === "completed") {
    return orders.filter((order) => order.state === "completed");
  }
  if (filter === "cancelled") {
    return orders.filter((order) => order.state === "cancelled");
  }
  return orders.filter((order) =>
    ["reserved", "preparing", "accepted", "driver_en_route", "driver_arrived", "in_progress", "safety_frozen"].includes(order.state),
  );
}

export function summarizeDriverToday(
  orders: readonly DriverOrderDetail[],
  todayIsoDate: string,
): DriverTodaySummary {
  const todayOrders = orders.filter((order) => order.createdAt.startsWith(todayIsoDate));
  return {
    completedOrders: todayOrders.filter((order) => order.state === "completed").length,
    activeOrders: todayOrders.filter((order) =>
      ["reserved", "preparing", "accepted", "driver_en_route", "driver_arrived", "in_progress", "safety_frozen"].includes(order.state),
    ).length,
    syntheticAmountCents: todayOrders
      .filter((order) => order.state === "completed")
      .reduce((total, order) => total + order.syntheticAmountCents, 0),
  };
}

export function tripViewToDriverCard(
  trip: SyntheticTripView | AvailableDriverTripView,
  rider: RiderPublicProfile,
): DriverTripCard {
  return {
    id: trip.tripId,
    state: trip.state,
    pickupLabel: trip.originLabel,
    destinationLabel: trip.destinationLabel,
    passengerCount: trip.passengerCount,
    scene: trip.scene,
    ...("timing" in trip && trip.timing ? { timing: trip.timing } : {}),
    ...("estimatedDurationMinutes" in trip && trip.estimatedDurationMinutes
      ? { estimatedDurationMinutes: trip.estimatedDurationMinutes }
      : {}),
    syntheticAmountCents: 0,
    createdAt: "createdAt" in trip ? trip.createdAt : new Date(0).toISOString(),
    rider,
  };
}

export function formatSyntheticAmount(amountCents: number): string {
  return `¥${(amountCents / 100).toFixed(2)}`;
}

export function publicGenderLabel(gender: PublicGender): string {
  if (gender === "female") return "♀";
  if (gender === "male") return "♂";
  return "未公开";
}

export function sceneLabel(scene?: SyntheticTripScene): string | undefined {
  if (scene === "commute") return "通勤";
  if (scene === "airport") return "机场／车站";
  if (scene === "medical") return "就医";
  if (scene === "other") return "其他";
  return undefined;
}
