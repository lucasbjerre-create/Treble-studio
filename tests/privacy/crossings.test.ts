import { env } from 'cloudflare:workers';
import { drizzle } from 'drizzle-orm/d1';
import { beforeAll, describe, expect, it } from 'vitest';
import { listConfirmedCrossingsForViewer, listEntriesForCrossing, type Viewer } from '../../src/db/queries';
import * as schema from '../../src/db/schema';

const now = '2026-10-23T12:00:00.000Z';

function db() {
	return drizzle(env.DB, { schema });
}

/** Builds the per-participant viewer map listConfirmedCrossingsForViewer/listEntriesForCrossing now take. */
function viewers(entries: [number, Viewer][]): Map<number, Viewer> {
	return new Map(entries);
}

const crossingA = { id: 1, placeId: 1, startsOn: '2026-09-19', endsOn: '2026-09-20', personIds: [1, 2] };
const crossingC = { id: 3, placeId: 1, startsOn: '2026-06-01', endsOn: '2026-06-02', personIds: [1, 2] };

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

	// Crossing C: fully confirmed, both participants' entries in that window
	// are family-only - used both for the "neither visible to public" case
	// and the per-person-family gap case below (a viewer who follows only
	// one of the two participants).
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
		const rows = await listConfirmedCrossingsForViewer(db(), viewers([[1, 'public'], [2, 'public']]), now);
		expect(rows.map((r) => r.id)).toEqual([1]);
	});

	it('never returns the crossing where one participant has not confirmed', async () => {
		const rows = await listConfirmedCrossingsForViewer(db(), viewers([[1, 'public'], [2, 'public']]), now);
		expect(rows.some((r) => r.id === 2)).toBe(false);
	});

	it('never returns a confirmed crossing to a public viewer when neither participant has a visible entry in it', async () => {
		const rows = await listConfirmedCrossingsForViewer(db(), viewers([[1, 'public'], [2, 'public']]), now);
		expect(rows.some((r) => r.id === 3)).toBe(false);
	});

	it('a viewer who is family for both participants does see that same crossing', async () => {
		const rows = await listConfirmedCrossingsForViewer(db(), viewers([[1, 'family'], [2, 'family']]), now);
		expect(rows.some((r) => r.id === 3)).toBe(true);
	});

	it('a viewer who follows only one participant still sees the crossing, since that one participant has a visible entry', async () => {
		const rows = await listConfirmedCrossingsForViewer(db(), viewers([[1, 'family'], [2, 'public']]), now);
		expect(rows.some((r) => r.id === 3)).toBe(true);
	});

	it('opts.personId narrows the crossing list to ones that participant is actually in', async () => {
		const rows = await listConfirmedCrossingsForViewer(db(), viewers([[1, 'family'], [2, 'family']]), now, { personId: 1 });
		expect(rows.map((r) => r.id).sort()).toEqual([1, 3]);
	});
});

describe('listEntriesForCrossing', () => {
	it('a public viewer sees only the public participant entry, never the family-only one', async () => {
		const rows = await listEntriesForCrossing(db(), viewers([[1, 'public'], [2, 'public']]), crossingA, now);
		expect(rows.map((r) => r.slug)).toEqual(['lucas-crossing-entry']);
	});

	it('a viewer who is family for both participants sees both entries for the same crossing', async () => {
		const rows = await listEntriesForCrossing(db(), viewers([[1, 'family'], [2, 'family']]), crossingA, now);
		expect(rows.map((r) => r.slug).sort()).toEqual(['anna-crossing-entry', 'lucas-crossing-entry']);
	});

	it('the per-person-family gap: a viewer who follows only person 1 sees only person 1s family entry, never person 2s', async () => {
		const rows = await listEntriesForCrossing(db(), viewers([[1, 'family'], [2, 'public']]), crossingC, now);
		expect(rows.map((r) => r.slug)).toEqual(['lucas-family-only-crossing-entry']);
	});

	it('a participant missing from the map is treated as public, not leaked as family', async () => {
		const rows = await listEntriesForCrossing(db(), viewers([[1, 'family']]), crossingC, now);
		expect(rows.map((r) => r.slug)).toEqual(['lucas-family-only-crossing-entry']);
	});
});
