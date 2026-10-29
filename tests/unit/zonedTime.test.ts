import { describe, expect, it } from 'vitest';
import {
	correctExifDateForTimeZone,
	gpsTimestampToUtc,
	naiveComponentsFromLocalDate,
	zonedWallClockToUtc
} from '../../src/lib/zonedTime';

const wallClock = (year: number, month: number, day: number, hour: number, minute: number, second = 0) => ({
	year,
	month,
	day,
	hour,
	minute,
	second
});

describe('zonedWallClockToUtc', () => {
	it('Copenhagen in summer (CEST, UTC+2)', () => {
		expect(zonedWallClockToUtc(wallClock(2026, 8, 27, 15, 11), 'Europe/Copenhagen').toISOString()).toBe(
			'2026-08-27T13:11:00.000Z'
		);
	});

	it('Copenhagen in winter (CET, UTC+1) - a different offset than summer for the same timezone', () => {
		expect(zonedWallClockToUtc(wallClock(2026, 1, 15, 15, 11), 'Europe/Copenhagen').toISOString()).toBe(
			'2026-01-15T14:11:00.000Z'
		);
	});

	it('Singapore - no DST, always UTC+8', () => {
		expect(zonedWallClockToUtc(wallClock(2026, 8, 27, 15, 11), 'Asia/Singapore').toISOString()).toBe(
			'2026-08-27T07:11:00.000Z'
		);
	});

	it('New York in summer (EDT, UTC-4)', () => {
		expect(zonedWallClockToUtc(wallClock(2026, 8, 27, 15, 11), 'America/New_York').toISOString()).toBe(
			'2026-08-27T19:11:00.000Z'
		);
	});

	it('New York in winter (EST, UTC-5)', () => {
		expect(zonedWallClockToUtc(wallClock(2026, 1, 15, 15, 11), 'America/New_York').toISOString()).toBe(
			'2026-01-15T20:11:00.000Z'
		);
	});

	it('UTC itself is a no-op', () => {
		expect(zonedWallClockToUtc(wallClock(2026, 8, 27, 15, 11, 30), 'UTC').toISOString()).toBe('2026-08-27T15:11:30.000Z');
	});
});

describe('naiveComponentsFromLocalDate', () => {
	it('round-trips exactly what a local Date constructor was given, regardless of this runtime\'s own timezone - it undoes the same local round-trip exifr\'s date parser did', () => {
		const date = new Date(2026, 7, 27, 15, 11, 0);
		expect(naiveComponentsFromLocalDate(date)).toEqual(wallClock(2026, 8, 27, 15, 11));
	});
});

describe('correctExifDateForTimeZone', () => {
	it('corrects an exifr-shaped local Date into the right UTC instant for the photo\'s own timezone', () => {
		// Exactly how exifr builds its Date: local year/month/day plus local
		// setHours/setMinutes/setSeconds (src/lib/zonedTime.ts's header comment).
		const exifrDate = new Date(2026, 7, 27, 15, 11, 0);
		expect(correctExifDateForTimeZone(exifrDate, 'Asia/Singapore').toISOString()).toBe('2026-08-27T07:11:00.000Z');
	});
});

describe('gpsTimestampToUtc', () => {
	it('combines GPSDateStamp and a raw [h,m,s] GPSTimeStamp array directly as UTC - no timezone involved at all', () => {
		expect(gpsTimestampToUtc('2026:08:27', [15, 11, 30])?.toISOString()).toBe('2026-08-27T15:11:30.000Z');
	});

	it('also accepts the "H:MM:SS.ss" string exifr actually hands back (its default GPSTimeStamp reviver joins the raw array with colons) - the real shape in production, not the array', () => {
		expect(gpsTimestampToUtc('2026:08:27', '15:11:30.46')?.toISOString()).toBe('2026-08-27T15:11:30.460Z');
	});

	it('handles the string form\'s un-padded hour (e.g. "2:33:44.54" for 2am), the exact shape exifr produced for a real photo', () => {
		expect(gpsTimestampToUtc('2026:10:05', '2:33:44.54')?.toISOString()).toBe('2026-10-05T02:33:44.540Z');
	});

	it('returns null when GPSDateStamp is missing', () => {
		expect(gpsTimestampToUtc(undefined, [15, 11, 30])).toBeNull();
	});

	it('returns null when GPSTimeStamp is missing or not an array', () => {
		expect(gpsTimestampToUtc('2026:08:27', undefined)).toBeNull();
		expect(gpsTimestampToUtc('2026:08:27', 'not-an-array')).toBeNull();
	});

	it('returns null for a malformed date stamp', () => {
		expect(gpsTimestampToUtc('not-a-date', [15, 11, 30])).toBeNull();
	});

	it('returns null for a short time stamp array', () => {
		expect(gpsTimestampToUtc('2026:08:27', [15, 11])).toBeNull();
	});
});
