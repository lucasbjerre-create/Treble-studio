import { env } from 'cloudflare:workers';
import { drizzle } from 'drizzle-orm/d1';
import { beforeAll, describe, expect, it } from 'vitest';
import { listLegsForViewer } from '../../src/db/queries';
import * as schema from '../../src/db/schema';

const now = '2026-10-23T12:00:00.000Z';
const past = '2026-10-01T00:00:00.000Z';
const future = '2026-11-01T00:00:00.000Z';

function db() {
	return drizzle(env.DB, { schema });
}

beforeAll(async () => {
	const d = db();
	await d.insert(schema.people).values({ slug: 'lucas', displayName: 'Lucas', role: 'scholar', createdAt: now });
	await d.insert(schema.trips).values({ personId: 1, title: 'Trip', startsOn: '2026-10-01' });
	await d.insert(schema.places).values([
		{ label: 'Copenhagen', precision: 'city' },
		{ label: 'Chapel Hill', precision: 'city' }
	]);
	await d.insert(schema.legs).values([
		{ tripId: 1, personId: 1, fromPlaceId: 1, toPlaceId: 2, startsAt: past, mode: 'flight' },
		{ tripId: 1, personId: 1, fromPlaceId: 2, toPlaceId: 1, startsAt: future, mode: 'flight' }
	]);
});

describe('listLegsForViewer', () => {
	it('hides a future-dated leg from public and family viewers', async () => {
		const publicLegs = await listLegsForViewer(db(), 'public', now);
		const familyLegs = await listLegsForViewer(db(), 'family', now);

		expect(publicLegs).toHaveLength(1);
		expect(familyLegs).toHaveLength(1);
		expect(publicLegs[0]?.startsAt).toBe(past);
	});

	it('studio sees both legs, including the future one', async () => {
		const legs = await listLegsForViewer(db(), 'studio', now);
		expect(legs).toHaveLength(2);
	});
});
