// Pure date math, fully testable - no I/O, no browser-only APIs (Intl and
// Date are available in vitest's Node runtime too).

export interface WallClockComponents {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
	second: number;
}

/**
 * Recovers the naive wall-clock numbers exifr actually read from a photo's
 * EXIF DateTimeOriginal tag. exifr's own date parser (dist/full.esm.mjs's
 * `ze`) builds its Date via `new Date(y, m-1, d)` plus local setHours/
 * setMinutes/setSeconds - the runtime's *local* timezone, with no regard
 * for where the photo was actually taken. Reading those components back
 * the same way (local getters, never getUTC*) returns the original EXIF
 * numbers exactly, regardless of what timezone this runtime happens to be
 * in - it's just undoing the same local round-trip exifr did.
 */
export function naiveComponentsFromLocalDate(date: Date): WallClockComponents {
	return {
		year: date.getFullYear(),
		month: date.getMonth() + 1,
		day: date.getDate(),
		hour: date.getHours(),
		minute: date.getMinutes(),
		second: date.getSeconds()
	};
}

function wallClockShownInZone(instant: Date, timeZone: string): WallClockComponents {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hourCycle: 'h23'
	}).formatToParts(instant);
	const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
	return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute'), second: get('second') };
}

/**
 * Converts naive wall-clock components - a reading with no timezone of its
 * own, exactly what EXIF's DateTimeOriginal carries - into the correct UTC
 * instant for a given IANA timezone. Works by guessing the components are
 * UTC, asking Intl what that instant actually looks like in the target
 * zone, and correcting by the difference - the standard way to do
 * zone-aware date math with only the built-in Intl/Date APIs (no extra
 * dependency), correct across DST transitions because Intl resolves the
 * zone's offset for that specific date, not a fixed offset.
 */
export function zonedWallClockToUtc(components: WallClockComponents, timeZone: string): Date {
	const { year, month, day, hour, minute, second } = components;
	const guess = Date.UTC(year, month - 1, day, hour, minute, second);
	const shown = wallClockShownInZone(new Date(guess), timeZone);
	const shownAsUtc = Date.UTC(shown.year, shown.month - 1, shown.day, shown.hour, shown.minute, shown.second);
	return new Date(guess + (guess - shownAsUtc));
}

/**
 * The two steps above combined for the common case: a Date exifr produced
 * from EXIF DateTimeOriginal, corrected into the right UTC instant for the
 * photo's own (GPS-derived) timezone.
 */
export function correctExifDateForTimeZone(exifrDate: Date, timeZone: string): Date {
	return zonedWallClockToUtc(naiveComponentsFromLocalDate(exifrDate), timeZone);
}
