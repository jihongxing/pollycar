import type { RideDraft } from "./ride-model";

import {
  readBrowserStorage,
  removeBrowserStorage,
  writeBrowserStorage,
} from "../../infrastructure/browser-storage";

const storageKey = "rego.ride.draft.v1";

export function loadRideDraft(): RideDraft | undefined {
  const raw = readBrowserStorage(storageKey);
  if (!raw) return undefined;
  try {
    const value = JSON.parse(raw) as RideDraft;
    if (
      !value.origin?.address ||
      ![1, 2, 3].includes(value.passengerCount) ||
      !["immediate", "scheduled"].includes(value.timing?.mode)
    ) {
      return undefined;
    }
    return value;
  } catch {
    return undefined;
  }
}

export function saveRideDraft(draft: RideDraft): void {
  writeBrowserStorage(storageKey, JSON.stringify(draft));
}

export function clearRideDraft(): void {
  removeBrowserStorage(storageKey);
}
