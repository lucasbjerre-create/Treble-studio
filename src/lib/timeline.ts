export type LegStatus = 'past' | 'current' | 'future';

export interface TimelineEntry {
	id: number;
	personId: number;
	occurredAt: string;
	chapterId: number | null;
	placeId: number | null;
}

export interface TimelineLeg {
	id: number;
	personId: number;
	fromPlaceId: number;
	toPlaceId: number;
	startsAt: string;
	endsAt: string | null;
}

export interface TimelineMarker {
	entryId: number;
	personId: number;
	placeId: number | null;
	isActive: boolean;
}

export interface TimelineLegProgress {
	legId: number;
	personId: number;
	status: LegStatus;
}

export interface TimelineState {
	/** One per distinct personId present in `entries` - each person has their own active entry at the same shared `date`. */
	activeEntries: TimelineEntry[];
	routeProgress: TimelineLegProgress[];
	visibleMarkers: TimelineMarker[];
}

function sortByOccurredAt<T extends { occurredAt: string }>(entries: T[]): T[] {
	return [...entries].sort((a, b) => (a.occurredAt < b.occurredAt ? -1 : a.occurredAt > b.occurredAt ? 1 : 0));
}

/** Most recent entry at or before `date` within a single person's (sorted) entries; falls back to the earliest so there's always something active. */
function activeEntryForPerson(personEntries: TimelineEntry[], date: string): TimelineEntry | undefined {
	let active: TimelineEntry | undefined;
	for (const entry of personEntries) {
		if (entry.occurredAt <= date) active = entry;
		else break;
	}
	return active ?? personEntries[0];
}

/**
 * Map, slider, scroll and URL all read from this and write back through it
 * (CLAUDE.md). Works for one person or several at once, all evaluated
 * against the same `date` - each person gets their own active entry, since
 * people have independent chapters and locations at the same point in
 * calendar time. Group features aren't built on this yet, but the shape is
 * ready for them.
 */
export function computeTimelineState(entries: TimelineEntry[], legs: TimelineLeg[], date: string): TimelineState {
	const sorted = sortByOccurredAt(entries);

	const personIds: number[] = [];
	for (const entry of sorted) {
		if (!personIds.includes(entry.personId)) personIds.push(entry.personId);
	}

	const activeEntries: TimelineEntry[] = [];
	const activeIdByPerson = new Map<number, number>();
	for (const personId of personIds) {
		const personEntries = sorted.filter((e) => e.personId === personId);
		const active = activeEntryForPerson(personEntries, date);
		if (active) {
			activeEntries.push(active);
			activeIdByPerson.set(personId, active.id);
		}
	}

	const routeProgress: TimelineLegProgress[] = legs.map((leg) => {
		const end = leg.endsAt ?? leg.startsAt;
		let status: LegStatus;
		if (date < leg.startsAt) status = 'future';
		else if (date > end) status = 'past';
		else status = 'current';
		return { legId: leg.id, personId: leg.personId, status };
	});

	const visibleMarkers: TimelineMarker[] = sorted
		.filter((entry) => entry.occurredAt <= date || entry.id === activeIdByPerson.get(entry.personId))
		.map((entry) => ({
			entryId: entry.id,
			personId: entry.personId,
			placeId: entry.placeId,
			isActive: entry.id === activeIdByPerson.get(entry.personId)
		}));

	return { activeEntries, routeProgress, visibleMarkers };
}

export type NavigationDirection = 'next' | 'previous';

/**
 * For the slider's arrow-key support: moves one entry at a time, no
 * wraparound. Operates on one person's entries at a time - call with a
 * single person's list, same as today.
 */
export function adjacentEntryDate(
	entries: TimelineEntry[],
	date: string,
	direction: NavigationDirection
): string | undefined {
	const sorted = sortByOccurredAt(entries);
	if (direction === 'next') {
		return sorted.find((entry) => entry.occurredAt > date)?.occurredAt;
	}
	let previous: TimelineEntry | undefined;
	for (const entry of sorted) {
		if (entry.occurredAt >= date) break;
		previous = entry;
	}
	return previous?.occurredAt;
}

/**
 * For Shift+arrow: jumps to the first entry of the next/previous chapter, no
 * wraparound. Operates on one person's entries at a time, same as today.
 */
export function adjacentChapterEntryDate(
	entries: TimelineEntry[],
	date: string,
	direction: NavigationDirection
): string | undefined {
	const sorted = sortByOccurredAt(entries);
	const currentChapterId = activeEntryForPerson(sorted, date)?.chapterId ?? null;

	if (direction === 'next') {
		const next = sorted.find((entry) => entry.occurredAt > date && entry.chapterId !== currentChapterId);
		return next?.occurredAt;
	}

	// Walk backward from `date` for the nearest entry in a different (earlier)
	// chapter, then jump to that chapter's own first (earliest) entry.
	let previousChapterId: number | null | undefined;
	for (let i = sorted.length - 1; i >= 0; i--) {
		const entry = sorted[i];
		if (entry.occurredAt < date && entry.chapterId !== currentChapterId) {
			previousChapterId = entry.chapterId;
			break;
		}
	}
	if (previousChapterId === undefined) return undefined;
	return sorted.find((entry) => entry.chapterId === previousChapterId)?.occurredAt;
}
