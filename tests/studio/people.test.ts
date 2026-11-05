import { env } from 'cloudflare:workers';
import { drizzle } from 'drizzle-orm/d1';
import { beforeAll, describe, expect, it } from 'vitest';
import { personSlugOrEmailInUse } from '../../src/db/queries';
import * as schema from '../../src/db/schema';

const now = '2026-10-23T12:00:00.000Z';

function db() {
	return drizzle(env.DB, { schema });
}

beforeAll(async () => {
	await db()
		.insert(schema.people)
		.values({ id: 1, slug: 'lucas', displayName: 'Lucas', email: 'lucas@example.com', role: 'scholar', createdAt: now });
});

describe('personSlugOrEmailInUse', () => {
	it('is true for an already-used slug, even with a new email', async () => {
		expect(await personSlugOrEmailInUse(db(), 'lucas', 'someone-new@example.com')).toBe(true);
	});

	it('is true for an already-used email, even with a new slug - people.email has no DB-level unique constraint, so this is the only thing guarding it', async () => {
		expect(await personSlugOrEmailInUse(db(), 'someone-new', 'lucas@example.com')).toBe(true);
	});

	it('is false when neither the slug nor the email is already in use', async () => {
		expect(await personSlugOrEmailInUse(db(), 'anna', 'anna@example.com')).toBe(false);
	});
});
