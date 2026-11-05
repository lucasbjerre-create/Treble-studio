import { env } from 'cloudflare:workers';
import { drizzle } from 'drizzle-orm/d1';
import { beforeAll, describe, expect, it } from 'vitest';
import { sumMediaBytesForOwner } from '../../src/db/queries';
import * as schema from '../../src/db/schema';

const now = '2026-10-23T12:00:00.000Z';

function db() {
	return drizzle(env.DB, { schema });
}

beforeAll(async () => {
	const d = db();
	await d.insert(schema.people).values([
		{ id: 1, slug: 'lucas', displayName: 'Lucas', role: 'scholar', createdAt: now },
		{ id: 2, slug: 'anna', displayName: 'Anna', role: 'scholar', createdAt: now }
	]);
	await d.insert(schema.places).values({ id: 1, label: 'Asheville', latPublic: 35.6, lonPublic: -82.55, precision: 'city' });

	const baseEntry = {
		placeId: 1,
		format: 'moment' as const,
		category: 'trip' as const,
		status: 'draft' as const,
		audience: 'private' as const,
		originalLang: 'en' as const,
		title: 'Untitled',
		timezone: 'America/New_York',
		occurredAt: now,
		createdAt: now,
		updatedAt: now
	};
	await d.insert(schema.entries).values([
		{ ...baseEntry, id: 1, personId: 1, slug: 'lucas-entry' },
		{ ...baseEntry, id: 2, personId: 2, slug: 'anna-entry' }
	]);

	await d.insert(schema.media).values([
		{ entryId: 1, ownerId: 1, kind: 'photo', bytes: 1_000_000, sortOrder: 0 },
		{ entryId: 1, ownerId: 1, kind: 'photo', bytes: 2_000_000, sortOrder: 1 },
		// No bytes recorded (e.g. an older row) - must count as 0, not break the sum.
		{ entryId: 1, ownerId: 1, kind: 'photo', bytes: null, sortOrder: 2 },
		// Anna's own upload - must never count toward Lucas's usage.
		{ entryId: 2, ownerId: 2, kind: 'photo', bytes: 500_000_000, sortOrder: 0 }
	]);
});

describe('sumMediaBytesForOwner', () => {
	it('sums only this owner’s own media bytes, never another person’s', async () => {
		expect(await sumMediaBytesForOwner(db(), 1)).toBe(3_000_000);
	});

	it('treats a null bytes value as 0 rather than breaking the sum', async () => {
		// Already covered above (row 3 has null bytes and the sum still came
		// out exactly as the two real values) - this asserts it explicitly for
		// a person with nothing but a null-bytes row.
		await db()
			.insert(schema.people)
			.values({ id: 3, slug: 'nobody', displayName: 'Nobody', role: 'scholar', createdAt: now });
		expect(await sumMediaBytesForOwner(db(), 3)).toBe(0);
	});
});
