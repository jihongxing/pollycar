import {
  readBrowserSessionStorage,
  writeBrowserSessionStorage,
} from "../../infrastructure/browser-storage";

const notificationDetailStorageKey = "rego.notification-center.detail";

export function rememberNotificationDetail(notificationId: string): void {
  writeBrowserSessionStorage(notificationDetailStorageKey, notificationId);
}

export function readNotificationDetail(): string | undefined {
  return readBrowserSessionStorage(notificationDetailStorageKey);
}
