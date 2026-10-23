import { describe, expect, it } from 'vitest';
import { currentChapter } from '../../src/lib/chapters';

describe('currentChapter', () => {
	it('picks the most recently started chapter', () => {
		const chapters = [{ id: 1, startsOn: '2026-08-15' }, { id: 2, startsOn: '2027-01-10' }];
		expect(currentChapter(chapters, '2026-10-23')?.id).toBe(1);
		expect(currentChapter(chapters, '2027-02-01')?.id).toBe(2);
	});

	it('returns undefined when no chapter has started yet', () => {
		const chapters = [{ id: 1, startsOn: '2027-01-10' }];
		expect(currentChapter(chapters, '2026-10-23')).toBeUndefined();
	});

	it('returns undefined for an empty list', () => {
		expect(currentChapter([], '2026-10-23')).toBeUndefined();
	});
});
