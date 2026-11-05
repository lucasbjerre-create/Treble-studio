import { describe, expect, it } from 'vitest';
import { dateRangesOverlapOrAdjacent, sameParticipants, suggestCrossings, type Stay } from '../../src/lib/crossings';

describe('suggestCrossings', () => {
	it('suggests a crossing for two people overlapping at the same place', () => {
		const stays: Stay[] = [
			{ personId: 1, placeId: 3, startsOn: '2026-09-19', endsOn: '2026-09-20' },
			{ personId: 2, placeId: 3, startsOn: '2026-09-19', endsOn: '2026-09-20' }
		];
		expect(suggestCrossings(stays)).toEqual([{ placeId: 3, personIds: [1, 2], startsOn: '2026-09-19', endsOn: '2026-09-20' }]);
	});

	it('merges consecutive (back-to-back) days at the same place into one crossing', () => {
		const stays: Stay[] = [
			{ personId: 1, placeId: 3, startsOn: '2026-09-18', endsOn: '2026-09-19' },
			{ personId: 2, placeId: 3, startsOn: '2026-09-20', endsOn: '2026-09-21' }
		];
		const result = suggestCrossings(stays);
		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({ placeId: 3, personIds: [1, 2], startsOn: '2026-09-18', endsOn: '2026-09-21' });
	});

	it('does not suggest a crossing when there is a real gap between stays', () => {
		const stays: Stay[] = [
			{ personId: 1, placeId: 3, startsOn: '2026-09-10', endsOn: '2026-09-11' },
			{ personId: 2, placeId: 3, startsOn: '2026-09-20', endsOn: '2026-09-21' }
		];
		expect(suggestCrossings(stays)).toEqual([]);
	});

	it('does not suggest a crossing for one person alone, even across several stays', () => {
		const stays: Stay[] = [
			{ personId: 1, placeId: 3, startsOn: '2026-09-19', endsOn: '2026-09-20' },
			{ personId: 1, placeId: 3, startsOn: '2026-09-19', endsOn: '2026-09-25' }
		];
		expect(suggestCrossings(stays)).toEqual([]);
	});

	it('does not suggest a crossing for the same dates at different places', () => {
		const stays: Stay[] = [
			{ personId: 1, placeId: 2, startsOn: '2026-09-19', endsOn: '2026-09-20' },
			{ personId: 2, placeId: 3, startsOn: '2026-09-19', endsOn: '2026-09-20' }
		];
		expect(suggestCrossings(stays)).toEqual([]);
	});

	it('groups three people transitively even when the first and last never directly overlap', () => {
		const stays: Stay[] = [
			{ personId: 1, placeId: 3, startsOn: '2026-09-01', endsOn: '2026-09-05' },
			{ personId: 2, placeId: 3, startsOn: '2026-09-05', endsOn: '2026-09-10' },
			{ personId: 3, placeId: 3, startsOn: '2026-09-10', endsOn: '2026-09-15' }
		];
		const result = suggestCrossings(stays);
		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({
			placeId: 3,
			personIds: [1, 2, 3],
			startsOn: '2026-09-01',
			endsOn: '2026-09-15'
		});
	});

	it('keeps two separate crossings at the same place when there is a real gap between the groups', () => {
		const stays: Stay[] = [
			{ personId: 1, placeId: 3, startsOn: '2026-08-01', endsOn: '2026-08-02' },
			{ personId: 2, placeId: 3, startsOn: '2026-08-01', endsOn: '2026-08-02' },
			{ personId: 3, placeId: 3, startsOn: '2026-09-19', endsOn: '2026-09-20' },
			{ personId: 4, placeId: 3, startsOn: '2026-09-19', endsOn: '2026-09-20' }
		];
		const result = suggestCrossings(stays);
		expect(result).toHaveLength(2);
	});
});

describe('dateRangesOverlapOrAdjacent', () => {
	it('is true for overlapping ranges', () => {
		expect(dateRangesOverlapOrAdjacent({ startsOn: '2026-09-19', endsOn: '2026-09-21' }, { startsOn: '2026-09-20', endsOn: '2026-09-22' })).toBe(
			true
		);
	});

	it('is true for back-to-back (adjacent) ranges', () => {
		expect(dateRangesOverlapOrAdjacent({ startsOn: '2026-09-18', endsOn: '2026-09-19' }, { startsOn: '2026-09-20', endsOn: '2026-09-21' })).toBe(
			true
		);
	});

	it('is false for ranges with a real gap', () => {
		expect(dateRangesOverlapOrAdjacent({ startsOn: '2026-09-10', endsOn: '2026-09-11' }, { startsOn: '2026-09-20', endsOn: '2026-09-21' })).toBe(
			false
		);
	});
});

describe('sameParticipants', () => {
	it('is true for the same ids in a different order', () => {
		expect(sameParticipants([2, 1], [1, 2])).toBe(true);
	});

	it('is false for different sets of ids', () => {
		expect(sameParticipants([1, 2], [1, 3])).toBe(false);
	});

	it('is false for different-sized sets', () => {
		expect(sameParticipants([1, 2, 3], [1, 2])).toBe(false);
	});
});
