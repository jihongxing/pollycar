import type {
  PickupTimeSlot,
  TripBookingAvailability,
  TripServiceWindow,
  TripTiming,
} from "@pollycar/contracts";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export class TripBookingAvailabilityService {
  public constructor(
    private readonly now: () => Date,
    private readonly timezone = "Asia/Shanghai",
    private readonly serviceWindows: readonly TripServiceWindow[] = allDayWindows(),
  ) {}

  public getAvailability(): TripBookingAvailability {
    const serverNow = this.now();
    const earliest = ceilToSlot(new Date(serverNow.getTime() + 30 * MINUTE), 10);
    const latest = new Date(serverNow.getTime() + 72 * HOUR);
    const availableSlots = this.generateSlots(earliest, latest);
    return {
      serverNow: serverNow.toISOString(),
      timezone: this.timezone,
      immediateAvailable: true,
      minimumLeadMinutes: 30,
      slotDurationMinutes: 10,
      latestScheduledAt: latest.toISOString(),
      quickSlots: availableSlots.slice(0, 4),
      availableSlots,
      serviceWindows: this.serviceWindows,
    };
  }

  public validate(timing: TripTiming): TripTiming {
    if (timing.mode === "immediate") {
      if (timing.selectionSource !== "immediate") throw new Error("TRIP_PICKUP_TIME_INVALID");
      return {
        mode: "immediate",
        timezone: this.timezone,
        selectionSource: "immediate",
      };
    }
    if (!["quick_slot", "calendar_slot"].includes(timing.selectionSource)) {
      throw new Error("TRIP_PICKUP_TIME_INVALID");
    }
    if (!timing.requestedPickupStartsAt || !timing.requestedPickupEndsAt) {
      throw new Error("TRIP_PICKUP_TIME_INVALID");
    }
    const startsAt = new Date(timing.requestedPickupStartsAt);
    const endsAt = new Date(timing.requestedPickupEndsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      throw new Error("TRIP_PICKUP_TIME_INVALID");
    }
    const now = this.now();
    if (startsAt.getTime() <= now.getTime()) throw new Error("TRIP_PICKUP_TIME_IN_PAST");
    const earliest = ceilToSlot(new Date(now.getTime() + 30 * MINUTE), 10);
    if (startsAt.getTime() < earliest.getTime()) throw new Error("TRIP_PICKUP_TIME_TOO_SOON");
    if (startsAt.getTime() > now.getTime() + 72 * HOUR) {
      throw new Error("TRIP_PICKUP_TIME_TOO_FAR");
    }
    if (endsAt.getTime() - startsAt.getTime() !== 10 * MINUTE) {
      throw new Error("TRIP_PICKUP_TIME_INVALID");
    }
    if (startsAt.getUTCMinutes() % 10 !== 0 || startsAt.getUTCSeconds() !== 0) {
      throw new Error("TRIP_PICKUP_TIME_INVALID");
    }
    if (!this.isWithinServiceWindow(startsAt, endsAt)) {
      throw new Error("TRIP_PICKUP_TIME_UNAVAILABLE");
    }
    return {
      mode: "scheduled",
      timezone: this.timezone,
      selectionSource: timing.selectionSource,
      requestedPickupStartsAt: startsAt.toISOString(),
      requestedPickupEndsAt: endsAt.toISOString(),
    };
  }

  private generateSlots(earliest: Date, latest: Date): readonly PickupTimeSlot[] {
    const slots: PickupTimeSlot[] = [];
    for (
      let cursor = earliest.getTime();
      cursor + 10 * MINUTE <= latest.getTime();
      cursor += 10 * MINUTE
    ) {
      const startsAt = new Date(cursor);
      const endsAt = new Date(cursor + 10 * MINUTE);
      if (!this.isWithinServiceWindow(startsAt, endsAt)) continue;
      slots.push({
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        available: true,
      });
    }
    return slots;
  }

  private isWithinServiceWindow(startsAt: Date, endsAt: Date): boolean {
    const parts = shanghaiParts(startsAt);
    const endParts = shanghaiParts(endsAt);
    if (parts.date !== endParts.date && endParts.minuteOfDay !== 0) return false;
    return this.serviceWindows.some(
      (window) =>
        window.weekday === parts.weekday &&
        parts.minuteOfDay >= window.startsAtMinute &&
        (endParts.date === parts.date ? endParts.minuteOfDay : 1440) <= window.endsAtMinute,
    );
  }
}

export function ceilToSlot(date: Date, slotMinutes: number): Date {
  const slotMs = slotMinutes * MINUTE;
  return new Date(Math.ceil(date.getTime() / slotMs) * slotMs);
}

function shanghaiParts(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    parts.weekday ?? "",
  ) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
  return {
    weekday,
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minuteOfDay: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

function allDayWindows(): readonly TripServiceWindow[] {
  return [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
    weekday: weekday as 0 | 1 | 2 | 3 | 4 | 5 | 6,
    startsAtMinute: 0,
    endsAtMinute: 1440,
  }));
}
