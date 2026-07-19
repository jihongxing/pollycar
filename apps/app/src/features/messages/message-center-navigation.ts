import type { AppScreen } from "../vehicle-review/screens";

const detailTargetStorageKey = "rego.message-center.detail-target";
const tripConversationStorageKey = "rego.message-center.trip-conversation";

export function rememberMessageCenterDetail(target: AppScreen): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(detailTargetStorageKey, target);
}

export function consumeMessageCenterDetailReturn(
  target: AppScreen,
): "message-center" | undefined {
  if (typeof window === "undefined") return undefined;
  if (window.sessionStorage.getItem(detailTargetStorageKey) !== target) {
    return undefined;
  }
  window.sessionStorage.removeItem(detailTargetStorageKey);
  return "message-center";
}

export function rememberMessageCenterTrip(tripId: string): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(tripConversationStorageKey, tripId);
}

export function consumeMessageCenterTrip(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const tripId =
    window.sessionStorage.getItem(tripConversationStorageKey) ?? undefined;
  window.sessionStorage.removeItem(tripConversationStorageKey);
  return tripId;
}
