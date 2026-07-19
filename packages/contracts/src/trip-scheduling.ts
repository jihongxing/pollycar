export type TripTimingMode = "immediate" | "scheduled";

export type TripTimingSelectionSource =
  | "immediate"
  | "quick_slot"
  | "calendar_slot";

export type TripTiming = Readonly<{
  mode: TripTimingMode;
  timezone: string;
  selectionSource: TripTimingSelectionSource;
  requestedPickupStartsAt?: string;
  requestedPickupEndsAt?: string;
}>;

export type PickupTimeSlot = Readonly<{
  startsAt: string;
  endsAt: string;
  available: boolean;
}>;

export type TripServiceWindow = Readonly<{
  weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  startsAtMinute: number;
  endsAtMinute: number;
}>;

export type TripBookingAvailability = Readonly<{
  serverNow: string;
  timezone: string;
  immediateAvailable: boolean;
  minimumLeadMinutes: 30;
  slotDurationMinutes: 10;
  latestScheduledAt: string;
  quickSlots: readonly PickupTimeSlot[];
  availableSlots: readonly PickupTimeSlot[];
  serviceWindows: readonly TripServiceWindow[];
}>;

export type TripScheduleNoticeKind =
  | "created"
  | "accepted"
  | "day_before"
  | "two_hours"
  | "thirty_minutes"
  | "unmatched";

export type TripScheduleNotice = Readonly<{
  kind: TripScheduleNoticeKind;
  dueAt: string;
  delivered: boolean;
}>;
