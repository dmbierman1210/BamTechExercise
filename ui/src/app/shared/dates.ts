/**
 * Calendar-date helpers for the API's `yyyy-MM-dd` dates. A date-only value has no time zone, so it is never run
 * through `new Date('yyyy-MM-dd')` (parsed as UTC midnight, which shows the previous day west of Greenwich).
 * Dates are split into parts, formatted from a UTC instant with `timeZone: 'UTC'`, and compared with plain integers.
 */
export interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseIsoDate(value: string | null | undefined): CalendarDate | null {
  const match = ISO_DATE.exec(value ?? '');
  if (!match) {
    return null;
  }
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(year, month - 1, day));
  const real =
    check.getUTCFullYear() === year &&
    check.getUTCMonth() === month - 1 &&
    check.getUTCDate() === day;
  return real ? { year, month, day } : null;
}

/** Formats a `yyyy-MM-dd` date with the browser locale (or `locale`), e.g. "Jan 15, 2020"; unparsable input is returned as is. */
export function formatDate(value: string | null | undefined, locale?: string | string[]): string {
  const date = parseIsoDate(value);
  if (!date) {
    return value ?? '';
  }
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(Date.UTC(date.year, date.month - 1, date.day)),
  );
}

/** Today's calendar date in the user's time zone as `yyyy-MM-dd`. */
export function todayIsoDate(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${String(now.getFullYear()).padStart(4, '0')}-${month}-${day}`;
}

/** Today's calendar date in UTC as `yyyy-MM-dd`: the day the contract's "in the future" rule uses. */
export function todayUtcIsoDate(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Whole years and months from `start` to `end` (a month is complete once the day of month is reached). */
export function monthsBetween(
  start: string,
  end: string,
): { years: number; months: number } | null {
  const from = parseIsoDate(start);
  const to = parseIsoDate(end);
  if (!from || !to) {
    return null;
  }
  const total = (to.year - from.year) * 12 + (to.month - from.month) - (to.day < from.day ? 1 : 0);
  if (total < 0) {
    return null;
  }
  return { years: Math.floor(total / 12), months: total % 12 };
}

/** The day after an ISO date, using calendar arithmetic that no time zone can shift. */
function nextDay(iso: string): string {
  const parts = parseIsoDate(iso);
  if (!parts) {
    return iso;
  }
  const next = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1));
  const pad = (value: number, size = 2) => String(value).padStart(size, '0');
  return `${pad(next.getUTCFullYear(), 4)}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

const plural = (count: number, unit: string) => `${count} ${unit}${count === 1 ? '' : 's'}`;

/**
 * "5 years, 3 months"; zero parts are left out and less than a month reads "Less than a month".
 * `end` is the last day of service (inclusive), so the span runs to the day after it.
 */
export function formatCareerLength(
  start: string | null | undefined,
  end: string | null | undefined,
  today: string = todayIsoDate(),
): string | null {
  if (!start) {
    return null;
  }
  const length = monthsBetween(start, end ? nextDay(end) : today);
  if (!length) {
    return null;
  }
  const parts: string[] = [];
  if (length.years > 0) {
    parts.push(plural(length.years, 'year'));
  }
  if (length.months > 0) {
    parts.push(plural(length.months, 'month'));
  }
  return parts.length > 0 ? parts.join(', ') : 'Less than a month';
}
