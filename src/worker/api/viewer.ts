import { env } from 'cloudflare:workers';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { LOGIN_CODE_EXPIRY_MINUTES } from '../../config/site';
import { getDb } from '../../db/client';
import { getPersonBySlug } from '../../db/queries';
import * as schema from '../../db/schema';
import { sendLoginCode } from '../email';
import { mintViewerSession, viewerSessionCookie } from '../viewerSession';

// Not Access-gated - these are for site visitors, not Lucas. Access stays
// studio-only per BUILD_PLAN.
export const viewerApi = new Hono();

async function hashCode(code: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
	return Array.from(new Uint8Array(digest))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

function generateCode(): string {
	return String(Math.floor(100000 + Math.random() * 900000));
}

const requestCodeSchema = z.object({ email: z.email(), lang: z.enum(['da', 'en']) });

viewerApi.post('/request-code', async (c) => {
	if (!env.RESEND_API_KEY) return c.json({ error: 'Email sending is not configured yet' }, 503);

	const parsed = requestCodeSchema.safeParse(await c.req.json());
	if (!parsed.success) return c.json({ error: z.flattenError(parsed.error) }, 400);
	const { email, lang } = parsed.data;

	const db = getDb();
	const now = new Date();
	const nowIso = now.toISOString();

	// A code requested in the last minute is still usable - avoids spamming
	// an inbox on an accidental double click rather than real rate limiting.
	const recent = await db
		.select({ id: schema.loginCodes.id })
		.from(schema.loginCodes)
		.where(
			and(
				eq(schema.loginCodes.email, email),
				isNull(schema.loginCodes.consumedAt),
				gt(schema.loginCodes.createdAt, new Date(now.getTime() - 60_000).toISOString())
			)
		)
		.limit(1);
	if (recent.length > 0) return c.json({ ok: true });

	const code = generateCode();
	const codeHash = await hashCode(code);
	const expiresAt = new Date(now.getTime() + LOGIN_CODE_EXPIRY_MINUTES * 60 * 1000).toISOString();

	await db.insert(schema.loginCodes).values({ email, codeHash, expiresAt, createdAt: nowIso });

	const sent = await sendLoginCode({ lang, email, code }, env.RESEND_API_KEY);
	if (!sent) return c.json({ error: 'Could not send the email' }, 502);

	return c.json({ ok: true });
});

const verifyCodeSchema = z.object({ email: z.email(), code: z.string().length(6) });

viewerApi.post('/verify-code', async (c) => {
	if (!env.VIEWER_SESSION_SECRET) return c.json({ error: 'Login is not configured yet' }, 503);

	const parsed = verifyCodeSchema.safeParse(await c.req.json());
	if (!parsed.success) return c.json({ error: z.flattenError(parsed.error) }, 400);
	const { email, code } = parsed.data;

	const codeHash = await hashCode(code);
	const nowIso = new Date().toISOString();

	const db = getDb();
	const rows = await db
		.select()
		.from(schema.loginCodes)
		.where(and(eq(schema.loginCodes.email, email), eq(schema.loginCodes.codeHash, codeHash), isNull(schema.loginCodes.consumedAt)))
		.orderBy(desc(schema.loginCodes.id))
		.limit(1);

	const row = rows[0];
	if (!row || row.expiresAt < nowIso) return c.json({ error: 'Invalid or expired code' }, 400);

	await db.update(schema.loginCodes).set({ consumedAt: nowIso }).where(eq(schema.loginCodes.id, row.id));

	const token = await mintViewerSession(email, env.VIEWER_SESSION_SECRET);
	c.header('Set-Cookie', viewerSessionCookie(token));
	return c.json({ ok: true });
});

const followSchema = z.object({ email: z.email(), personSlug: z.string().min(1) });

viewerApi.post('/follow', async (c) => {
	const parsed = followSchema.safeParse(await c.req.json());
	if (!parsed.success) return c.json({ error: z.flattenError(parsed.error) }, 400);
	const { email, personSlug } = parsed.data;

	const db = getDb();
	const person = await getPersonBySlug(db, 'public', personSlug);
	if (!person) return c.json({ error: 'Not found' }, 404);

	const now = new Date().toISOString();
	const existing = await db
		.select()
		.from(schema.follows)
		.where(and(eq(schema.follows.email, email), eq(schema.follows.personId, person.id)))
		.limit(1);

	if (existing.length === 0) {
		await db.insert(schema.follows).values({ email, personId: person.id, status: 'pending', createdAt: now });
	} else if (existing[0].status === 'revoked') {
		// Approved stays approved, pending stays pending - only a lapsed
		// follow can ask again.
		await db.update(schema.follows).set({ status: 'pending' }).where(eq(schema.follows.id, existing[0].id));
	}

	return c.json({ ok: true });
});
