import { AwsClient } from 'aws4fetch';
import { env } from 'cloudflare:workers';
import { and, count, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { LOCATION_DELAY_HOURS, R2_BUCKET_NAME } from '../../config/site';
import { getDb } from '../../db/client';
import { getPersonByEmail, listPlacesForViewer } from '../../db/queries';
import * as schema from '../../db/schema';
import { publicCoordinatesForPrecision } from '../../lib/precision';
import { slugify } from '../../lib/slug';
import { verifyAccessRequest } from '../auth';
import { geocodeCity, reverseGeocodeCity } from '../geocoding';

type Variables = { accessEmail: string; personId: number };

export const studioApi = new Hono<{ Variables: Variables }>();

// Verifies the Access JWT on every request here too, even though Access
// already sits in front at the edge (privacy.md, CLAUDE.md hard rule) - see
// src/middleware.ts for the same check on the /studio pages themselves.
studioApi.use('*', async (c, next) => {
	const identity = await verifyAccessRequest(c.req.raw, env);
	if (!identity) return c.json({ error: 'Unauthorized' }, 403);

	const db = getDb();
	const person = await getPersonByEmail(db, identity.email);
	if (!person) return c.json({ error: 'No matching person for this account' }, 403);

	c.set('accessEmail', identity.email);
	c.set('personId', person.id);
	await next();
});

async function requireOwnEntry(db: ReturnType<typeof getDb>, entryId: number, personId: number) {
	const rows = await db
		.select({ id: schema.entries.id, personId: schema.entries.personId })
		.from(schema.entries)
		.where(and(eq(schema.entries.id, entryId), eq(schema.entries.personId, personId)))
		.limit(1);
	return rows[0];
}

// ---- entries ----

const entryDraftSchema = z.object({
	chapterId: z.number().int().positive().nullable(),
	tripId: z.number().int().positive().nullable().optional(),
	placeId: z.number().int().positive().nullable(),
	format: z.enum(['remark', 'moment', 'clip', 'note', 'feature', 'recap', 'postcard', 'milestone']),
	category: z.enum(['life', 'school', 'trip']),
	arcStage: z.enum(['arrival', 'disorientation', 'routine', 'belonging', 'leaving']).nullable().optional(),
	audience: z.enum(['private', 'family', 'public']),
	originalLang: z.enum(['da', 'en']),
	title: z.string().min(1).max(300),
	dek: z.string().max(300).nullable().optional(),
	bodyMd: z.string().nullable().optional(),
	occurredAt: z.iso.datetime(),
	timezone: z.string().min(1),
	publishAfter: z.iso.datetime().nullable().optional(),
	consentStatus: z.enum(['not_needed', 'asked', 'yes_family', 'yes_public', 'declined']).optional()
});

studioApi.post('/entries', async (c) => {
	const parsed = entryDraftSchema.safeParse(await c.req.json());
	if (!parsed.success) return c.json({ error: z.flattenError(parsed.error) }, 400);
	const input = parsed.data;
	const personId = c.get('personId');

	const db = getDb();
	const now = new Date().toISOString();

	const baseSlug = slugify(input.title);
	let slug = baseSlug;
	let suffix = 2;
	// entries_person_slug_unique is scoped per person - keep trying suffixes until free.
	for (;;) {
		const existing = await db
			.select({ id: schema.entries.id })
			.from(schema.entries)
			.where(and(eq(schema.entries.personId, personId), eq(schema.entries.slug, slug)))
			.limit(1);
		if (existing.length === 0) break;
		slug = `${baseSlug}-${suffix}`;
		suffix += 1;
	}

	const publishAfter =
		input.publishAfter ??
		(input.audience === 'public'
			? new Date(new Date(input.occurredAt).getTime() + LOCATION_DELAY_HOURS * 60 * 60 * 1000).toISOString()
			: null);

	const [row] = await db
		.insert(schema.entries)
		.values({
			personId,
			chapterId: input.chapterId,
			tripId: input.tripId ?? null,
			placeId: input.placeId,
			slug,
			format: input.format,
			category: input.category,
			arcStage: input.arcStage ?? null,
			status: 'draft',
			audience: input.audience,
			originalLang: input.originalLang,
			title: input.title,
			dek: input.dek ?? null,
			bodyMd: input.bodyMd ?? null,
			occurredAt: input.occurredAt,
			timezone: input.timezone,
			publishAfter,
			consentStatus: input.consentStatus ?? 'not_needed',
			createdAt: now,
			updatedAt: now
		})
		.returning({ id: schema.entries.id, slug: schema.entries.slug });

	return c.json(row, 201);
});

const entryUpdateSchema = entryDraftSchema.partial();

studioApi.patch('/entries/:id', async (c) => {
	const id = Number(c.req.param('id'));
	if (!Number.isInteger(id)) return c.json({ error: 'Invalid id' }, 400);

	const parsed = entryUpdateSchema.safeParse(await c.req.json());
	if (!parsed.success) return c.json({ error: z.flattenError(parsed.error) }, 400);

	const db = getDb();
	const personId = c.get('personId');
	const existing = await requireOwnEntry(db, id, personId);
	if (!existing) return c.json({ error: 'Not found' }, 404);

	await db
		.update(schema.entries)
		.set({ ...parsed.data, updatedAt: new Date().toISOString() })
		.where(eq(schema.entries.id, id));

	return c.json({ ok: true });
});

studioApi.post('/entries/:id/publish', async (c) => {
	const id = Number(c.req.param('id'));
	if (!Number.isInteger(id)) return c.json({ error: 'Invalid id' }, 400);

	const db = getDb();
	const personId = c.get('personId');
	const existing = await requireOwnEntry(db, id, personId);
	if (!existing) return c.json({ error: 'Not found' }, 404);

	const now = new Date().toISOString();
	// Only status/published_at change - publish_after was already set when
	// the draft was created/edited and is left untouched, so this never
	// bypasses the delay the viewer-aware queries gate public visibility on.
	await db
		.update(schema.entries)
		.set({ status: 'published', publishedAt: now, updatedAt: now })
		.where(eq(schema.entries.id, id));

	return c.json({ ok: true });
});

// ---- places ----

studioApi.get('/places', async (c) => {
	const db = getDb();
	const places = await listPlacesForViewer(db, 'studio');
	return c.json(places);
});

const newPlaceSchema = z.object({
	label: z.string().min(1).max(200),
	countryCode: z.string().length(2).nullable().optional(),
	precision: z.enum(['exact', 'area', 'city', 'hidden']),
	latPrivate: z.number().min(-90).max(90).nullable().optional(),
	lonPrivate: z.number().min(-180).max(180).nullable().optional()
});

studioApi.post('/places', async (c) => {
	const parsed = newPlaceSchema.safeParse(await c.req.json());
	if (!parsed.success) return c.json({ error: z.flattenError(parsed.error) }, 400);
	const input = parsed.data;

	const publicCoords =
		input.latPrivate != null && input.lonPrivate != null
			? publicCoordinatesForPrecision({ lat: input.latPrivate, lon: input.lonPrivate }, input.precision)
			: null;

	const db = getDb();
	const [row] = await db
		.insert(schema.places)
		.values({
			label: input.label,
			countryCode: input.countryCode ?? null,
			precision: input.precision,
			latPrivate: input.latPrivate ?? null,
			lonPrivate: input.lonPrivate ?? null,
			latPublic: publicCoords?.lat ?? null,
			lonPublic: publicCoords?.lon ?? null
		})
		.returning();

	return c.json(row, 201);
});

// City-level geocoding via Nominatim (OpenStreetMap), so Lucas can type a
// city instead of coordinates. Explicit "look up" calls only - never
// autocomplete-as-you-type, which Nominatim's usage policy forbids.
studioApi.get('/geocode', async (c) => {
	const q = c.req.query('q')?.trim();
	if (!q) return c.json({ error: 'Missing query' }, 400);
	const result = await geocodeCity(q);
	if (!result) return c.json({ error: 'No match found' }, 404);
	return c.json(result);
});

// Reverse geocoding for a photo's EXIF GPS coordinates, to auto-detect a
// place without Lucas typing anything.
studioApi.get('/geocode/reverse', async (c) => {
	const lat = Number(c.req.query('lat'));
	const lon = Number(c.req.query('lon'));
	if (!Number.isFinite(lat) || !Number.isFinite(lon)) return c.json({ error: 'Invalid coordinates' }, 400);
	const label = await reverseGeocodeCity(lat, lon);
	if (!label) return c.json({ error: 'No match found' }, 404);
	return c.json({ label });
});

// ---- media ----

const PRESIGN_EXPIRY_SECONDS = 600; // 10 minutes - short-lived per spec section 8.
const SIZES = ['thumb', 'display', 'large'] as const;

const presignSchema = z.object({ entryId: z.number().int().positive() });

studioApi.post('/media/presign', async (c) => {
	if (!env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
		return c.json({ error: 'R2 credentials are not configured yet' }, 503);
	}

	const parsed = presignSchema.safeParse(await c.req.json());
	if (!parsed.success) return c.json({ error: z.flattenError(parsed.error) }, 400);

	const db = getDb();
	const existing = await requireOwnEntry(db, parsed.data.entryId, c.get('personId'));
	if (!existing) return c.json({ error: 'Not found' }, 404);

	const uploadId = crypto.randomUUID();
	const client = new AwsClient({
		service: 's3',
		region: 'auto',
		accessKeyId: env.R2_ACCESS_KEY_ID,
		secretAccessKey: env.R2_SECRET_ACCESS_KEY
	});
	const r2Url = `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

	const keys: Record<(typeof SIZES)[number], string> = { thumb: '', display: '', large: '' };
	const urls: Record<(typeof SIZES)[number], string> = { thumb: '', display: '', large: '' };
	for (const size of SIZES) {
		const key = `media/${parsed.data.entryId}/${uploadId}-${size}.webp`;
		keys[size] = key;
		// No Content-Type on the signed request: when it's part of
		// SignedHeaders, the browser's actual PUT must send back the exact
		// same header value or R2 rejects the signature with a 403 that
		// (confusingly) also looks like a CORS failure, since R2's error
		// response doesn't carry CORS headers. mime is validated at commit
		// time instead (see commitSchema below), not worth that fragility.
		const signed = await client.sign(
			new Request(`${r2Url}/${R2_BUCKET_NAME}/${key}?X-Amz-Expires=${PRESIGN_EXPIRY_SECONDS}`, {
				method: 'PUT'
			}),
			{ aws: { signQuery: true } }
		);
		urls[size] = signed.url.toString();
	}

	return c.json({ uploadId, keys, urls });
});

const commitSchema = z.object({
	entryId: z.number().int().positive(),
	keyThumb: z.string().min(1),
	keyDisplay: z.string().min(1),
	keyLarge: z.string().min(1),
	kind: z.enum(['photo', 'clip', 'audio', 'pdf']),
	mime: z.string().min(1),
	width: z.number().int().positive().nullable().optional(),
	height: z.number().int().positive().nullable().optional(),
	bytes: z.number().int().positive().nullable().optional(),
	capturedAt: z.iso.datetime().nullable().optional(),
	caption: z.string().max(400).nullable().optional(),
	altText: z.string().max(400).nullable().optional(),
	sha256: z.string().nullable().optional(),
	exifJson: z.string().nullable().optional()
});

studioApi.post('/media/commit', async (c) => {
	const parsed = commitSchema.safeParse(await c.req.json());
	if (!parsed.success) return c.json({ error: z.flattenError(parsed.error) }, 400);
	const input = parsed.data;

	const db = getDb();
	const existing = await requireOwnEntry(db, input.entryId, c.get('personId'));
	if (!existing) return c.json({ error: 'Not found' }, 404);

	// A dropped connection between PUT and commit must never silently record
	// an upload that isn't really there (BUILD_PLAN: "a commit call that
	// checks the object exists") - a retry after that is then always safe.
	for (const key of [input.keyThumb, input.keyDisplay, input.keyLarge]) {
		const head = await env.MEDIA.head(key);
		if (!head) return c.json({ error: `Missing object: ${key}` }, 409);
	}

	const [{ value: existingCount }] = await db
		.select({ value: count() })
		.from(schema.media)
		.where(eq(schema.media.entryId, input.entryId));

	const [row] = await db
		.insert(schema.media)
		.values({
			entryId: input.entryId,
			ownerId: c.get('personId'),
			kind: input.kind,
			keyThumb: input.keyThumb,
			keyDisplay: input.keyDisplay,
			keyLarge: input.keyLarge,
			mime: input.mime,
			width: input.width ?? null,
			height: input.height ?? null,
			bytes: input.bytes ?? null,
			capturedAt: input.capturedAt ?? null,
			caption: input.caption ?? null,
			altText: input.altText ?? null,
			sha256: input.sha256 ?? null,
			exifJson: input.exifJson ?? null,
			sortOrder: existingCount
		})
		.returning();

	return c.json(row, 201);
});

studioApi.delete('/media/:id', async (c) => {
	const id = Number(c.req.param('id'));
	if (!Number.isInteger(id)) return c.json({ error: 'Invalid id' }, 400);

	const db = getDb();
	const rows = await db.select().from(schema.media).where(eq(schema.media.id, id)).limit(1);
	const mediaRow = rows[0];
	if (!mediaRow) return c.json({ error: 'Not found' }, 404);

	const existing = await requireOwnEntry(db, mediaRow.entryId, c.get('personId'));
	if (!existing) return c.json({ error: 'Not found' }, 404);

	// R2 deletion first: if it fails partway, the DB row staying put means
	// retrying this same delete is still safe, same reasoning as the
	// existence check on commit above - never the other way around, which
	// could leave orphaned objects with nothing left pointing at them.
	const keys = [mediaRow.keyThumb, mediaRow.keyDisplay, mediaRow.keyLarge].filter((key): key is string => key !== null);
	await Promise.all(keys.map((key) => env.MEDIA.delete(key)));
	await db.delete(schema.media).where(eq(schema.media.id, id));

	return c.json({ ok: true });
});

// A simple studio-only pass-through for viewing just-uploaded photos, not
// the public/family-facing serving route with precision/consent checks
// (that's later milestone work - privacy.md's "Family media served through
// a Worker route that checks the viewer" is about that one, not this one).
// This just lets Lucas see what he uploaded, gated by the same Access
// check as every other /api/studio/* route.
studioApi.get('/media-file/:path{.+}', async (c) => {
	const object = await env.MEDIA.get(c.req.param('path'));
	if (!object) return c.notFound();

	return new Response(object.body, {
		headers: {
			'Content-Type': object.httpMetadata?.contentType ?? 'image/webp',
			'Cache-Control': 'private, max-age=3600'
		}
	});
});

// ---- followers (milestone 5) ----

studioApi.get('/followers', async (c) => {
	const db = getDb();
	const rows = await db
		.select()
		.from(schema.follows)
		.where(eq(schema.follows.personId, c.get('personId')))
		.orderBy(desc(schema.follows.createdAt));
	return c.json(rows);
});

studioApi.post('/followers/:id/approve', async (c) => {
	const id = Number(c.req.param('id'));
	if (!Number.isInteger(id)) return c.json({ error: 'Invalid id' }, 400);

	const db = getDb();
	const existing = await db
		.select({ id: schema.follows.id })
		.from(schema.follows)
		.where(and(eq(schema.follows.id, id), eq(schema.follows.personId, c.get('personId'))))
		.limit(1);
	if (existing.length === 0) return c.json({ error: 'Not found' }, 404);

	await db.update(schema.follows).set({ status: 'approved' }).where(eq(schema.follows.id, id));
	return c.json({ ok: true });
});

studioApi.post('/followers/:id/revoke', async (c) => {
	const id = Number(c.req.param('id'));
	if (!Number.isInteger(id)) return c.json({ error: 'Invalid id' }, 400);

	const db = getDb();
	const existing = await db
		.select({ id: schema.follows.id })
		.from(schema.follows)
		.where(and(eq(schema.follows.id, id), eq(schema.follows.personId, c.get('personId'))))
		.limit(1);
	if (existing.length === 0) return c.json({ error: 'Not found' }, 404);

	await db.update(schema.follows).set({ status: 'revoked' }).where(eq(schema.follows.id, id));
	return c.json({ ok: true });
});
