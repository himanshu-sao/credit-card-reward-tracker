import { describe, expect, it } from 'vitest';
import {
  addMonths,
  addYears,
  compareISO,
  dayBefore,
  halfYearOf,
  isValidISO,
  parseISO,
  quarterOf,
  startOfHalfYear,
  startOfMonth,
  startOfQuarter,
  startOfYear,
} from './dates.js';

describe('parseISO / isValidISO', () => {
  it('parses valid dates and rejects malformed ones', () => {
    expect(parseISO('2026-03-10')).toEqual([2026, 3, 10]);
    expect(isValidISO('2026-03-10')).toBe(true);
    // Refined-prompt goal 9: malformed date strings fail loudly.
    expect(isValidISO('2026-3-10')).toBe(false);
    expect(isValidISO('2026-13-01')).toBe(false);
    expect(isValidISO('2026-02-30')).toBe(false);
    expect(isValidISO('2026-02-29')).toBe(false); // not a leap year
    expect(isValidISO('2024-02-29')).toBe(true);
    expect(isValidISO('')).toBe(false);
    expect(() => parseISO('nonsense')).toThrow(TypeError);
  });
});

describe('compareISO', () => {
  it('lexicographic order equals calendar order for ISO dates', () => {
    expect(compareISO('2026-01-01', '2026-01-02')).toBe(-1);
    expect(compareISO('2026-12-31', '2027-01-01')).toBe(-1);
    expect(compareISO('2026-03-10', '2026-03-10')).toBe(0);
    expect(compareISO('2027-01-01', '2026-12-31')).toBe(1);
  });
});

describe('addMonths', () => {
  it('clamps to end of month (doc §7 leap-day handling)', () => {
    // Edge case 8: Feb 29 anchor in a non-leap target year.
    expect(addMonths('2024-02-29', 12)).toBe('2025-02-28');
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonths('2023-01-31', 1)).toBe('2023-02-28');
    expect(addMonths('2026-03-31', 1)).toBe('2026-04-30');
  });

  it('rolls across year boundaries and supports zero/negative deltas', () => {
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15');
    expect(addMonths('2026-03-10', 0)).toBe('2026-03-10');
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28');
  });
});

describe('addYears', () => {
  it('keeps month/day except Feb 29 clamps to Feb 28 (doc §7)', () => {
    expect(addYears('2026-03-10', 1)).toBe('2027-03-10');
    expect(addYears('2024-02-29', 1)).toBe('2025-02-28');
    expect(addYears('2024-02-29', 4)).toBe('2028-02-29');
    expect(addYears('2026-10-01', 4)).toBe('2030-10-01');
  });
});

describe('calendar helpers', () => {
  it('quarter / half-year boundaries', () => {
    expect(quarterOf('2026-01-01')).toBe(1);
    expect(quarterOf('2026-03-31')).toBe(1);
    expect(quarterOf('2026-04-01')).toBe(2);
    expect(quarterOf('2026-12-15')).toBe(4);
    expect(halfYearOf('2026-06-30')).toBe(1);
    expect(halfYearOf('2026-07-01')).toBe(2); // Edge case 3: Jul 1 opens H2
  });

  it('startOf* and dayBefore anchors', () => {
    expect(startOfYear('2026-10-16')).toBe('2026-01-01');
    expect(startOfQuarter('2026-07-01')).toBe('2026-07-01');
    expect(startOfHalfYear('2026-12-31')).toBe('2026-07-01');
    expect(startOfMonth('2026-03-31')).toBe('2026-03-01');
    expect(dayBefore('2026-03-01')).toBe('2026-02-28');
    expect(dayBefore('2026-01-01')).toBe('2025-12-31');
  });
});
