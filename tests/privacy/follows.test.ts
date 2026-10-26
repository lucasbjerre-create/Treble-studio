import { env } from 'cloudflare:workers';
import { drizzle } from 'drizzle-orm/d1';
import { beforeAll, describe, expect, it } from 'vitest';
import { listEntriesForViewer, resolveViewerForPerson } from '../../src/db/queries';
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
		status: 'published' as const,
		audience: 'family' as const,
		publishedAt: now,
		createdAt: now,
		updatedAt: now
	};

	await d.insert(schema.entries).values([
		{ ...base, personId: 1, slug: 'lucas-family-entry' },
		{ ...base, personId: 2, slug: 'anna-family-entry' }
	]);

	await d.insert(schema.follows).values([
		{ email: 'approved@example.com', personId: 1, status: 'approved', createdAt: now },
		{ email: 'pending@example.com', personId: 1, status: 'pending', createdAt: now },
		{ email: 'revoked@example.com', personId: 1, status: 'revoked', createdAt: now }
	]);
});

describe('resolveViewerForPerson', () => {
	it('an approved follower of this person resolves to family', async () => {
		const viewer = await resolveViewerForPerson(db(), 'approved@example.com', 1);
		expect(viewer).toBe('family');
	});

	it('an approved follower of a different person stays public - following one person is not following another', async () => {
		const viewer = await resolveViewerForPerson(db(), 'approved@example.com', 2);
		expect(viewer).toBe('public');
	});

	it('a pending request grants nothing yet', async () => {
		const viewer = await resolveViewerForPerson(db(), 'pending@example.com', 1);
		expect(viewer).toBe('public');
	});

	it('a revoked follow grants nothing', async () => {
		const viewer = await resolveViewerForPerson(db(), 'revoked@example.com', 1);
		expect(viewer).toBe('public');
	});

	it('no session (null email) resolves to public', async () => {
		const viewer = await resolveViewerForPerson(db(), null, 1);
		expect(viewer).toBe('public');
	});
});

describe('end to end: an approved follower sees only the person they follow', () => {
	it("sees Lucas's family entry once resolved as 'family' for Lucas", async () => {
		const viewer = await resolveViewerForPerson(db(), 'approved@example.com', 1);
		const rows = await listEntriesForViewer(db(), viewer, now, { personId: 1 });
		expect(rows.map((r) => r.slug)).toEqual(['lucas-family-entry']);
	});

	it("does not see Anna's family entry without a separate approved follow for Anna", async () => {
		const viewer = await resolveViewerForPerson(db(), 'approved@example.com', 2);
		const rows = await listEntriesForViewer(db(), viewer, now, { personId: 2 });
		expect(rows).toEqual([]);
	});
});
