import { env } from 'cloudflare:workers';
import { drizzle } from 'drizzle-orm/d1';
import { beforeAll, describe, expect, it } from 'vitest';
import { listMediaForPersonViewer, resolveViewerForPerson } from '../../src/db/queries';
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
		{ id: 3, slug: 'carla', displayName: 'Carla', role: 'scholar', createdAt: now }
	]);

	const base = {
		format: 'remark' as const,
		category: 'life' as const,
		originalLang: 'en' as const,
		title: 'Untitled',
		timezone: 'Europe/Copenhagen',
		createdAt: now,
		updatedAt: now
	};

	// Two insert calls, not one - D1's local emulator errors with "too many
	// SQL variables" on a single batch this wide across this many rows.
	await d.insert(schema.entries).values([
		{ ...base, id: 100, personId: 1, slug: 'l-public', status: 'published', audience: 'public', occurredAt: '2026-09-01T10:00:00.000Z' },
		{ ...base, id: 101, personId: 1, slug: 'l-family', status: 'published', audience: 'family', occurredAt: '2026-09-02T10:00:00.000Z' },
		{ ...base, id: 102, personId: 1, slug: 'l-private', status: 'published', audience: 'private', occurredAt: '2026-09-03T10:00:00.000Z' },
		{
			...base,
			id: 103,
			personId: 1,
			slug: 'l-delayed',
			status: 'published',
			audience: 'public',
			occurredAt: '2026-09-04T10:00:00.000Z',
			publishAfter: '2099-01-01T00:00:00.000Z'
		}
	]);
	await d.insert(schema.entries).values([
		{ ...base, id: 104, personId: 1, slug: 'l-draft', status: 'draft', audience: 'public', occurredAt: '2026-09-05T10:00:00.000Z' },
		{ ...base, id: 105, personId: 1, slug: 'l-clip', status: 'published', audience: 'public', occurredAt: '2026-09-06T10:00:00.000Z' },
		{ ...base, id: 200, personId: 2, slug: 'a-family', status: 'published', audience: 'family', occurredAt: '2026-09-01T10:00:00.000Z' }
	]);

	await d.insert(schema.media).values([
		{
			entryId: 100,
			ownerId: 1,
			kind: 'photo',
			keyThumb: 'l-pub-thumb.webp',
			keyDisplay: 'l-pub-display.webp',
			keyLarge: 'l-pub-large.webp',
			width: 1600,
			height: 1200,
			sha256: 'lucas-public-hash',
			exifJson: '{"gps":"should-never-appear"}',
			sortOrder: 0
		},
		{ entryId: 101, ownerId: 1, kind: 'photo', keyDisplay: 'l-fam-display.webp', width: 1600, height: 1200, sortOrder: 0 },
		{ entryId: 102, ownerId: 1, kind: 'photo', keyDisplay: 'l-priv-display.webp', width: 1600, height: 1200, sortOrder: 0 },
		{ entryId: 103, ownerId: 1, kind: 'photo', keyDisplay: 'l-delayed-display.webp', width: 1600, height: 1200, sortOrder: 0 }
	]);
	await d.insert(schema.media).values([
		{ entryId: 104, ownerId: 1, kind: 'photo', keyDisplay: 'l-draft-display.webp', width: 1600, height: 1200, sortOrder: 0 },
		// A clip on an otherwise-visible public entry - the slideshow is
		// photo-only, so this must never come back from a photo query even
		// though the entry itself is fully public.
		{ entryId: 105, ownerId: 1, kind: 'clip', keyDisplay: 'l-clip-display.mp4', sortOrder: 0 },
		{ entryId: 200, ownerId: 2, kind: 'photo', keyDisplay: 'a-fam-display.webp', width: 1600, height: 1200, sortOrder: 0 }
	]);

	await d.insert(schema.follows).values([{ email: 'approved@example.com', personId: 1, status: 'approved', createdAt: now }]);

	// A dedicated person for pagination, isolated from the privacy-boundary
	// fixtures above so offset/limit assertions don't depend on their count.
	const carlaEntries = Array.from({ length: 5 }, (_, i) => ({
		...base,
		id: 300 + i,
		personId: 3,
		slug: `carla-${i}`,
		status: 'published' as const,
		audience: 'public' as const,
		occurredAt: `2026-09-${String(10 + i).padStart(2, '0')}T10:00:00.000Z`
	}));
	await d.insert(schema.entries).values(carlaEntries.slice(0, 3));
	await d.insert(schema.entries).values(carlaEntries.slice(3));
	await d.insert(schema.media).values(
		carlaEntries.map((e) => ({ entryId: e.id, ownerId: 3, kind: 'photo' as const, keyDisplay: `carla-${e.id}.webp`, sortOrder: 0 }))
	);
});

