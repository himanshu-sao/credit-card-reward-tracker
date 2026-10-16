// Internal ISO date (`YYYY-MM-DD`) math. No date libraries: card periods are
// calendar-day based, so UTC-noon-free pure string math avoids timezone drift.
// Conventions (doc §7 / spec edge case 10): period ends are inclusive with a
// one-day safety margin — `as_of == period_start` means the new period is
// current, `as_of == period_end` means the period stays current.

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2 && isLeapYear(year)) return 29;
  return DAYS_IN_MONTH[month - 1];
}

/** Parse `YYYY-MM-DD` into a `[year, month(1-12), day]` triple. */
export function parseISO(date: string): [number, number, number] {
  const m = ISO_DATE.exec(date);
  if (!m) throw new TypeError(`invalid ISO date: ${date}`);
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12) throw new TypeError(`invalid month in date: ${date}`);
  if (day < 1 || day > daysInMonth(year, month))
    throw new TypeError(`invalid day in date: ${date}`);
  return [year, month, day];
}

/** Format a `[year, month, day]` triple back to `YYYY-MM-DD`. */
export function formatISO([year, month, day]: [number, number, number]): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** True when `date` is a valid `YYYY-MM-DD` calendar date. */
export function isValidISO(date: string): boolean {
  try {
    parseISO(date);
    return true;
  } catch {
    return false;
  }
}

export function compareISO(a: string, b: string): number {
  return a === b ? 0 : a < b ? -1 : 1;
}

/**
 * Add `n` months, clamping to the last day of the target month
 * (2024-01-31 + 1 month → 2024-02-29; 2024-02-29 + 12 months → 2025-02-28).
 */
export function addMonths(date: string, n: number): string {
  const [year, month, day] = parseISO(date);
  const total = year * 12 + (month - 1) + n;
  const targetYear = Math.floor(total / 12);
  const targetMonth = (total % 12) + 1;
  const targetDay = Math.min(day, daysInMonth(targetYear, targetMonth));
  return formatISO([targetYear, targetMonth, targetDay]);
}

export function addYears(date: string, n: number): string {
  const [year, month, day] = parseISO(date);
  const targetDay = month === 2 && day === 29 && !isLeapYear(year + n) ? 28 : day;
  return formatISO([year + n, month, targetDay]);
}

/** Day of year, 1-based (Jan 1 → 1, Dec 31 → 365 or 366 in leap years). */
export function dayOfYear(date: string): number {
  const [year, month, day] = parseISO(date);
  let n = day;
  for (let m = 1; m < month; m++) n += daysInMonth(year, m);
  return n;
}

/** Calendar quarter, 1–4. */
export function quarterOf(date: string): number {
  return Math.ceil(parseISO(date)[1] / 3);
}

/** Calendar half-year, 1 (Jan–Jun) or 2 (Jul–Dec). */
export function halfYearOf(date: string): number {
  return parseISO(date)[1] <= 6 ? 1 : 2;
}

/** First day of the calendar year containing `date`. */
export function startOfYear(date: string): string {
  return `${parseISO(date)[0]}-01-01`;
}

/** First day of the calendar quarter containing `date`. */
export function startOfQuarter(date: string): string {
  const [year] = parseISO(date);
  return formatISO([year, (quarterOf(date) - 1) * 3 + 1, 1]);
}

/** First day of the calendar half-year (Jan 1 or Jul 1) containing `date`. */
export function startOfHalfYear(date: string): string {
  const [year] = parseISO(date);
  return formatISO([year, halfYearOf(date) === 1 ? 1 : 7, 1]);
}

/** First day of the calendar month containing `date`. */
export function startOfMonth(date: string): string {
  const [year, month] = parseISO(date);
  return formatISO([year, month, 1]);
}

/** Last day of the calendar month containing `date`. */
export function endOfMonth(date: string): string {
  const [year, month] = parseISO(date);
  return formatISO([year, month, daysInMonth(year, month)]);
}

/** Day before `date` (one-day safety margin: period_end is inclusive). */
export function dayBefore(date: string): string {
  const [year, month, day] = parseISO(date);
  if (day > 1) return formatISO([year, month, day - 1]);
  if (month > 1) return formatISO([year, month - 1, daysInMonth(year, month - 1)]);
  return formatISO([year - 1, 12, 31]);
}
