import type {
  GeoPoint,
  MapPlace,
  PassengerCount,
  SyntheticTripScene,
  SyntheticTripView,
  PickupTimeSlot,
  TripTiming,
} from "@pollycar/contracts";

export type RidePlace = Readonly<{
  id: string;
  label: string;
  address: string;
  kind: "current" | "home" | "work" | "recent" | "search";
  synthetic: boolean;
  location?: GeoPoint;
}>;

export type RideDraft = Readonly<{
  origin: RidePlace;
  destination?: RidePlace;
  passengerCount: PassengerCount;
  scene?: SyntheticTripScene;
  timing: TripTiming;
}>;

export type DriverPresentation = Readonly<{
  displayName: string;
  avatarUri?: string;
  gender: "female" | "male" | "undisclosed";
  ratingLabel: string;
  vehicleColor: string;
  vehicleModel: string;
  plate: string;
  etaMinutes: number;
  pickupCode: string;
  synthetic: true;
}>;

export type RideCompletionDraft = Readonly<{
  rating: number;
  submitted: boolean;
}>;

export const defaultOrigin: RidePlace = {
  id: "synthetic-current",
  label: "当前位置",
  address: "人民广场 · 合成上车点",
  kind: "current",
  synthetic: true,
  location: { latitude: 31.2304, longitude: 121.4737, coordinateSystem: "gcj02" },
};

export const suggestedPlaces: readonly RidePlace[] = [
  { id: "home", label: "家", address: "静安寺 · 合成地址", kind: "home", synthetic: true, location: { latitude: 31.2235, longitude: 121.4455, coordinateSystem: "gcj02" } },
  { id: "work", label: "公司", address: "陆家嘴 · 合成地址", kind: "work", synthetic: true, location: { latitude: 31.2397, longitude: 121.4998, coordinateSystem: "gcj02" } },
  { id: "recent-1", label: "虹桥站", address: "虹桥 · 合成终点", kind: "recent", synthetic: true, location: { latitude: 31.1979, longitude: 121.327, coordinateSystem: "gcj02" } },
  { id: "recent-2", label: "徐家汇", address: "徐家汇 · 合成终点", kind: "recent", synthetic: true, location: { latitude: 31.1885, longitude: 121.4365, coordinateSystem: "gcj02" } },
];

export function toRidePlace(place: MapPlace): RidePlace {
  return {
    id: place.placeId,
    label: place.name,
    address: place.formattedAddress,
    kind: "search",
    synthetic: place.provider === "synthetic",
    location: place.entranceLocation ?? place.location,
  };
}

export function createRideDraft(): RideDraft {
  return {
    origin: defaultOrigin,
    passengerCount: 1,
    timing: {
      mode: "immediate",
      timezone: "Asia/Shanghai",
      selectionSource: "immediate",
    },
  };
}

export function createRideDraftFromTrip(trip: SyntheticTripView): RideDraft {
  return {
    origin: {
      id: `${trip.tripId}-origin`,
      label: "上车点",
      address: trip.originLabel,
      kind: "recent",
      synthetic: true,
    },
    destination: {
      id: `${trip.tripId}-destination`,
      label: "目的地",
      address: trip.destinationLabel,
      kind: "recent",
      synthetic: true,
    },
    passengerCount: trip.passengerCount,
    ...(trip.scene ? { scene: trip.scene } : {}),
    timing:
      trip.timing ?? {
        mode: "immediate",
        timezone: "Asia/Shanghai",
        selectionSource: "immediate",
      },
  };
}

export function searchPlaces(query: string, places = suggestedPlaces): readonly RidePlace[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return places;
  return places.filter((place) =>
    `${place.label} ${place.address}`.toLocaleLowerCase().includes(normalized),
  );
}

export function selectDestination(draft: RideDraft, destination: RidePlace): RideDraft {
  return { ...draft, destination };
}

export function updatePassengerCount(draft: RideDraft, passengerCount: PassengerCount): RideDraft {
  return { ...draft, passengerCount };
}

export function updateScene(draft: RideDraft, scene?: SyntheticTripScene): RideDraft {
  return { ...draft, ...(scene ? { scene } : { scene: undefined }) };
}

export function updateTripTiming(draft: RideDraft, timing: TripTiming): RideDraft {
  return { ...draft, timing };
}

export function timingFromSlot(
  slot: PickupTimeSlot,
  selectionSource: "quick_slot" | "calendar_slot",
  timezone = "Asia/Shanghai",
): TripTiming {
  return {
    mode: "scheduled",
    timezone,
    selectionSource,
    requestedPickupStartsAt: slot.startsAt,
    requestedPickupEndsAt: slot.endsAt,
  };
}

