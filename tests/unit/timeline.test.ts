import { describe, expect, it } from 'vitest';
import {
	adjacentChapterEntryDate,
	adjacentEntryDate,
	computeTimelineState,
	type TimelineEntry,
	type TimelineLeg
} from '../../src/lib/timeline';

const PERSON = 1;

const entries: TimelineEntry[] = [
	{ id: 1, personId: PERSON, occurredAt: '2026-08-15T09:00:00.000Z', chapterId: 1, placeId: 1 },
	{ id: 2, personId: PERSON, occurredAt: '2026-08-20T09:00:00.000Z', chapterId: 1, placeId: 2 },
	{ id: 3, personId: PERSON, occurredAt: '2026-09-01T09:00:00.000Z', chapterId: 1, placeId: 2 },
	{ id: 4, personId: PERSON, occurredAt: '2026-10-01T09:00:00.000Z', chapterId: 2, placeId: 3 },
	{ id: 5, personId: PERSON, occurredAt: '2026-10-10T09:00:00.000Z', chapterId: 2, placeId: 3 }
];

const legs: TimelineLeg[] = [
	{
		id: 10,
		personId: PERSON,
		fromPlaceId: 1,
		toPlaceId: 2,
		startsAt: '2026-08-16T00:00:00.000Z',
		endsAt: '2026-08-17T00:00:00.000Z'
	},
	{ id: 11, personId: PERSON, fromPlaceId: 2, toPlaceId: 3, startsAt: '2026-09-25T00:00:00.000Z', endsAt: null }
];

describe('computeTimelineState - activeEntries (single person)', () => {
	it('picks the entry exactly at the given date', () => {
		expect(computeTimelineState(entries, legs, '2026-08-20T09:00:00.000Z').activeEntries).toMatchObject([
			{ id: 2 }
		]);
	});

	it('picks the most recent entry at or before the date', () => {
		expect(computeTimelineState(entries, legs, '2026-08-18T00:00:00.000Z').activeEntries).toMatchObject([
			{ id: 1 }
		]);
	});

	it('falls back to the earliest entry when the date is before everything', () => {
		expect(computeTimelineState(entries, legs, '2026-01-01T00:00:00.000Z').activeEntries).toMatchObject([
			{ id: 1 }
		]);
	});

	it('picks the last entry when the date is after everything', () => {
		expect(computeTimelineState(entries, legs, '2026-12-01T00:00:00.000Z').activeEntries).toMatchObject([
			{ id: 5 }
		]);
	});

	it('the active entry carries its own chapterId', () => {
		expect(computeTimelineState(entries, legs, '2026-08-20T09:00:00.000Z').activeEntries[0]?.chapterId).toBe(1);
		expect(computeTimelineState(entries, legs, '2026-10-01T09:00:00.000Z').activeEntries[0]?.chapterId).toBe(2);
	});
});

describe('computeTimelineState - routeProgress', () => {
	it('is future before the leg starts', () => {
		const state = computeTimelineState(entries, legs, '2026-08-15T00:00:00.000Z');
		expect(state.routeProgress.find((l) => l.legId === 10)).toMatchObject({ status: 'future', personId: PERSON });
	});

	it('is current while within the leg window', () => {
		const state = computeTimelineState(entries, legs, '2026-08-16T12:00:00.000Z');
		expect(state.routeProgress.find((l) => l.legId === 10)?.status).toBe('current');
	});

	it('is past after the leg ends', () => {
		const state = computeTimelineState(entries, legs, '2026-08-20T00:00:00.000Z');
		expect(state.routeProgress.find((l) => l.legId === 10)?.status).toBe('past');
	});

	it('treats a leg with no end date as instantaneous at its start', () => {
		expect(
			computeTimelineState(entries, legs, '2026-09-25T00:00:00.000Z').routeProgress.find((l) => l.legId === 11)
				?.status
		).toBe('current');
		expect(
			computeTimelineState(entries, legs, '2026-09-26T00:00:00.000Z').routeProgress.find((l) => l.legId === 11)
				?.status
		).toBe('past');
	});
});

describe('computeTimelineState - visibleMarkers', () => {
	it('never reveals an entry later than the active one', () => {
		const state = computeTimelineState(entries, legs, '2026-08-18T00:00:00.000Z');
		expect(state.visibleMarkers.map((m) => m.entryId)).toEqual([1]);
		expect(state.visibleMarkers[0]).toMatchObject({ entryId: 1, personId: PERSON, isActive: true });
	});

	it('always shows the fallback active entry even before every entry', () => {
		const state = computeTimelineState(entries, legs, '2026-01-01T00:00:00.000Z');
		expect(state.visibleMarkers.map((m) => m.entryId)).toEqual([1]);
	});

	it('reveals every entry once the date reaches the end', () => {
		const state = computeTimelineState(entries, legs, '2026-10-10T09:00:00.000Z');
		expect(state.visibleMarkers.map((m) => m.entryId)).toEqual([1, 2, 3, 4, 5]);
		expect(state.visibleMarkers.at(-1)).toMatchObject({ entryId: 5, isActive: true });
	});
});

