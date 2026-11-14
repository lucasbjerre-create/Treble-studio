import { describe, expect, it } from 'vitest';
import {
	formatEntryDate,
	formatEntryDay,
	formatMonthHeading,
	localDateParts,
	localMonthKey
} from '../../src/lib/entryDate';

describe('localDateParts', () => {
	it('New York: half past midnight UTC is still the evening before (EDT, UTC-4)', () => {
		expect(localDateParts('2026-10-31T00:30:00.000Z', 'America/New_York')).toEqual({ year: 2026, month: 10, day: 30 });
	});

	it('Singapore: a UTC afternoon is already the next local day (UTC+8)', () => {
		expect(localDateParts('2027-02-14T17:00:00.000Z', 'Asia/Singapore')).toEqual({ year: 2027, month: 2, day: 15 });
	});

	it('Copenhagen in summer (CEST, UTC+2) crosses midnight two hours before UTC does', () => {
		expect(localDateParts('2026-08-14T22:30:00.000Z', 'Europe/Copenhagen')).toEqual({ year: 2026, month: 8, day: 15 });
	});

	// US clocks go back on 1 November 2026 at 06:00 UTC. The same UTC clock
	// time one day apart lands on the same local date, which only comes out
	// right if each instant gets the offset in force at that moment.
	it('the night before the US clocks go back uses EDT (UTC-4) - a fixed UTC-5 would say 31 October', () => {
		expect(localDateParts('2026-11-01T04:30:00.000Z', 'America/New_York')).toEqual({ year: 2026, month: 11, day: 1 });
	});

	it('the night after the US clocks go back uses EST (UTC-5) - a fixed UTC-4 would say 2 November', () => {
		expect(localDateParts('2026-11-02T04:30:00.000Z', 'America/New_York')).toEqual({ year: 2026, month: 11, day: 1 });
	});

	it('falls back to UTC for a timezone Intl does not know, without throwing', () => {
		expect(() => localDateParts('2026-10-31T00:30:00.000Z', 'Not/AZone')).not.toThrow();
		expect(localDateParts('2026-10-31T00:30:00.000Z', 'Not/AZone')).toEqual({ year: 2026, month: 10, day: 31 });
		expect(localDateParts('2026-10-31T00:30:00.000Z', '')).toEqual({ year: 2026, month: 10, day: 31 });
	});

	it('does not throw for an instant that is not a date', () => {
		expect(() => localDateParts('not a date', 'America/New_York')).not.toThrow();
	});
});

describe('localMonthKey', () => {
	it('uses the local month, not the UTC one - late on 31 October in New York is already November in UTC', () => {
		expect(localMonthKey('2026-11-01T02:00:00.000Z', 'America/New_York')).toBe('2026-10');
	});

	it('the same instant is November in Singapore', () => {
		expect(localMonthKey('2026-11-01T02:00:00.000Z', 'Asia/Singapore')).toBe('2026-11');
	});

	it('pads the month to two digits', () => {
		expect(localMonthKey('2027-01-31T16:30:00.000Z', 'Asia/Singapore')).toBe('2027-02');
	});
});

describe('formatEntryDate', () => {
	it('English: day, short month, year', () => {
		expect(formatEntryDate('2026-10-31T00:30:00.000Z', 'America/New_York', 'en')).toBe('30 Oct 2026');
	});

	it('Danish: full stop after the day and after the abbreviated month', () => {
		expect(formatEntryDate('2026-10-31T00:30:00.000Z', 'America/New_York', 'da')).toBe('30. okt. 2026');
	});

	it('Danish: "maj" is not an abbreviation, so it has no full stop', () => {
		expect(formatEntryDate('2027-05-05T04:00:00.000Z', 'Asia/Singapore', 'da')).toBe('5. maj 2027');
	});

	it('still formats, in UTC, when the timezone is not valid', () => {
		expect(formatEntryDate('2026-10-31T00:30:00.000Z', 'Not/AZone', 'en')).toBe('31 Oct 2026');
	});

	it('returns an empty string rather than "NaN" for an instant that is not a date', () => {
		expect(formatEntryDate('not a date', 'America/New_York', 'en')).toBe('');
	});
});

describe('formatEntryDay', () => {
	it('English: no year', () => {
		expect(formatEntryDay('2026-10-31T00:30:00.000Z', 'America/New_York', 'en')).toBe('30 Oct');
	});

	it('Danish: no year', () => {
		expect(formatEntryDay('2026-10-31T00:30:00.000Z', 'America/New_York', 'da')).toBe('30. okt.');
	});

	it('returns an empty string for an instant that is not a date', () => {
		expect(formatEntryDay('not a date', 'America/New_York', 'da')).toBe('');
	});
});

describe('formatMonthHeading', () => {
	it('English', () => {
		expect(formatMonthHeading(2026, 10, 'en')).toBe('October 2026');
	});

	it('Danish, capitalised because it is a heading', () => {
		expect(formatMonthHeading(2026, 10, 'da')).toBe('Oktober 2026');
		expect(formatMonthHeading(2027, 3, 'da')).toBe('Marts 2027');
	});

	it('returns an empty string for a month outside 1-12', () => {
		expect(formatMonthHeading(2026, 13, 'en')).toBe('');
		expect(formatMonthHeading(2026, 0, 'en')).toBe('');
	});
});