export function formatPickupSlot(
  timing: TripTiming,
  now = new Date(),
): Readonly<{ summary: string; action: string }> {
  if (timing.mode === "immediate") {
    return {
      summary: `尽快出发 · 当前 ${formatTime(now)}`,
      action: "确认呼叫",
    };
  }
  const startsAt = new Date(timing.requestedPickupStartsAt!);
  const endsAt = new Date(timing.requestedPickupEndsAt!);
  const dateLabel = relativeDateLabel(startsAt, now);
  return {
    summary: `${dateLabel} ${formatTime(startsAt)}–${formatTime(endsAt)}`,
    action:
      dateLabel === "今天" || dateLabel === "明天"
        ? `预约${dateLabel} ${formatTime(startsAt)}`
        : `预约 ${formatMonthDay(startsAt)} ${formatTime(startsAt)}`,
  };
}

export function pickupSlotDateKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export function pickupSlotDateLabel(iso: string, now = new Date()): string {
  return relativeDateLabel(new Date(iso), now);
}

export function pickupSlotTimeLabel(slot: PickupTimeSlot): string {
  return `${formatTime(new Date(slot.startsAt))}–${formatTime(new Date(slot.endsAt))}`;
}

export function canConfirmRide(draft: RideDraft): boolean {
  return Boolean(draft.origin && draft.destination);
}

function relativeDateLabel(date: Date, now: Date): string {
  const targetKey = pickupSlotDateKey(date.toISOString());
  const todayKey = pickupSlotDateKey(now.toISOString());
  const tomorrowKey = pickupSlotDateKey(
    new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
  );
  const afterTomorrowKey = pickupSlotDateKey(
    new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString(),
  );
  if (targetKey === todayKey) return "今天";
  if (targetKey === tomorrowKey) return "明天";
  if (targetKey === afterTomorrowKey) return "后天";
  return `${formatMonthDay(date)} ${new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    weekday: "short",
  }).format(date)}`;
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

function formatMonthDay(date: Date): string {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
  }).format(date);
}

export function deriveDriverPresentation(trip?: SyntheticTripView): DriverPresentation {
  const suffix = trip?.tripId.slice(-2).toUpperCase() ?? "01";
  return {
    displayName: trip?.driverProfile?.displayName ?? "林师傅",
    avatarUri: trip?.driverProfile?.avatarUrl,
    gender: trip?.driverProfile?.gender ?? "undisclosed",
    ratingLabel: trip?.driverProfile?.rating
      ? `${trip.driverProfile.rating.average.toFixed(1)} · ${trip.driverProfile.rating.ratingCount} 单`
      : "暂无评分",
    vehicleColor: trip?.vehicle?.color ?? "深灰色",
    vehicleModel: trip?.vehicle
      ? `${trip.vehicle.make} ${trip.vehicle.model}`
      : "大众 帕萨特",
    plate: trip?.vehicle?.licensePlate ?? `沪A·P${suffix}7`,
    etaMinutes: trip?.state === "accepted" ? 4 : 0,
    pickupCode: `${trip?.tripId.length ?? 4}8${trip?.version ?? 1}2`,
    synthetic: true,
  };
}

export function cancellationRemainingSeconds(
  acceptedAt: string | undefined,
  nowMs: number,
  windowSeconds = 180,
): number {
  if (!acceptedAt) return 0;
  const elapsedSeconds = Math.max(0, Math.floor((nowMs - Date.parse(acceptedAt)) / 1000));
  return Math.max(0, windowSeconds - elapsedSeconds);
}

export function canPassengerCancelAfterAcceptance(
  trip: SyntheticTripView | undefined,
  nowMs: number,
): boolean {
  return trip?.state === "accepted"
    && cancellationRemainingSeconds(trip.acceptedAt, nowMs) > 0;
}

export function formatTripDuration(trip: SyntheticTripView): string {
  const start = Date.parse(trip.startedAt ?? trip.createdAt);
  const end = Date.parse(trip.completedAt ?? new Date(start + 22 * 60_000).toISOString());
  return `${Math.max(1, Math.round((end - start) / 60_000))} 分钟`;
}

export function vehicleLocationFreshnessLabel(
  capturedAt: string,
  nowMs: number,
): Readonly<{ state: "fresh" | "aging" | "stale" | "unavailable"; label: string }> {
  const ageSeconds = Math.max(0, Math.floor((nowMs - Date.parse(capturedAt)) / 1000));
  if (ageSeconds >= 60) return { state: "unavailable", label: "车辆位置暂不可用" };
  if (ageSeconds >= 30) return { state: "stale", label: `车辆位置已过期 · ${ageSeconds} 秒前` };
  if (ageSeconds >= 15) return { state: "aging", label: `车辆位置更新于 ${ageSeconds} 秒前` };
  return { state: "fresh", label: "车辆位置刚刚更新" };
}