describe('computeTimelineState - several people at once', () => {
	const PERSON_A = 1;
	const PERSON_B = 2;

	// Person A: Copenhagen -> Chapel Hill, chapters 1 (from 08-15) then 2 (from 10-01).
	// Person B: on a totally different, overlapping-in-time schedule - Oslo ->
	// Berlin, chapter 101 (from 08-01) then 102 (from 09-10) - to prove one
	// person's entries never leak into another's active entry or chapter.
	const twoPeopleEntries: TimelineEntry[] = [
		{ id: 1, personId: PERSON_A, occurredAt: '2026-08-15T09:00:00.000Z', chapterId: 1, placeId: 1 },
		{ id: 4, personId: PERSON_A, occurredAt: '2026-10-01T09:00:00.000Z', chapterId: 2, placeId: 3 },
		{ id: 101, personId: PERSON_B, occurredAt: '2026-08-01T09:00:00.000Z', chapterId: 101, placeId: 10 },
		{ id: 102, personId: PERSON_B, occurredAt: '2026-09-10T09:00:00.000Z', chapterId: 102, placeId: 11 }
	];

	const twoPeopleLegs: TimelineLeg[] = [
		{
			id: 10,
			personId: PERSON_A,
			fromPlaceId: 1,
			toPlaceId: 3,
			startsAt: '2026-09-01T00:00:00.000Z',
			endsAt: '2026-09-02T00:00:00.000Z'
		},
		{
			id: 110,
			personId: PERSON_B,
			fromPlaceId: 10,
			toPlaceId: 11,
			startsAt: '2026-09-05T00:00:00.000Z',
			endsAt: '2026-09-06T00:00:00.000Z'
		}
	];

	it('gives each person their own active entry at the same shared date', () => {
		const state = computeTimelineState(twoPeopleEntries, twoPeopleLegs, '2026-09-15T00:00:00.000Z');
		expect(state.activeEntries).toHaveLength(2);
		const byPerson = Object.fromEntries(state.activeEntries.map((e) => [e.personId, e]));
		// A hasn't reached entry 4 (10-01) yet, so still on entry 1.
		expect(byPerson[PERSON_A]).toMatchObject({ id: 1, chapterId: 1 });
		// B has already passed entry 101 and reached entry 102.
		expect(byPerson[PERSON_B]).toMatchObject({ id: 102, chapterId: 102 });
	});

	it('one person being before all their entries does not affect the other person', () => {
		const state = computeTimelineState(twoPeopleEntries, twoPeopleLegs, '2026-08-10T00:00:00.000Z');
		const byPerson = Object.fromEntries(state.activeEntries.map((e) => [e.personId, e]));
		// A is before their only-so-far entry (08-15) - falls back to it.
		expect(byPerson[PERSON_A]).toMatchObject({ id: 1 });
		// B has already passed their first entry (08-01).
		expect(byPerson[PERSON_B]).toMatchObject({ id: 101 });
	});

	it('routeProgress and visibleMarkers carry the right personId for each person independently', () => {
		const state = computeTimelineState(twoPeopleEntries, twoPeopleLegs, '2026-09-15T00:00:00.000Z');

		expect(state.routeProgress.find((l) => l.legId === 10)).toMatchObject({ personId: PERSON_A, status: 'past' });
		expect(state.routeProgress.find((l) => l.legId === 110)).toMatchObject({ personId: PERSON_B, status: 'past' });

		// Entry 4 (person A, 10-01) is still in the future at this date, so it's
		// correctly not revealed yet - person A's visible/active marker is
		// still entry 1, matching the earlier "own active entry" test above.
		const markerIds = state.visibleMarkers.map((m) => m.entryId).sort((a, b) => a - b);
		expect(markerIds).toEqual([1, 101, 102]);
		expect(state.visibleMarkers.find((m) => m.entryId === 1)).toMatchObject({ personId: PERSON_A, isActive: true });
		expect(state.visibleMarkers.find((m) => m.entryId === 102)).toMatchObject({
			personId: PERSON_B,
			isActive: true
		});
	});
});

describe('adjacentEntryDate', () => {
	it('moves to the next entry', () => {
		expect(adjacentEntryDate(entries, '2026-08-15T09:00:00.000Z', 'next')).toBe('2026-08-20T09:00:00.000Z');
	});

	it('moves to the previous entry', () => {
		expect(adjacentEntryDate(entries, '2026-08-20T09:00:00.000Z', 'previous')).toBe('2026-08-15T09:00:00.000Z');
	});

	it('does not wrap around at the start', () => {
		expect(adjacentEntryDate(entries, '2026-08-15T09:00:00.000Z', 'previous')).toBeUndefined();
	});

	it('does not wrap around at the end', () => {
		expect(adjacentEntryDate(entries, '2026-10-10T09:00:00.000Z', 'next')).toBeUndefined();
	});
});

describe('adjacentChapterEntryDate', () => {
	it('jumps to the first entry of the next chapter', () => {
		expect(adjacentChapterEntryDate(entries, '2026-08-20T09:00:00.000Z', 'next')).toBe('2026-10-01T09:00:00.000Z');
	});

	it('jumps to the first entry of the previous chapter', () => {
		expect(adjacentChapterEntryDate(entries, '2026-10-10T09:00:00.000Z', 'previous')).toBe(
			'2026-08-15T09:00:00.000Z'
		);
	});

	it('does not wrap around past the first chapter', () => {
		expect(adjacentChapterEntryDate(entries, '2026-08-15T09:00:00.000Z', 'previous')).toBeUndefined();
	});

	it('does not wrap around past the last chapter', () => {
		expect(adjacentChapterEntryDate(entries, '2026-10-10T09:00:00.000Z', 'next')).toBeUndefined();
	});
});
