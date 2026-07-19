export interface ActivePeriod {
  readonly startsAt: Date;
  readonly endsAt: Date;
}

function formatCalendarDay(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function countActiveCalendarDays(
  periods: readonly ActivePeriod[],
  now: Date,
  timezone: string,
): number {
  const lookbackStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const days = new Set<string>();

  for (const period of periods) {
    const startsAt = period.startsAt < lookbackStart ? lookbackStart : period.startsAt;
    const endsAt = period.endsAt > now ? now : period.endsAt;
    if (endsAt < startsAt) {
      continue;
    }

    for (
      let cursor = new Date(startsAt.getTime());
      cursor <= endsAt;
      cursor = new Date(cursor.getTime() + 12 * 60 * 60 * 1000)
    ) {
      days.add(formatCalendarDay(cursor, timezone));
    }
    days.add(formatCalendarDay(endsAt, timezone));
  }

  return days.size;
}