describe('listMediaForPersonViewer - audience boundary', () => {
	it('a public viewer sees only the public, published, non-delayed photo', async () => {
		const page = await listMediaForPersonViewer(db(), 'public', 1, now);
		expect(page.items.map((i) => i.keyDisplay)).toEqual(['l-pub-display.webp']);
	});

	it('a family viewer sees the public and family photos, including a delayed public one', async () => {
		const page = await listMediaForPersonViewer(db(), 'family', 1, now);
		// Oldest first: public (09-01), family (09-02), delayed (09-04) - family
		// isn't gated by publish_after (src/db/queries.ts's own documented rule).
		expect(page.items.map((i) => i.keyDisplay)).toEqual(['l-pub-display.webp', 'l-fam-display.webp', 'l-delayed-display.webp']);
	});

	it('never returns the private entry\'s photo, to any public/family viewer', async () => {
		const publicPage = await listMediaForPersonViewer(db(), 'public', 1, now);
		const familyPage = await listMediaForPersonViewer(db(), 'family', 1, now);
		expect(publicPage.items.some((i) => i.keyDisplay === 'l-priv-display.webp')).toBe(false);
		expect(familyPage.items.some((i) => i.keyDisplay === 'l-priv-display.webp')).toBe(false);
	});

	it('never returns a draft entry\'s photo', async () => {
		const familyPage = await listMediaForPersonViewer(db(), 'family', 1, now);
		expect(familyPage.items.some((i) => i.keyDisplay === 'l-draft-display.webp')).toBe(false);
	});

	it('never returns a clip, even from a fully public entry - the slideshow is photos only', async () => {
		const familyPage = await listMediaForPersonViewer(db(), 'family', 1, now);
		expect(familyPage.items.some((i) => i.keyDisplay === 'l-clip-display.mp4')).toBe(false);
	});

	it('scopes strictly to the requested person - never mixes in another person\'s photos', async () => {
		const page = await listMediaForPersonViewer(db(), 'family', 1, now);
		expect(page.items.every((i) => ['l-pub-display.webp', 'l-fam-display.webp', 'l-delayed-display.webp'].includes(i.keyDisplay ?? ''))).toBe(
			true
		);
	});

	it('never includes private-only columns (exif, sha256, thumb key) on any returned row', async () => {
		const page = await listMediaForPersonViewer(db(), 'public', 1, now);
		for (const item of page.items) {
			expect(Object.keys(item).sort()).toEqual(
				['altText', 'caption', 'entryId', 'height', 'id', 'keyDisplay', 'keyLarge', 'occurredAt', 'width'].sort()
			);
		}
	});
});

describe('listMediaForPersonViewer + resolveViewerForPerson - end to end follower scoping', () => {
	it('an approved follower of Lucas sees his public and family photos through the real resolution path', async () => {
		const viewer = await resolveViewerForPerson(db(), 'approved@example.com', 1);
		const page = await listMediaForPersonViewer(db(), viewer, 1, now);
		expect(page.items.map((i) => i.keyDisplay)).toEqual(['l-pub-display.webp', 'l-fam-display.webp', 'l-delayed-display.webp']);
	});

	it("following Lucas is not following Anna - the same viewer gets only Anna's public photos (none, since hers is family-only)", async () => {
		const viewer = await resolveViewerForPerson(db(), 'approved@example.com', 2);
		expect(viewer).toBe('public');
		const page = await listMediaForPersonViewer(db(), viewer, 2, now);
		expect(page.items).toEqual([]);
	});

	it('an anonymous viewer gets nothing for a person whose only entry is family-only', async () => {
		const page = await listMediaForPersonViewer(db(), 'public', 2, now);
		expect(page.items).toEqual([]);
	});
});

describe('listMediaForPersonViewer - pagination', () => {
	it('pages through without ever exceeding the requested limit, and reports hasMore correctly', async () => {
		const first = await listMediaForPersonViewer(db(), 'public', 3, now, { offset: 0, limit: 2 });
		expect(first.items).toHaveLength(2);
		expect(first.hasMore).toBe(true);

		const second = await listMediaForPersonViewer(db(), 'public', 3, now, { offset: 2, limit: 2 });
		expect(second.items).toHaveLength(2);
		expect(second.hasMore).toBe(true);

		const third = await listMediaForPersonViewer(db(), 'public', 3, now, { offset: 4, limit: 2 });
		expect(third.items).toHaveLength(1);
		expect(third.hasMore).toBe(false);
	});

	it('an offset past the end returns an empty page, not an error', async () => {
		const page = await listMediaForPersonViewer(db(), 'public', 3, now, { offset: 999, limit: 10 });
		expect(page.items).toEqual([]);
		expect(page.hasMore).toBe(false);
	});

	it('never returns duplicate or skipped items across consecutive pages', async () => {
		const all = await listMediaForPersonViewer(db(), 'public', 3, now, { offset: 0, limit: 100 });
		const page1 = await listMediaForPersonViewer(db(), 'public', 3, now, { offset: 0, limit: 3 });
		const page2 = await listMediaForPersonViewer(db(), 'public', 3, now, { offset: 3, limit: 3 });
		expect([...page1.items, ...page2.items].map((i) => i.id)).toEqual(all.items.map((i) => i.id));
	});
});
