import { env } from 'cloudflare:workers';
import { drizzle } from 'drizzle-orm/d1';
import { beforeAll, describe, expect, it } from 'vitest';
import { confirmCrossingParticipant, createCrossingFromSuggestion, listCrossingsForPerson } from '../../src/db/queries';
import * as schema from '../../src/db/schema';

const now = '2026-10-23T12:00:00.000Z';

function db() {
	return drizzle(env.DB, { schema });
}

beforeAll(async () => {
	const d = db();
	await d.insert(schema.people).values([
		{ id: 1, slug: 'lucas', displayName: 'Lucas', role: 'scholar', createdAt: now },
		{ id: 2, slug: 'anna', displayName: 'Anna', role: 'scholar', createdAt: now },
		{ id: 3, slug: 'someone-else', displayName: 'Someone Else', role: 'scholar', createdAt: now }
	]);
	await d.insert(schema.places).values({ id: 1, label: 'Asheville', latPublic: 35.6, lonPublic: -82.55, precision: 'city' });
});

describe('listCrossingsForPerson', () => {
	it('returns every crossing (confirmed or not) involving that person, with the full participant list', async () => {
		const d = db();
		const crossing = await createCrossingFromSuggestion(
			d,
			{ placeId: 1, personIds: [1, 2], startsOn: '2026-09-19', endsOn: '2026-09-20' },
			now
		);

		const forLucas = await listCrossingsForPerson(d, 1);
		expect(forLucas.map((c) => c.id)).toContain(crossing.id);
		const row = forLucas.find((c) => c.id === crossing.id)!;
		expect(row.participants.map((p) => p.personId).sort()).toEqual([1, 2]);
		expect(row.participants.every((p) => p.confirmed === false)).toBe(true);

		const forSomeoneElse = await listCrossingsForPerson(d, 3);
		expect(forSomeoneElse.map((c) => c.id)).not.toContain(crossing.id);
	});
});

describe('createCrossingFromSuggestion', () => {
	it('is idempotent: re-suggesting the same place/participants/overlapping dates returns the existing row, not a duplicate', async () => {
		const d = db();
		const first = await createCrossingFromSuggestion(
			d,
			{ placeId: 1, personIds: [1, 2], startsOn: '2026-06-01', endsOn: '2026-06-02' },
			now
		);
		const second = await createCrossingFromSuggestion(
			d,
			{ placeId: 1, personIds: [2, 1], startsOn: '2026-06-02', endsOn: '2026-06-03' },
			now
		);
		expect(second.id).toBe(first.id);
	});

	it('creates a new crossing when the participants differ, even at the same place and dates', async () => {
		const d = db();
		const a = await createCrossingFromSuggestion(d, { placeId: 1, personIds: [1, 2], startsOn: '2026-07-01', endsOn: '2026-07-02' }, now);
		const b = await createCrossingFromSuggestion(d, { placeId: 1, personIds: [1, 3], startsOn: '2026-07-01', endsOn: '2026-07-02' }, now);
		expect(b.id).not.toBe(a.id);
	});
});

describe('confirmCrossingParticipant', () => {
	it('confirms the given participant and returns true', async () => {
		const d = db();
		const crossing = await createCrossingFromSuggestion(
			d,
			{ placeId: 1, personIds: [1, 2], startsOn: '2026-08-01', endsOn: '2026-08-02' },
			now
		);
		const confirmed = await confirmCrossingParticipant(d, crossing.id, 1, now);
		expect(confirmed).toBe(true);

		const rows = await listCrossingsForPerson(d, 1);
		const row = rows.find((c) => c.id === crossing.id)!;
		expect(row.participants.find((p) => p.personId === 1)?.confirmed).toBe(true);
		expect(row.participants.find((p) => p.personId === 2)?.confirmed).toBe(false);
	});

	it('returns false, confirming nothing, when the person is not actually a participant', async () => {
		const d = db();
		const crossing = await createCrossingFromSuggestion(
			d,
			{ placeId: 1, personIds: [1, 2], startsOn: '2026-05-01', endsOn: '2026-05-02' },
			now
		);
		const confirmed = await confirmCrossingParticipant(d, crossing.id, 3, now);
		expect(confirmed).toBe(false);
	});
});
