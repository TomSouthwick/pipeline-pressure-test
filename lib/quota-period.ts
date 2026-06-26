export type QuotaPeriod = "quarter" | "year";

export interface PeriodBounds {
  start: Date;
  end: Date;
  label: string;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Calendar quarter/year bounds for `now`. */
export function getPeriodBounds(period: QuotaPeriod, now: Date): PeriodBounds {
  const year = now.getFullYear();

  if (period === "year") {
    return {
      start: new Date(year, 0, 1),
      end: new Date(year, 11, 31),
      label: String(year),
    };
  }

  const quarterIndex = Math.floor(now.getMonth() / 3);
  const startMonth = quarterIndex * 3;
  const endMonth = startMonth + 2;

  return {
    start: new Date(year, startMonth, 1),
    end: new Date(year, endMonth + 1, 0),
    label: `Q${quarterIndex + 1} ${year}`,
  };
}

export function isCloseDateInPeriod(
  closeDate: Date,
  period: QuotaPeriod,
  now: Date
): boolean {
  const { start, end } = getPeriodBounds(period, now);
  const d = startOfDay(closeDate);
  return d >= startOfDay(start) && d <= startOfDay(end);
}
