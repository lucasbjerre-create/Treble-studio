import { env } from 'cloudflare:workers';
import { drizzle } from 'drizzle-orm/d1';
import { beforeAll, describe, expect, it } from 'vitest';
import { findMediaBySha256ForOwner } from '../../src/db/queries';
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

	const base = {
		format: 'remark' as const,
		category: 'life' as const,
		originalLang: 'en' as const,
		title: 'Untitled',
		occurredAt: now,
		timezone: 'Europe/Copenhagen',
		status: 'draft' as const,
		audience: 'family' as const,
		createdAt: now,
		updatedAt: now
	};

	await d.insert(schema.entries).values([
		{ ...base, id: 1, personId: 1, slug: 'lucas-entry' },
		{ ...base, id: 2, personId: 2, slug: 'anna-entry' }
	]);

	await d.insert(schema.media).values([
		{ entryId: 1, ownerId: 1, kind: 'photo', sha256: 'shared-hash', sortOrder: 0 },
		{ entryId: 2, ownerId: 2, kind: 'photo', sha256: 'shared-hash', sortOrder: 0 }
	]);
});

describe('findMediaBySha256ForOwner', () => {
	it('bulk upload dedup never leaks a match across owners, even for the same hash', async () => {
		const forLucas = await findMediaBySha256ForOwner(db(), 1, 'shared-hash');
		expect(forLucas?.entryId).toBe(1);

		const forAnna = await findMediaBySha256ForOwner(db(), 2, 'shared-hash');
		expect(forAnna?.entryId).toBe(2);
	});

	it('returns undefined when this owner has no media with that hash', async () => {
		const row = await findMediaBySha256ForOwner(db(), 1, 'never-uploaded');
		expect(row).toBeUndefined();
	});
});
