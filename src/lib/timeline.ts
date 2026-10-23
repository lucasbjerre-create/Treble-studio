export type LegStatus = 'past' | 'current' | 'future';

export interface TimelineEntry {
	id: number;
	occurredAt: string;
	chapterId: number | null;
	placeId: number | null;
}

export interface TimelineLeg {
	id: number;
	fromPlaceId: number;
	toPlaceId: number;
	startsAt: string;
	endsAt: string | null;
}

export interface TimelineMarker {
	entryId: number;
	placeId: number | null;
	isActive: boolean;
}

export interface TimelineLegProgress {
	legId: number;
	status: LegStatus;
}

export interface TimelineState {
	activeEntry: TimelineEntry | undefined;
	chapterId: number | null;
	routeProgress: TimelineLegProgress[];
	visibleMarkers: TimelineMarker[];
}

function sortByOccurredAt(entries: TimelineEntry[]): TimelineEntry[] {
	return [...entries].sort((a, b) => (a.occurredAt < b.occurredAt ? -1 : a.occurredAt > b.occurredAt ? 1 : 0));
}

/** Map, slider, scroll and URL all read from this and write back through it (CLAUDE.md). */
export function computeTimelineState(entries: TimelineEntry[], legs: TimelineLeg[], date: string): TimelineState {
	const sorted = sortByOccurredAt(entries);

	// Most recent entry at or before `date`; falls back to the earliest entry
	// if `date` is before everything, so there's always something active.
	let activeEntry: TimelineEntry | undefined;
	for (const entry of sorted) {
		if (entry.occurredAt <= date) activeEntry = entry;
		else break;
	}
	if (!activeEntry) activeEntry = sorted[0];

	const chapterId = activeEntry?.chapterId ?? null;

	const routeProgress: TimelineLegProgress[] = legs.map((leg) => {
		const end = leg.endsAt ?? leg.startsAt;
		let status: LegStatus;
		if (date < leg.startsAt) status = 'future';
		else if (date > end) status = 'past';
		else status = 'current';
		return { legId: leg.id, status };
	});

	const visibleMarkers: TimelineMarker[] = sorted
		.filter((entry) => entry.occurredAt <= date || entry.id === activeEntry?.id)
		.map((entry) => ({
			entryId: entry.id,
			placeId: entry.placeId,
			isActive: entry.id === activeEntry?.id
		}));

	return { activeEntry, chapterId, routeProgress, visibleMarkers };
}

export type NavigationDirection = 'next' | 'previous';

/** For the slider's arrow-key support: moves one entry at a time, no wraparound. */
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

/** For Shift+arrow: jumps to the first entry of the next/previous chapter, no wraparound. */
export function adjacentChapterEntryDate(
	entries: TimelineEntry[],
	date: string,
	direction: NavigationDirection
): string | undefined {
	const sorted = sortByOccurredAt(entries);
	const currentChapterId = computeTimelineState(entries, [], date).chapterId;

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
