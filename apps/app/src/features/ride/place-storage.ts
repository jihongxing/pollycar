import type { RidePlace } from "./ride-model";

const savedPlacesKey = "pollycar.ride.saved-places";
const recentPlacesKey = "pollycar.ride.recent-places";
const maximumRecentPlaces = 8;

export type SavedPlaceKind = "home" | "work";

export type PlacePreferences = Readonly<{
  saved: Readonly<Partial<Record<SavedPlaceKind, RidePlace>>>;
  recent: readonly RidePlace[];
}>;

export function loadPlacePreferences(): PlacePreferences {
  return {
    saved: readObject(savedPlacesKey),
    recent: readArray(recentPlacesKey),
  };
}

export function saveNamedPlace(kind: SavedPlaceKind, place: RidePlace): PlacePreferences {
  const current = loadPlacePreferences();
  const saved = { ...current.saved, [kind]: { ...place, kind } };
  write(savedPlacesKey, saved);
  return { ...current, saved };
}

export function rememberRecentPlace(place: RidePlace): PlacePreferences {
  const current = loadPlacePreferences();
  const recent = [
    { ...place, kind: "recent" as const },
    ...current.recent.filter((candidate) => candidate.id !== place.id),
  ].slice(0, maximumRecentPlaces);
  write(recentPlacesKey, recent);
  return { ...current, recent };
}

function readObject(key: string): PlacePreferences["saved"] {
  const value = read(key);
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as PlacePreferences["saved"])
    : {};
}

function readArray(key: string): readonly RidePlace[] {
  const value = read(key);
  return Array.isArray(value) ? (value as RidePlace[]) : [];
}

function read(key: string): unknown {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}
