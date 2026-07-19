import type { RideDraft } from "./ride-model";

const storageKey = "rego.ride.draft.v1";

export function loadRideDraft(): RideDraft | undefined {
  if (typeof window === "undefined") return undefined;
  const raw = window.localStorage.getItem(storageKey);
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
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(draft));
}

export function clearRideDraft(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(storageKey);
}
