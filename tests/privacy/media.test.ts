import { env } from 'cloudflare:workers';
import { drizzle } from 'drizzle-orm/d1';
import { beforeAll, describe, expect, it } from 'vitest';
import { findMediaByKeyWithEntry, findMediaBySha256ForOwner } from '../../src/db/queries';
import * as schema from '../../src/db/schema';
import { isEntryVisible, type Viewer } from '../../src/lib/visibility';

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

	// A second set of entries, one per audience/status/delay combination the
	// public /api/media route (src/worker/api/media.ts) has to get right -
	// each with a distinctly-keyed photo so a lookup by key alone proves
	// which entry's visibility rules actually governed it.
	await d.insert(schema.entries).values([
		{ ...base, id: 10, personId: 1, status: 'published', audience: 'public', slug: 'public-entry' },
		{ ...base, id: 11, personId: 1, status: 'published', audience: 'family', slug: 'family-entry' },
		{ ...base, id: 12, personId: 1, status: 'draft', audience: 'public', slug: 'draft-entry' },
		{
			...base,
			id: 13,
			personId: 1,
			status: 'published',
			audience: 'public',
			publishAfter: '2099-01-01T00:00:00.000Z',
			slug: 'delayed-entry'
		}
	]);
	await d.insert(schema.media).values([
		{ entryId: 10, ownerId: 1, kind: 'photo', keyThumb: 'pub.webp', sortOrder: 0 },
		{ entryId: 11, ownerId: 1, kind: 'photo', keyThumb: 'fam.webp', sortOrder: 0 },
		{ entryId: 12, ownerId: 1, kind: 'photo', keyThumb: 'draft.webp', sortOrder: 0 },
		{ entryId: 13, ownerId: 1, kind: 'photo', keyThumb: 'delayed.webp', sortOrder: 0 },
		// Matches on keyLarge, not keyThumb - proves the lookup isn't only
		// checking the one column every other test here happens to use.
		{ entryId: 10, ownerId: 1, kind: 'photo', keyLarge: 'pub-large.webp', sortOrder: 1 }
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

describe('findMediaByKeyWithEntry', () => {
	it('matches on keyThumb', async () => {
		expect((await findMediaByKeyWithEntry(db(), 'pub.webp'))?.entryId).toBe(10);
	});

	it('also matches on keyLarge, not just keyThumb', async () => {
		expect((await findMediaByKeyWithEntry(db(), 'pub-large.webp'))?.entryId).toBe(10);
	});

	it('returns undefined for a key nothing was ever committed under - never throws, never guesses', async () => {
		expect(await findMediaByKeyWithEntry(db(), 'never-uploaded.webp')).toBeUndefined();
	});

	it('does not itself filter by visibility - returns a draft\'s media row too', async () => {
		// The /api/media route's own job, not this query's - see its doc comment.
		expect((await findMediaByKeyWithEntry(db(), 'draft.webp'))?.status).toBe('draft');
	});
});

describe('the /api/media route\'s full guarantee (findMediaByKeyWithEntry + isEntryVisible together)', () => {
	async function visibleTo(key: string, viewer: Viewer): Promise<boolean> {
		const row = await findMediaByKeyWithEntry(db(), key);
		if (!row) return false;
		return isEntryVisible(row, viewer, now);
	}

	it('a public entry\'s photo is visible to everyone', async () => {
		expect(await visibleTo('pub.webp', 'public')).toBe(true);
		expect(await visibleTo('pub.webp', 'family')).toBe(true);
		expect(await visibleTo('pub.webp', 'studio')).toBe(true);
	});

	it('a family-only entry\'s photo is never visible to a public viewer', async () => {
		expect(await visibleTo('fam.webp', 'public')).toBe(false);
		expect(await visibleTo('fam.webp', 'family')).toBe(true);
	});

	it('an unpublished draft\'s photo is never visible outside studio, even with its exact key guessed', async () => {
		expect(await visibleTo('draft.webp', 'public')).toBe(false);
		expect(await visibleTo('draft.webp', 'family')).toBe(false);
		expect(await visibleTo('draft.webp', 'studio')).toBe(true);
	});

	it('a delayed public entry\'s photo is held back from public until publish_after, but not from family', async () => {
		expect(await visibleTo('delayed.webp', 'public')).toBe(false);
		expect(await visibleTo('delayed.webp', 'family')).toBe(true);
	});

	it('a guessed key that was never uploaded is simply not found - no row to even ask isEntryVisible about', async () => {
		expect(await visibleTo('never-uploaded.webp', 'studio')).toBe(false);
	});
});
