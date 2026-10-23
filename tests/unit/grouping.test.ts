import { describe, expect, it } from 'vitest';
import { groupEntriesByChapterAndMonth } from '../../src/lib/grouping';

interface Entry {
	id: number;
	chapterId: number | null;
	occurredAt: string;
}

describe('groupEntriesByChapterAndMonth', () => {
	it('groups by chapter then month, preserving first-seen order', () => {
		const entries: Entry[] = [
			{ id: 1, chapterId: 1, occurredAt: '2026-10-20T00:00:00.000Z' },
			{ id: 2, chapterId: 1, occurredAt: '2026-10-05T00:00:00.000Z' },
			{ id: 3, chapterId: 1, occurredAt: '2026-09-01T00:00:00.000Z' },
			{ id: 4, chapterId: 2, occurredAt: '2026-08-15T00:00:00.000Z' }
		];

		const groups = groupEntriesByChapterAndMonth(entries);

		expect(groups).toHaveLength(2);
		expect(groups[0]?.chapterId).toBe(1);
		expect(groups[0]?.months.map((m) => m.monthKey)).toEqual(['2026-10', '2026-09']);
		expect(groups[0]?.months[0]?.entries.map((e) => e.id)).toEqual([1, 2]);
		expect(groups[1]?.chapterId).toBe(2);
		expect(groups[1]?.months).toEqual([{ monthKey: '2026-08', entries: [entries[3]] }]);
	});

	it('groups entries with no chapter under the null key', () => {
		const entries: Entry[] = [{ id: 1, chapterId: null, occurredAt: '2026-08-01T00:00:00.000Z' }];
		const groups = groupEntriesByChapterAndMonth(entries);
		expect(groups).toEqual([{ chapterId: null, months: [{ monthKey: '2026-08', entries: [entries[0]] }] }]);
	});

	it('returns an empty array for no entries', () => {
		expect(groupEntriesByChapterAndMonth([])).toEqual([]);
	});
});
