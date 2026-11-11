import { formatCareerLength, formatDate, monthsBetween, parseIsoDate, todayIsoDate } from './dates';

// No @types/node in the app: reach the runner's environment without it.
const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } })
  .process.env;

describe('parseIsoDate', () => {
  it('splits a yyyy-MM-dd date into calendar parts', () => {
    expect(parseIsoDate('2020-01-15')).toEqual({ year: 2020, month: 1, day: 15 });
  });

  it.each(['', '2020-1-5', '2020-02-30', '2020-13-01', 'not a date', '2020-01-15T00:00:00Z'])(
    'rejects %j',
    (value) => {
      expect(parseIsoDate(value)).toBeNull();
    },
  );

  it('accepts a leap day only in a leap year', () => {
    expect(parseIsoDate('2024-02-29')).not.toBeNull();
    expect(parseIsoDate('2023-02-29')).toBeNull();
  });
});

describe('formatDate', () => {
  it('formats with the given locale', () => {
    expect(formatDate('2020-01-15', 'en-US')).toBe('Jan 15, 2020');
    expect(formatDate('2020-01-15', 'de-DE')).toBe('15.01.2020');
  });

  it('returns unparsable input unchanged and empty text for null', () => {
    expect(formatDate('soon', 'en-US')).toBe('soon');
    expect(formatDate(null, 'en-US')).toBe('');
  });

  // process.env.TZ takes effect on the next Date call in Node, so the same helper runs in a west (negative UTC offset)
  // and an east zone; the day must never move.
  describe.each([
    ['America/Los_Angeles', 'a negative offset'],
    ['Pacific/Honolulu', 'a negative offset'],
    ['Pacific/Kiritimati', 'a positive offset'],
  ])('in %s (%s)', (zone) => {
    let original: string | undefined;

    beforeAll(() => {
      original = env['TZ'];
      env['TZ'] = zone;
    });

    afterAll(() => {
      if (original === undefined) {
        delete env['TZ'];
      } else {
        env['TZ'] = original;
      }
    });

    it('really runs in that zone (otherwise this test proves nothing)', () => {
      const offset = new Date(2020, 0, 15, 12).getTimezoneOffset();
      expect(zone === 'Pacific/Kiritimati' ? offset < 0 : offset > 0).toBe(true);
    });

    it('does not shift the day', () => {
      expect(formatDate('2020-01-15', 'en-US')).toBe('Jan 15, 2020');
      expect(formatDate('2020-03-01', 'en-US')).toBe('Mar 1, 2020');
      expect(formatDate('2021-01-01', 'en-US')).toBe('Jan 1, 2021');
      expect(formatDate('2020-12-31', 'en-US')).toBe('Dec 31, 2020');
    });

    it('is what naive parsing gets wrong in a zone west of UTC', () => {
      if (zone === 'Pacific/Kiritimati') {
        return;
      }
      const naive = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(
        new Date('2020-01-15'),
      );
      expect(naive).toBe('Jan 14, 2020');
    });

    it('measures career length by calendar days', () => {
      expect(formatCareerLength('2020-01-15', '2025-04-15', '2030-01-01')).toBe(
        '5 years, 3 months',
      );
    });

    it('reads today as the local calendar date', () => {
      const lateEvening = new Date(2020, 0, 15, 23, 30);
      expect(todayIsoDate(lateEvening)).toBe('2020-01-15');
    });
  });
});

describe('monthsBetween', () => {
  it('counts a month only once its day of month is reached', () => {
    expect(monthsBetween('2020-01-15', '2020-02-14')).toEqual({ years: 0, months: 0 });
    expect(monthsBetween('2020-01-15', '2020-02-15')).toEqual({ years: 0, months: 1 });
    expect(monthsBetween('2020-01-31', '2020-03-30')).toEqual({ years: 0, months: 1 });
  });

  it('is zero when the end is before the start', () => {
    expect(monthsBetween('2020-05-01', '2020-01-01')).toEqual({ years: 0, months: 0 });
  });
});

describe('formatCareerLength', () => {
  it('formats years and months', () => {
    expect(formatCareerLength('2020-01-15', '2025-04-20')).toBe('5 years, 3 months');
    expect(formatCareerLength('2020-01-15', '2021-02-15')).toBe('1 year, 1 month');
  });

  it('leaves out zero parts', () => {
    expect(formatCareerLength('2020-01-15', '2023-01-15')).toBe('3 years');
    expect(formatCareerLength('2020-01-15', '2020-04-16')).toBe('3 months');
    expect(formatCareerLength('2020-01-15', '2020-01-20')).toBe('Less than a month');
  });

  it('runs to today when there is no career end', () => {
    expect(formatCareerLength('2020-01-15', null, '2023-05-01')).toBe('3 years, 3 months');
  });

  it('is null without a start date', () => {
    expect(formatCareerLength(null, null)).toBeNull();
  });
});
