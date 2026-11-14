import type { Locale } from '../i18n/t';

// Entry dates for the reading pages. Times are stored as a UTC instant plus
// the entry's own IANA timezone (CLAUDE.md), so the calendar date a reader
// sees has to be worked out in that zone - an evening in Chapel Hill is
// already the next day in UTC.
//
// src/lib/zonedTime.ts goes the other way (a naive wall clock into a UTC
// instant, for EXIF) and throws on a zone Intl does not know. A page must
// never fail over a date, so this module falls back to UTC instead.

export interface LocalDateParts {
	year: number;
	/** 1-12 */
	month: number;
	day: number;
}

// Month names are kept here instead of read from Intl: the Workers runtime
// is only certain to carry English locale data, and Intl silently prints
// English when it lacks a locale rather than failing.
const MONTHS_SHORT: Record<Locale, readonly string[]> = {
	en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
	// "maj" is not an abbreviation, so it carries no full stop.
	da: ['jan.', 'feb.', 'mar.', 'apr.', 'maj', 'jun.', 'jul.', 'aug.', 'sep.', 'okt.', 'nov.', 'dec.']
};

// Capitalised in both languages: these are only ever used as headings.
const MONTHS_LONG: Record<Locale, readonly string[]> = {
	en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
	da: ['Januar', 'Februar', 'Marts', 'April', 'Maj', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'December']
};

/**
 * Calendar date of a UTC ISO instant in the entry's own IANA timezone. Never
 * throws: an invalid timezone falls back to UTC. An instant that does not
 * parse at all gives NaN parts, which the formatters below print as ''.
 */
export function localDateParts(occurredAt: string, timeZone: string): LocalDateParts {
	const date = new Date(occurredAt);
	try {
		const parts = new Intl.DateTimeFormat('en-US', {
			timeZone,
			year: 'numeric',
			month: 'numeric',
			day: 'numeric'
		}).formatToParts(date);
		const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
		return { year: get('year'), month: get('month'), day: get('day') };
	} catch {
		// RangeError: Intl does not know this zone (or the instant is not a
		// date). The UTC getters give the same answer a retry with
		// timeZone: 'UTC' would, and they cannot throw.
		return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
	}
}

/** 'YYYY-MM' in the entry's own timezone. */
export function localMonthKey(occurredAt: string, timeZone: string): string {
	const { year, month } = localDateParts(occurredAt, timeZone);
	return `${year}-${String(month).padStart(2, '0')}`;
}

/** en: "30 Oct 2026", da: "30. okt. 2026" */
export function formatEntryDate(occurredAt: string, timeZone: string, lang: Locale): string {
	const { year, month, day } = localDateParts(occurredAt, timeZone);
	const monthName = MONTHS_SHORT[lang][month - 1];
	if (monthName === undefined) return '';
	return lang === 'da' ? `${day}. ${monthName} ${year}` : `${day} ${monthName} ${year}`;
}

/** en: "30 Oct", da: "30. okt." (no year) */
export function formatEntryDay(occurredAt: string, timeZone: string, lang: Locale): string {
	const { month, day } = localDateParts(occurredAt, timeZone);
	const monthName = MONTHS_SHORT[lang][month - 1];
	if (monthName === undefined) return '';
	return lang === 'da' ? `${day}. ${monthName}` : `${day} ${monthName}`;
}

/** en: "October 2026", da: "Oktober 2026" */
export function formatMonthHeading(year: number, month: number, lang: Locale): string {
	const monthName = MONTHS_LONG[lang][month - 1];
	if (monthName === undefined) return '';
	return `${monthName} ${year}`;
}
