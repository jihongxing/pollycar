import type { PassengerTripDetailOrigin } from "../application/synthetic-trip-context";
import type { AppScreen } from "../features/vehicle-review/screens";
import type { UserIdentity } from "../identity/identity-context";
import {
  readBrowserSessionStorage,
  removeBrowserSessionStorage,
  writeBrowserSessionStorage,
} from "../infrastructure/browser-storage";

export type PassengerTripHistoryFilter =
  | "all"
  | "active"
  | "completed"
  | "closed";

export type DriverOrderHistoryFilter =
  | "all"
  | "active"
  | "completed"
  | "cancelled";

const passengerTripIdKey = "rego.journey.passenger-trip-id";
const passengerTripOriginKey = "rego.journey.passenger-trip-origin";
const passengerHistoryFilterKey = "rego.journey.passenger-history-filter";
const driverOrderIdKey = "rego.journey.driver-order-id";
const driverHistoryFilterKey = "rego.journey.driver-history-filter";
const messageDetailTargetKey = "rego.message-center.detail-target";
const messageTripConversationKey = "rego.message-center.trip-conversation";

export function rememberPassengerTripDetail(
  tripId: string,
  origin: PassengerTripDetailOrigin,
): void {
  storage()?.setItem(passengerTripIdKey, tripId);
  storage()?.setItem(passengerTripOriginKey, origin);
}

export function readPassengerTripDetail():
  | Readonly<{ tripId: string; origin: PassengerTripDetailOrigin }>
  | undefined {
  const currentStorage = storage();
  const tripId = currentStorage?.getItem(passengerTripIdKey);
  const origin = currentStorage?.getItem(passengerTripOriginKey);
  if (!tripId || !isPassengerTripDetailOrigin(origin)) return undefined;
  return { tripId, origin };
}

export function rememberDriverOrder(orderId: string): void {
  storage()?.setItem(driverOrderIdKey, orderId);
}

export function readDriverOrder(): string | undefined {
  return storage()?.getItem(driverOrderIdKey) ?? undefined;
}

export function readPassengerHistoryFilter(): PassengerTripHistoryFilter {
  const value = storage()?.getItem(passengerHistoryFilterKey);
  return isPassengerHistoryFilter(value) ? value : "all";
}

export function rememberPassengerHistoryFilter(
  filter: PassengerTripHistoryFilter,
): void {
  storage()?.setItem(passengerHistoryFilterKey, filter);
}

export function readDriverHistoryFilter(): DriverOrderHistoryFilter {
  const value = storage()?.getItem(driverHistoryFilterKey);
  return isDriverHistoryFilter(value) ? value : "all";
}

export function rememberDriverHistoryFilter(
  filter: DriverOrderHistoryFilter,
): void {
  storage()?.setItem(driverHistoryFilterKey, filter);
}

export function clearIdentityScopedJourneyState(): void {
  const currentStorage = storage();
  if (!currentStorage) return;
  [
    passengerTripIdKey,
    passengerTripOriginKey,
    passengerHistoryFilterKey,
    driverOrderIdKey,
    driverHistoryFilterKey,
    messageDetailTargetKey,
    messageTripConversationKey,
  ].forEach((key) => currentStorage.removeItem(key));
}

export function identityRedirectForScreen(
  screen: AppScreen,
  identity: UserIdentity,
): AppScreen | undefined {
  if (identity === "passenger" && driverOnlyScreens.has(screen)) {
    return "ride-home";
  }
  if (identity === "owner" && passengerOnlyScreens.has(screen)) {
    return "driver-home";
  }
  return undefined;
}

function storage(): Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  return {
    getItem: (key) => readBrowserSessionStorage(key) ?? null,
    setItem: writeBrowserSessionStorage,
    removeItem: removeBrowserSessionStorage,
  };
}

function isPassengerTripDetailOrigin(
  value: string | null | undefined,
): value is PassengerTripDetailOrigin {
  return ["history", "current", "result", "message"].includes(value ?? "");
}

function isPassengerHistoryFilter(
  value: string | null | undefined,
): value is PassengerTripHistoryFilter {
  return ["all", "active", "completed", "closed"].includes(value ?? "");
}

function isDriverHistoryFilter(
  value: string | null | undefined,
): value is DriverOrderHistoryFilter {
  return ["all", "active", "completed", "cancelled"].includes(value ?? "");
}

const passengerOnlyScreens = new Set<AppScreen>([
  "ride-home",
  "ride-search",
  "ride-confirmation",
  "ride-matching",
  "ride-pickup",
  "ride-cancellation",
  "ride-active",
  "ride-completion",
  "ride-history",
  "ride-detail",
  "passenger-workbench",
  "trip-create",
  "trip-payment",
  "trip-matching",
  "trip-active",
  "trip-result",
  "trip-recovery",
]);

const driverOnlyScreens = new Set<AppScreen>([
  "driver-home",
  "driver-orders",
  "driver-pickup",
  "driver-waiting-pickup",
  "driver-active",
  "driver-completion",
  "driver-history",
  "driver-order-detail",
  "driver-wallet",
  "driver-bank-card",
  "driver-withdraw",
  "driver-offers",
  "driver-trip",
  "owner-workbench",
]);
