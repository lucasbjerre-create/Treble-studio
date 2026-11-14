import { describe, expect, it } from 'vitest';
import { groupEntriesByChapterAndMonth } from '../../src/lib/grouping';

interface Entry {
	id: number;
	chapterId: number | null;
	occurredAt: string;
	timezone: string;
}

describe('groupEntriesByChapterAndMonth', () => {
	it('groups by chapter then month, preserving first-seen order', () => {
		const entries: Entry[] = [
			{ id: 1, chapterId: 1, occurredAt: '2026-10-20T00:00:00.000Z', timezone: 'UTC' },
			{ id: 2, chapterId: 1, occurredAt: '2026-10-05T00:00:00.000Z', timezone: 'UTC' },
			{ id: 3, chapterId: 1, occurredAt: '2026-09-01T00:00:00.000Z', timezone: 'UTC' },
			{ id: 4, chapterId: 2, occurredAt: '2026-08-15T00:00:00.000Z', timezone: 'UTC' }
		];

		const groups = groupEntriesByChapterAndMonth(entries);

		expect(groups).toHaveLength(2);
		expect(groups[0]?.chapterId).toBe(1);
		expect(groups[0]?.months.map((m) => m.monthKey)).toEqual(['2026-10', '2026-09']);
		expect(groups[0]?.months[0]?.entries.map((e) => e.id)).toEqual([1, 2]);
		expect(groups[1]?.chapterId).toBe(2);
		expect(groups[1]?.months).toEqual([{ monthKey: '2026-08', year: 2026, month: 8, entries: [entries[3]] }]);
	});

	it('groups entries with no chapter under the null key', () => {
		const entries: Entry[] = [{ id: 1, chapterId: null, occurredAt: '2026-08-01T00:00:00.000Z', timezone: 'UTC' }];
		const groups = groupEntriesByChapterAndMonth(entries);
		expect(groups).toEqual([{ chapterId: null, months: [{ monthKey: '2026-08', year: 2026, month: 8, entries: [entries[0]] }] }]);
	});

	it("groups by the month in the entry's own timezone, not the UTC month", () => {
		// 02:00 UTC on 1 November is still the evening of 31 October in Chapel
		// Hill, so both of these belong under October.
		const entries: Entry[] = [
			{ id: 1, chapterId: 1, occurredAt: '2026-11-01T02:00:00.000Z', timezone: 'America/New_York' },
			{ id: 2, chapterId: 1, occurredAt: '2026-10-20T16:00:00.000Z', timezone: 'America/New_York' }
		];
		const groups = groupEntriesByChapterAndMonth(entries);
		expect(groups).toEqual([{ chapterId: 1, months: [{ monthKey: '2026-10', year: 2026, month: 10, entries }] }]);
	});

	it('uses each entry\'s own timezone - the same instant falls in different months in Chapel Hill and Singapore', () => {
		const entries: Entry[] = [
			{ id: 1, chapterId: 1, occurredAt: '2026-11-01T02:00:00.000Z', timezone: 'Asia/Singapore' },
			{ id: 2, chapterId: 1, occurredAt: '2026-11-01T02:00:00.000Z', timezone: 'America/New_York' }
		];
		const groups = groupEntriesByChapterAndMonth(entries);
		expect(groups[0]?.months.map((m) => m.monthKey)).toEqual(['2026-11', '2026-10']);
	});

	it('returns an empty array for no entries', () => {
		expect(groupEntriesByChapterAndMonth([])).toEqual([]);
	});
});
