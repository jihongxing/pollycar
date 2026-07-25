import type { AppScreen } from "../vehicle-review/screens";
import {
  readBrowserSessionStorage,
  removeBrowserSessionStorage,
  writeBrowserSessionStorage,
} from "../../infrastructure/browser-storage";

const detailTargetStorageKey = "rego.message-center.detail-target";
const tripConversationStorageKey = "rego.message-center.trip-conversation";

export function rememberMessageCenterDetail(target: AppScreen): void {
  writeBrowserSessionStorage(detailTargetStorageKey, target);
}

export function consumeMessageCenterDetailReturn(
  target: AppScreen,
): "message-center" | undefined {
  if (readBrowserSessionStorage(detailTargetStorageKey) !== target) {
    return undefined;
  }
  removeBrowserSessionStorage(detailTargetStorageKey);
  return "message-center";
}

export function rememberMessageCenterTrip(tripId: string): void {
  writeBrowserSessionStorage(tripConversationStorageKey, tripId);
}

export function consumeMessageCenterTrip(): string | undefined {
  const tripId = readBrowserSessionStorage(tripConversationStorageKey);
  removeBrowserSessionStorage(tripConversationStorageKey);
  return tripId;
}
