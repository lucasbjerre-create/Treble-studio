import { describe, expect, it } from 'vitest';
import {
	adjacentChapterEntryDate,
	adjacentEntryDate,
	computeTimelineState,
	type TimelineEntry,
	type TimelineLeg
} from '../../src/lib/timeline';

const entries: TimelineEntry[] = [
	{ id: 1, occurredAt: '2026-08-15T09:00:00.000Z', chapterId: 1, placeId: 1 },
	{ id: 2, occurredAt: '2026-08-20T09:00:00.000Z', chapterId: 1, placeId: 2 },
	{ id: 3, occurredAt: '2026-09-01T09:00:00.000Z', chapterId: 1, placeId: 2 },
	{ id: 4, occurredAt: '2026-10-01T09:00:00.000Z', chapterId: 2, placeId: 3 },
	{ id: 5, occurredAt: '2026-10-10T09:00:00.000Z', chapterId: 2, placeId: 3 }
];

const legs: TimelineLeg[] = [
	{ id: 10, fromPlaceId: 1, toPlaceId: 2, startsAt: '2026-08-16T00:00:00.000Z', endsAt: '2026-08-17T00:00:00.000Z' },
	{ id: 11, fromPlaceId: 2, toPlaceId: 3, startsAt: '2026-09-25T00:00:00.000Z', endsAt: null }
];

describe('computeTimelineState - activeEntry', () => {
	it('picks the entry exactly at the given date', () => {
		expect(computeTimelineState(entries, legs, '2026-08-20T09:00:00.000Z').activeEntry?.id).toBe(2);
	});

	it('picks the most recent entry at or before the date', () => {
		expect(computeTimelineState(entries, legs, '2026-08-18T00:00:00.000Z').activeEntry?.id).toBe(1);
	});

	it('falls back to the earliest entry when the date is before everything', () => {
		expect(computeTimelineState(entries, legs, '2026-01-01T00:00:00.000Z').activeEntry?.id).toBe(1);
	});

	it('picks the last entry when the date is after everything', () => {
		expect(computeTimelineState(entries, legs, '2026-12-01T00:00:00.000Z').activeEntry?.id).toBe(5);
	});
});

describe('computeTimelineState - chapterId', () => {
	it('follows the active entry', () => {
		expect(computeTimelineState(entries, legs, '2026-08-20T09:00:00.000Z').chapterId).toBe(1);
		expect(computeTimelineState(entries, legs, '2026-10-01T09:00:00.000Z').chapterId).toBe(2);
	});
});

describe('computeTimelineState - routeProgress', () => {
	it('is future before the leg starts', () => {
		const state = computeTimelineState(entries, legs, '2026-08-15T00:00:00.000Z');
		expect(state.routeProgress.find((l) => l.legId === 10)?.status).toBe('future');
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
		expect(state.visibleMarkers[0]).toMatchObject({ entryId: 1, isActive: true });
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
