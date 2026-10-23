import { env } from 'cloudflare:workers';
import { drizzle } from 'drizzle-orm/d1';
import { beforeAll, describe, expect, it } from 'vitest';
import { listPlacesForViewer } from '../../src/db/queries';
import * as schema from '../../src/db/schema';

function db() {
	return drizzle(env.DB, { schema });
}

beforeAll(async () => {
	await db()
		.insert(schema.places)
		.values({
			label: 'Chapel Hill',
			countryCode: 'US',
			latPrivate: 35.9132,
			lonPrivate: -79.0558,
			latPublic: 35.9,
			lonPublic: -79.05,
			precision: 'city'
		});
});

describe('listPlacesForViewer', () => {
	it('never includes private coordinates for public or family viewers', async () => {
		const [publicRow] = await listPlacesForViewer(db(), 'public');
		const [familyRow] = await listPlacesForViewer(db(), 'family');

		expect(publicRow).not.toHaveProperty('latPrivate');
		expect(publicRow).not.toHaveProperty('lonPrivate');
		expect(familyRow).not.toHaveProperty('latPrivate');
		expect(familyRow).not.toHaveProperty('lonPrivate');

		expect(publicRow.latPublic).toBeCloseTo(35.9);
		expect(publicRow.lonPublic).toBeCloseTo(-79.05);
	});

	it('studio sees the private coordinates too', async () => {
		// listPlacesForViewer's return type is the union of both column sets
		// (the function isn't overloaded per literal viewer), so the full-row
		// shape needs asserting here even though it's correct at runtime.
		const [row] = (await listPlacesForViewer(db(), 'studio')) as Array<typeof schema.places.$inferSelect>;
		expect(row?.latPrivate).toBeCloseTo(35.9132);
		expect(row?.lonPrivate).toBeCloseTo(-79.0558);
	});
});
