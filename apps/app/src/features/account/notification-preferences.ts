import type { SyntheticNotificationItem } from "@pollycar/contracts";

import { readBrowserStorage, writeBrowserStorage } from "../../infrastructure/browser-storage";

export type NotificationPreferences = Readonly<{
  tripUpdates: boolean;
  ownerUpdates: boolean;
}>;

export const defaultNotificationPreferences: NotificationPreferences = Object.freeze({
  tripUpdates: true,
  ownerUpdates: true,
});

const storageKey = "rego.preference.notifications.v1";

export function readNotificationPreferences(): NotificationPreferences {
  const stored = readBrowserStorage(storageKey);
  if (!stored) return defaultNotificationPreferences;
  try {
    const value = JSON.parse(stored) as Partial<NotificationPreferences>;
    return {
      tripUpdates: value.tripUpdates !== false,
      ownerUpdates: value.ownerUpdates !== false,
    };
  } catch {
    return defaultNotificationPreferences;
  }
}

export function writeNotificationPreferences(preferences: NotificationPreferences): void {
  writeBrowserStorage(storageKey, JSON.stringify(preferences));
}

export function shouldShowNotification(
  item: SyntheticNotificationItem,
  preferences: NotificationPreferences,
): boolean {
  if (item.requiresAction || item.domain === "safety") return true;
  if (item.domain === "trip") return preferences.tripUpdates;
  if (item.domain === "review" || item.domain === "eligibility") {
    return preferences.ownerUpdates;
  }
  return true;
}
