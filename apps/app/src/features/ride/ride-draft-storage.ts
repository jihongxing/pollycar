import type {
  PassengerCount,
  SyntheticTripScene,
  TripTiming,
} from "@pollycar/contracts";

import type { RideDraft, RidePlace } from "./ride-model";

import {
  readBrowserStorage,
  removeBrowserStorage,
  writeBrowserStorage,
} from "../../infrastructure/browser-storage";

const storageKey = "rego.ride.draft.v2";
const legacyStorageKey = "rego.ride.draft.v1";
const storageVersion = 2;

type StoredRideDraft = Readonly<{
  version: typeof storageVersion;
  draft: RideDraft;
}>;

export function loadRideDraft(): RideDraft | undefined {
  const currentDraft = readStoredDraft(readBrowserStorage(storageKey));
  if (currentDraft) return currentDraft;

  if (readBrowserStorage(storageKey)) {
    removeBrowserStorage(storageKey);
  }

  const legacyRaw = readBrowserStorage(legacyStorageKey);
  if (!legacyRaw) return undefined;

  try {
    const migrated = normalizeDraft(JSON.parse(legacyRaw));
    removeBrowserStorage(legacyStorageKey);
    if (!migrated) return undefined;
    saveRideDraft(migrated);
    return migrated;
  } catch {
    removeBrowserStorage(legacyStorageKey);
    return undefined;
  }
}

export function saveRideDraft(draft: RideDraft): void {
  const stored: StoredRideDraft = {
    version: storageVersion,
    draft,
  };
  writeBrowserStorage(storageKey, JSON.stringify(stored));
  removeBrowserStorage(legacyStorageKey);
}

export function clearRideDraft(): void {
  removeBrowserStorage(storageKey);
  removeBrowserStorage(legacyStorageKey);
}

function readStoredDraft(raw: string | undefined): RideDraft | undefined {
  if (!raw) return undefined;
  try {
    const stored = JSON.parse(raw) as Partial<StoredRideDraft>;
    if (stored.version !== storageVersion) return undefined;
    return normalizeDraft(stored.draft);
  } catch {
    return undefined;
  }
}

function normalizeDraft(value: unknown): RideDraft | undefined {
  if (!isRecord(value)) return undefined;

  const origin = normalizePlace(value.origin);
  const passengerCount = normalizePassengerCount(value.passengerCount);
  const timing = normalizeTiming(value.timing);
  if (!origin || !passengerCount || !timing) return undefined;

  const destination = normalizePlace(value.destination);
  const scene = normalizeScene(value.scene);
  return {
    origin,
    ...(destination ? { destination } : {}),
    passengerCount,
    ...(scene ? { scene } : {}),
    timing,
  };
}

function normalizePlace(value: unknown): RidePlace | undefined {
  if (!isRecord(value)) return undefined;
  if (
    !isNonEmptyString(value.id) ||
    !isNonEmptyString(value.label) ||
    !isNonEmptyString(value.address) ||
    !["current", "home", "work", "recent", "search"].includes(String(value.kind)) ||
    typeof value.synthetic !== "boolean"
  ) {
    return undefined;
  }

  const location = normalizeLocation(value.location);
  return {
    id: value.id.trim(),
    label: value.label.trim(),
    address: value.address.trim(),
    kind: value.kind as RidePlace["kind"],
    synthetic: value.synthetic,
    ...(location ? { location } : {}),
  };
}

function normalizeLocation(value: unknown): RidePlace["location"] | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) return undefined;
  if (
    typeof value.latitude !== "number" ||
    !Number.isFinite(value.latitude) ||
    value.latitude < -90 ||
    value.latitude > 90 ||
    typeof value.longitude !== "number" ||
    !Number.isFinite(value.longitude) ||
    value.longitude < -180 ||
    value.longitude > 180 ||
    !["gcj02", "wgs84"].includes(String(value.coordinateSystem))
  ) {
    return undefined;
  }
  return {
    latitude: value.latitude,
    longitude: value.longitude,
    coordinateSystem: value.coordinateSystem as "gcj02" | "wgs84",
  };
}

function normalizePassengerCount(value: unknown): PassengerCount | undefined {
  return value === 1 || value === 2 || value === 3 ? value : undefined;
}

function normalizeScene(value: unknown): SyntheticTripScene | undefined {
  return value === "commute" ||
    value === "airport" ||
    value === "medical" ||
    value === "other"
    ? value
    : undefined;
}

function normalizeTiming(value: unknown): TripTiming | undefined {
  if (!isRecord(value) || !isNonEmptyString(value.timezone)) return undefined;

  if (value.mode === "immediate") {
    return {
      mode: "immediate",
      timezone: value.timezone.trim(),
      selectionSource: "immediate",
    };
  }

  if (
    value.mode !== "scheduled" ||
    (value.selectionSource !== "quick_slot" &&
      value.selectionSource !== "calendar_slot") ||
    !isIsoDate(value.requestedPickupStartsAt) ||
    !isIsoDate(value.requestedPickupEndsAt) ||
    Date.parse(value.requestedPickupStartsAt) >= Date.parse(value.requestedPickupEndsAt)
  ) {
    return undefined;
  }

  return {
    mode: "scheduled",
    timezone: value.timezone.trim(),
    selectionSource: value.selectionSource,
    requestedPickupStartsAt: value.requestedPickupStartsAt,
    requestedPickupEndsAt: value.requestedPickupEndsAt,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isIsoDate(value: unknown): value is string {
  return isNonEmptyString(value) && !Number.isNaN(Date.parse(value));
}
