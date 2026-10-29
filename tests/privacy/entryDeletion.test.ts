import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { beforeAll, describe, expect, it } from 'vitest';
import { sweepStaleDrafts } from '../../src/worker/entryDeletion';
import * as schema from '../../src/db/schema';

// DRAFT_EXPIRY_DAYS is 8 (src/config/site.ts) - comfortably past that, and
// comfortably not.
const now = '2026-10-23T12:00:00.000Z';
const longAgo = '2026-01-01T00:00:00.000Z';
const recently = '2026-10-20T00:00:00.000Z';

function db() {
	return drizzle(env.DB, { schema });
}

async function entryExists(id: number): Promise<boolean> {
	const rows = await db().select({ id: schema.entries.id }).from(schema.entries).where(eq(schema.entries.id, id));
	return rows.length > 0;
}

// D1 state persists across every `it` in this file (isolated per file, not
// per test) - beforeAll, once, with each test below using its own unique
// entry id and checking only that id's fate, so the tests don't step on
// each other.
beforeAll(async () => {
	const d = db();
	await d.insert(schema.people).values([
		{ id: 1, slug: 'lucas', displayName: 'Lucas', role: 'scholar', createdAt: now },
		{ id: 2, slug: 'anna', displayName: 'Anna', role: 'scholar', createdAt: now }
	]);
});

const base = {
	personId: 1,
	format: 'remark' as const,
	category: 'life' as const,
	originalLang: 'en' as const,
	title: 'Untitled',
	occurredAt: longAgo,
	timezone: 'Europe/Copenhagen',
	audience: 'public' as const,
	updatedAt: now
};

describe('sweepStaleDrafts', () => {
	it('deletes a genuinely abandoned draft - never published, old enough', async () => {
		const d = db();
		await d.insert(schema.entries).values({ ...base, id: 1, slug: 'abandoned', status: 'draft', createdAt: longAgo });

		const count = await sweepStaleDrafts(d, 1, now);

		expect(count).toBe(1);
		expect(await entryExists(1)).toBe(false);
	});

	it('leaves a recent draft alone - not old enough yet', async () => {
		const d = db();
		await d.insert(schema.entries).values({ ...base, id: 2, slug: 'fresh', status: 'draft', createdAt: recently });

		const count = await sweepStaleDrafts(d, 1, now);

		expect(count).toBe(0);
		expect(await entryExists(2)).toBe(true);
	});

	it(
		'never deletes an entry that was ever published, even once unpublished back to draft with an old createdAt - ' +
			'the exact near-miss this test exists for: unpublishing an old, real entry must not expose it to the next sweep',
		async () => {
			const d = db();
			await d.insert(schema.entries).values({
				...base,
				id: 3,
				slug: 'unpublished-old-entry',
				status: 'draft', // taken back to draft by /unpublish
				createdAt: longAgo, // untouched by /unpublish, correctly - this is really old
				publishedAt: '2026-01-02T00:00:00.000Z' // left as-is by /unpublish, not cleared - this is the signal
			});

			const count = await sweepStaleDrafts(d, 1, now);

			expect(count).toBe(0);
			expect(await entryExists(3)).toBe(true);
		}
	);

	it('never touches a still-published entry, regardless of age', async () => {
		const d = db();
		await d.insert(schema.entries).values({
			...base,
			id: 4,
			slug: 'still-live',
			status: 'published',
			createdAt: longAgo,
			publishedAt: longAgo
		});

		const count = await sweepStaleDrafts(d, 1, now);

		expect(count).toBe(0);
		expect(await entryExists(4)).toBe(true);
	});

	it("never sweeps a different person's stale draft", async () => {
		const d = db();
		await d
			.insert(schema.entries)
			.values({ ...base, id: 5, personId: 2, slug: 'annas-draft', status: 'draft', createdAt: longAgo });

		const count = await sweepStaleDrafts(d, 1, now);

		expect(count).toBe(0);
		expect(await entryExists(5)).toBe(true);
	});
});
