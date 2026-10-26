import { env } from 'cloudflare:workers';
import { drizzle } from 'drizzle-orm/d1';
import { beforeAll, describe, expect, it } from 'vitest';
import { listConfirmedCrossingsForViewer, listEntriesForCrossing } from '../../src/db/queries';
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
	await d.insert(schema.places).values({
		id: 1,
		label: 'Asheville',
		latPublic: 35.6,
		lonPublic: -82.55,
		precision: 'city'
	});

	const baseEntry = {
		placeId: 1,
		format: 'moment' as const,
		category: 'trip' as const,
		originalLang: 'en' as const,
		title: 'Untitled',
		timezone: 'America/New_York',
		createdAt: now,
		updatedAt: now
	};
	await d.insert(schema.entries).values([
		// Lucas's entry in the crossing window is public and eligible.
		{
			...baseEntry,
			id: 1,
			personId: 1,
			slug: 'lucas-crossing-entry',
			status: 'published',
			audience: 'public',
			occurredAt: '2026-09-19T20:00:00.000Z',
			publishAfter: '2026-09-20T00:00:00.000Z',
			publishedAt: now
		},
		// Anna's entry in the SAME window is family-only.
		{
			...baseEntry,
			id: 2,
			personId: 2,
			slug: 'anna-crossing-entry',
			status: 'published',
			audience: 'family',
			occurredAt: '2026-09-19T21:00:00.000Z',
			publishedAt: now
		}
	]);

	// Crossing A: both participants confirmed - should be visible.
	await d.insert(schema.crossings).values({
		id: 1,
		placeId: 1,
		startsOn: '2026-09-19',
		endsOn: '2026-09-20',
		createdAt: now
	});
	await d.insert(schema.crossingParticipants).values([
		{ crossingId: 1, personId: 1, confirmed: true, confirmedAt: now },
		{ crossingId: 1, personId: 2, confirmed: true, confirmedAt: now }
	]);

	// Crossing B: only one of the two participants has confirmed - must never
	// be returned to anyone (the whole point of this test file).
	await d.insert(schema.crossings).values({
		id: 2,
		placeId: 1,
		startsOn: '2026-07-01',
		endsOn: '2026-07-02',
		createdAt: now
	});
	await d.insert(schema.crossingParticipants).values([
		{ crossingId: 2, personId: 1, confirmed: true, confirmedAt: now },
		{ crossingId: 2, personId: 2, confirmed: false }
	]);

	// Crossing C: fully confirmed, but neither participant has any entry in
	// that window a public viewer could see (both family-only) - the
	// crossing's own metadata (that these two people were in this place on
	// these dates) must not leak to a public viewer just because it's
	// confirmed, even though no single entry's content leaks either.
	await d.insert(schema.entries).values([
		{
			...baseEntry,
			id: 3,
			personId: 1,
			slug: 'lucas-family-only-crossing-entry',
			status: 'published',
			audience: 'family',
			occurredAt: '2026-06-01T10:00:00.000Z',
			publishedAt: now
		},
		{
			...baseEntry,
			id: 4,
			personId: 2,
			slug: 'anna-family-only-crossing-entry',
			status: 'published',
			audience: 'family',
			occurredAt: '2026-06-01T11:00:00.000Z',
			publishedAt: now
		}
	]);
	await d.insert(schema.crossings).values({
		id: 3,
		placeId: 1,
		startsOn: '2026-06-01',
		endsOn: '2026-06-02',
		createdAt: now
	});
	await d.insert(schema.crossingParticipants).values([
		{ crossingId: 3, personId: 1, confirmed: true, confirmedAt: now },
		{ crossingId: 3, personId: 2, confirmed: true, confirmedAt: now }
	]);
});

describe('listConfirmedCrossingsForViewer', () => {
	it('returns the fully-confirmed crossing that has a public entry in it, to a public viewer', async () => {
		const rows = await listConfirmedCrossingsForViewer(db(), 'public', now);
		expect(rows.map((r) => r.id)).toEqual([1]);
	});

	it('never returns the crossing where one participant has not confirmed', async () => {
		const rows = await listConfirmedCrossingsForViewer(db(), 'public', now);
		expect(rows.some((r) => r.id === 2)).toBe(false);
	});

	it('never returns a confirmed crossing to a public viewer when neither participant has a visible entry in it', async () => {
		const rows = await listConfirmedCrossingsForViewer(db(), 'public', now);
		expect(rows.some((r) => r.id === 3)).toBe(false);
	});

	it('a family viewer does see that same crossing, since both participants entries are family-visible', async () => {
		const rows = await listConfirmedCrossingsForViewer(db(), 'family', now);
		expect(rows.some((r) => r.id === 3)).toBe(true);
	});

	it('studio sees every confirmed crossing regardless of entry visibility', async () => {
		const rows = await listConfirmedCrossingsForViewer(db(), 'studio', now);
		expect(rows.map((r) => r.id).sort()).toEqual([1, 3]);
	});
});

describe('listEntriesForCrossing', () => {
	it('a public viewer sees only the public participant entry, never the family-only one', async () => {
		const crossings = await listConfirmedCrossingsForViewer(db(), 'studio', now);
		const crossing = crossings.find((c) => c.id === 1)!;
		const rows = await listEntriesForCrossing(db(), 'public', crossing, now);
		expect(rows.map((r) => r.slug)).toEqual(['lucas-crossing-entry']);
	});

	it('a family viewer sees both participants entries for the same crossing', async () => {
		const crossings = await listConfirmedCrossingsForViewer(db(), 'studio', now);
		const crossing = crossings.find((c) => c.id === 1)!;
		const rows = await listEntriesForCrossing(db(), 'family', crossing, now);
		expect(rows.map((r) => r.slug).sort()).toEqual(['anna-crossing-entry', 'lucas-crossing-entry']);
	});
});
