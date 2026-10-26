import { describe, expect, it } from 'vitest';
import { groupIntoMoments, proposeLegs, type IngestItem, type LegStop } from '../../src/lib/ingest';

describe('groupIntoMoments', () => {
	it('keeps items close in time and place in one moment', () => {
		const items: IngestItem[] = [
			{ id: 1, capturedAt: '2026-09-19T10:00:00.000Z', placeId: 3 },
			{ id: 2, capturedAt: '2026-09-19T10:30:00.000Z', placeId: 3 },
			{ id: 3, capturedAt: '2026-09-19T11:00:00.000Z', placeId: 3 }
		];
		const moments = groupIntoMoments(items);
		expect(moments).toHaveLength(1);
		expect(moments[0].items.map((i) => i.id)).toEqual([1, 2, 3]);
	});

	it('splits on a gap of about two hours', () => {
		const items: IngestItem[] = [
			{ id: 1, capturedAt: '2026-09-19T10:00:00.000Z', placeId: 3 },
			{ id: 2, capturedAt: '2026-09-19T12:30:00.000Z', placeId: 3 }
		];
		const moments = groupIntoMoments(items);
		expect(moments).toHaveLength(2);
	});

	it('does not split on a gap just under two hours', () => {
		const items: IngestItem[] = [
			{ id: 1, capturedAt: '2026-09-19T10:00:00.000Z', placeId: 3 },
			{ id: 2, capturedAt: '2026-09-19T11:59:00.000Z', placeId: 3 }
		];
		expect(groupIntoMoments(items)).toHaveLength(1);
	});

	it('splits on a real change of place even within the time window', () => {
		const items: IngestItem[] = [
			{ id: 1, capturedAt: '2026-09-19T10:00:00.000Z', placeId: 2 },
			{ id: 2, capturedAt: '2026-09-19T10:05:00.000Z', placeId: 3 }
		];
		const moments = groupIntoMoments(items);
		expect(moments).toHaveLength(2);
	});

	it('an item with no known place does not itself force a split', () => {
		const items: IngestItem[] = [
			{ id: 1, capturedAt: '2026-09-19T10:00:00.000Z', placeId: 3 },
			{ id: 2, capturedAt: '2026-09-19T10:05:00.000Z', placeId: null },
			{ id: 3, capturedAt: '2026-09-19T10:10:00.000Z', placeId: 3 }
		];
		const moments = groupIntoMoments(items);
		expect(moments).toHaveLength(1);
		expect(moments[0].items).toHaveLength(3);
	});

	it('sorts out-of-order input by capture time first', () => {
		const items: IngestItem[] = [
			{ id: 2, capturedAt: '2026-09-19T10:30:00.000Z', placeId: 3 },
			{ id: 1, capturedAt: '2026-09-19T10:00:00.000Z', placeId: 3 }
		];
		const moments = groupIntoMoments(items);
		expect(moments[0].items.map((i) => i.id)).toEqual([1, 2]);
	});

	it('records the moment\'s start, end and first known place', () => {
		const items: IngestItem[] = [
			{ id: 1, capturedAt: '2026-09-19T10:00:00.000Z', placeId: null },
			{ id: 2, capturedAt: '2026-09-19T10:05:00.000Z', placeId: 3 },
			{ id: 3, capturedAt: '2026-09-19T10:10:00.000Z', placeId: 3 }
		];
		const [moment] = groupIntoMoments(items);
		expect(moment).toMatchObject({ startedAt: '2026-09-19T10:00:00.000Z', endedAt: '2026-09-19T10:10:00.000Z', placeId: 3 });
	});
});

describe('proposeLegs', () => {
	const copenhagen: LegStop = { placeId: 1, coordinates: [12.5683, 55.6761] };
	const chapelHill: LegStop = { placeId: 2, coordinates: [-79.0558, 35.9132] };
	const asheville: LegStop = { placeId: 3, coordinates: [-82.5515, 35.5951] };

	it('proposes nothing when staying in the same place', () => {
		expect(proposeLegs([chapelHill, { ...chapelHill }])).toEqual([]);
	});

	it('guesses a flight over roughly 800km', () => {
		const legs = proposeLegs([copenhagen, chapelHill]);
		expect(legs).toHaveLength(1);
		expect(legs[0]).toMatchObject({ fromPlaceId: 1, toPlaceId: 2, mode: 'flight' });
		expect(legs[0].distanceKm).toBeGreaterThan(800);
	});

	it('guesses a car under roughly 800km', () => {
		const legs = proposeLegs([chapelHill, asheville]);
		expect(legs).toHaveLength(1);
		expect(legs[0]).toMatchObject({ fromPlaceId: 2, toPlaceId: 3, mode: 'car' });
		expect(legs[0].distanceKm).toBeLessThan(800);
	});

	it('proposes one leg per change across a longer sequence', () => {
		const legs = proposeLegs([copenhagen, chapelHill, chapelHill, asheville, chapelHill]);
		expect(legs.map((l) => [l.fromPlaceId, l.toPlaceId])).toEqual([
			[1, 2],
			[2, 3],
			[3, 2]
		]);
	});
});
