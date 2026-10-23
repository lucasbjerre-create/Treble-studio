import { env } from 'cloudflare:workers';
import { drizzle } from 'drizzle-orm/d1';
import { beforeAll, describe, expect, it } from 'vitest';
import { getEntryBySlugForViewer, listEntriesForViewer } from '../../src/db/queries';
import * as schema from '../../src/db/schema';

const now = '2026-10-23T12:00:00.000Z';
const past = '2026-10-01T00:00:00.000Z';
const future = '2026-11-01T00:00:00.000Z';

function db() {
	return drizzle(env.DB, { schema });
}

beforeAll(async () => {
	const d = db();
	await d.insert(schema.people).values({
		slug: 'lucas',
		displayName: 'Lucas',
		role: 'scholar',
		createdAt: now
	});

	const base = {
		personId: 1,
		format: 'remark' as const,
		category: 'life' as const,
		originalLang: 'en' as const,
		title: 'Untitled',
		occurredAt: now,
		timezone: 'Europe/Copenhagen',
		createdAt: now,
		updatedAt: now
	};

	await d.insert(schema.entries).values([
		{ ...base, slug: 'private-draft', status: 'draft', audience: 'private' },
		{ ...base, slug: 'family-only', status: 'published', audience: 'family', publishedAt: now },
		{
			...base,
			slug: 'public-delayed',
			status: 'published',
			audience: 'public',
			publishAfter: future,
			publishedAt: now
		},
		{
			...base,
			slug: 'public-eligible',
			status: 'published',
			audience: 'public',
			publishAfter: past,
			publishedAt: now
		}
	]);
});

describe('listEntriesForViewer', () => {
	it('public viewer sees exactly the one eligible entry', async () => {
		const rows = await listEntriesForViewer(db(), 'public', now);
		expect(rows.map((r) => r.slug)).toEqual(['public-eligible']);
	});

	it('family viewer sees family and public entries, ignoring the delay', async () => {
		const rows = await listEntriesForViewer(db(), 'family', now);
		expect(rows.map((r) => r.slug).sort()).toEqual(
			['family-only', 'public-delayed', 'public-eligible'].sort()
		);
	});

	it('studio viewer sees everything, including the private draft', async () => {
		const rows = await listEntriesForViewer(db(), 'studio', now);
		expect(rows.map((r) => r.slug).sort()).toEqual(
			['private-draft', 'family-only', 'public-delayed', 'public-eligible'].sort()
		);
	});
});

describe('getEntryBySlugForViewer', () => {
	it('public cannot fetch a private draft by slug', async () => {
		const row = await getEntryBySlugForViewer(db(), 'public', 'lucas', 'private-draft', now);
		expect(row).toBeUndefined();
	});

	it('studio can fetch the private draft by slug', async () => {
		const row = await getEntryBySlugForViewer(db(), 'studio', 'lucas', 'private-draft', now);
		expect(row?.slug).toBe('private-draft');
	});
});
