import { AwsClient } from 'aws4fetch';
import { env } from 'cloudflare:workers';
import { and, asc, count, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { LOCATION_DELAY_HOURS, PER_PERSON_QUOTA_BYTES, PRIMARY_PERSON_SLUG, R2_BUCKET_NAME } from '../../config/site';
import { getDb } from '../../db/client';
import {
	confirmCrossingParticipant,
	createCrossingFromSuggestion,
	findMediaBySha256ForOwner,
	getPersonByEmail,
	listCrossingsForPerson,
	listPeopleNamesForPerson,
	listPlacesForViewer,
	listStaysForCrossingSuggestions,
	personSlugOrEmailInUse,
	sumMediaBytesForOwner
} from '../../db/queries';
import * as schema from '../../db/schema';
import { suggestCrossings } from '../../lib/crossings';
import { publicCoordinatesForPrecision } from '../../lib/precision';
import { slugify } from '../../lib/slug';
import { verifyAccessRequest } from '../auth';
import { deleteEntryCascade } from '../entryDeletion';
import { geocodeCity, reverseGeocodeCity } from '../geocoding';

type Variables = { accessEmail: string; personId: number; personSlug: string };

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
	c.set('personSlug', person.slug);
	await next();
});

// Owner-only gate for contributor management - deliberately not the
// people.role column, which stays pure display text ('scholar') shown on
// public profiles, never a security check.
function isPrimaryPerson(c: { get: (key: 'personSlug') => string }): boolean {
	return c.get('personSlug') === PRIMARY_PERSON_SLUG;
}

async function requireOwnEntry(db: ReturnType<typeof getDb>, entryId: number, personId: number) {
	const rows = await db
		.select({ id: schema.entries.id, personId: schema.entries.personId })
		.from(schema.entries)
		.where(and(eq(schema.entries.id, entryId), eq(schema.entries.personId, personId)))
		.limit(1);
	return rows[0];
}

// Same ownership check as requireOwnEntry, but starting from a media id -
// media.ownerId is set at commit time to whoever uploaded it, which is
// always this person for a solo site, so checking that column directly
// (rather than joining back through entries) is enough and one query.
async function requireOwnMedia(db: ReturnType<typeof getDb>, mediaId: number, personId: number) {
	const rows = await db
		.select({ id: schema.media.id, ownerId: schema.media.ownerId })
		.from(schema.media)
		.where(and(eq(schema.media.id, mediaId), eq(schema.media.ownerId, personId)))
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

studioApi.delete('/entries/:id', async (c) => {
	const id = Number(c.req.param('id'));
	if (!Number.isInteger(id)) return c.json({ error: 'Invalid id' }, 400);

	const db = getDb();
	const personId = c.get('personId');
	const existing = await requireOwnEntry(db, id, personId);
	if (!existing) return c.json({ error: 'Not found' }, 404);

	await deleteEntryCascade(db, id);

	return c.json({ ok: true });
});

const bulkIdsSchema = z.object({ ids: z.array(z.number().int().positive()).min(1).max(200) });

studioApi.post('/entries/bulk-delete', async (c) => {
	const parsed = bulkIdsSchema.safeParse(await c.req.json());
	if (!parsed.success) return c.json({ error: z.flattenError(parsed.error) }, 400);

	const db = getDb();
	const personId = c.get('personId');
	const deleted: number[] = [];
	// One at a time, same as the retry-safe ordering on the single delete -
	// a failure partway through still leaves every row before it actually
	// gone, with deleted telling the caller exactly where it stopped.
	for (const id of parsed.data.ids) {
		const existing = await requireOwnEntry(db, id, personId);
		if (!existing) continue;
		await deleteEntryCascade(db, id);
		deleted.push(id);
	}

	return c.json({ deleted });
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

// Takes a published entry back to draft - hides it from every public/family
// viewer (entryVisibilityWhere requires status 'published' first, before it
// even looks at audience) without deleting it or anything it carries
// (media, people tags, translations). The opposite of /publish, not a
// softer version of delete - automation never does this on its own
// (studio.md: "automation... never publishes"; the same line covers taking
// something off public view).
//
// Deliberately leaves published_at as it was rather than clearing it back to
// null - sweepStaleDrafts (entryDeletion.ts) only sweeps a draft whose
// published_at is still null, i.e. one that's never gone live. Clearing it
// here would make an old, previously-published entry's original created_at
// (untouched, correctly - it's still when the row was first made) fall
// outside the expiry window the moment it's unpublished, so the very next
// studio page load would auto-delete real, already-published content for
// real. Caught live: this is exactly what happened to a seed fixture entry
// while building this route.
studioApi.post('/entries/:id/unpublish', async (c) => {
	const id = Number(c.req.param('id'));
	if (!Number.isInteger(id)) return c.json({ error: 'Invalid id' }, 400);

	const db = getDb();
	const personId = c.get('personId');
	const existing = await requireOwnEntry(db, id, personId);
	if (!existing) return c.json({ error: 'Not found' }, 404);

	await db.update(schema.entries).set({ status: 'draft', updatedAt: new Date().toISOString() }).where(eq(schema.entries.id, id));

	return c.json({ ok: true });
});

studioApi.post('/entries/bulk-unpublish', async (c) => {
	const parsed = bulkIdsSchema.safeParse(await c.req.json());
	if (!parsed.success) return c.json({ error: z.flattenError(parsed.error) }, 400);

	const db = getDb();
	const personId = c.get('personId');
	const now = new Date().toISOString();
	const unpublished: number[] = [];
	for (const id of parsed.data.ids) {
		const existing = await requireOwnEntry(db, id, personId);
		if (!existing) continue;
		await db.update(schema.entries).set({ status: 'draft', updatedAt: now }).where(eq(schema.entries.id, id));
		unpublished.push(id);
	}

	return c.json({ unpublished });
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
	lonPrivate: z.number().min(-180).max(180).nullable().optional(),
	starred: z.boolean().optional()
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
			lonPublic: publicCoords?.lon ?? null,
			starred: input.starred ?? false
		})
		.returning();

	return c.json(row, 201);
});

const placeUpdateSchema = z
	.object({ label: z.string().min(1).max(200).optional(), starred: z.boolean().optional() })
	.refine((v) => v.label !== undefined || v.starred !== undefined, { message: 'Nothing to update' });

// Renames a place's headline label and/or toggles its studio-only starred
// shortcut - lat/lon/precision are always untouched, so e.g. a GPS-guessed
// "Tinicum Township" can become "Philadelphia Airport" everywhere that place
// is used, without losing the coordinates or re-running the
// privacy-precision rounding.
studioApi.patch('/places/:id', async (c) => {
	const id = Number(c.req.param('id'));
	if (!Number.isInteger(id)) return c.json({ error: 'Invalid id' }, 400);

	const parsed = placeUpdateSchema.safeParse(await c.req.json());
	if (!parsed.success) return c.json({ error: z.flattenError(parsed.error) }, 400);

	const db = getDb();
	const [row] = await db.update(schema.places).set(parsed.data).where(eq(schema.places.id, id)).returning();
	if (!row) return c.json({ error: 'Not found' }, 404);

	return c.json(row);
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

// Bulk upload's duplicate check, queried before a new draft entry is created
// for a file - lets it skip straight to "already uploaded, here's the entry"
// instead of creating an orphan draft for a photo Lucas already has in.
studioApi.get('/media/by-sha256', async (c) => {
	const sha256 = c.req.query('sha256');
	if (!sha256) return c.json({ error: 'Missing sha256' }, 400);

	const db = getDb();
	const existing = await findMediaBySha256ForOwner(db, c.get('personId'), sha256);
	if (!existing) return c.json({ found: false });
	return c.json({ found: true, entryId: existing.entryId });
});

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

	// Cheap pre-check only - the incoming file's size isn't known until
	// commit (this request carries no size), so this just stops a new
	// upload from starting once this person is already over budget.
	const usedBeforeUpload = await sumMediaBytesForOwner(db, c.get('personId'));
	if (usedBeforeUpload >= PER_PERSON_QUOTA_BYTES) {
		return c.json({ error: 'Storage quota reached' }, 409);
	}

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

	// The authoritative quota check - bytes is only known now, by which point
	// the objects are already sitting in R2, so a rejection here deletes them
	// too rather than leaving orphaned bytes silently eating the quota with
	// no owning row.
	if (input.bytes != null) {
		const usedBeforeCommit = await sumMediaBytesForOwner(db, c.get('personId'));
		if (usedBeforeCommit + input.bytes > PER_PERSON_QUOTA_BYTES) {
			await Promise.all([input.keyThumb, input.keyDisplay, input.keyLarge].map((key) => env.MEDIA.delete(key)));
			return c.json({ error: 'Storage quota reached' }, 409);
		}
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
	await db.delete(schema.mediaPeople).where(eq(schema.mediaPeople.mediaId, id));
	await db.delete(schema.media).where(eq(schema.media.id, id));

	return c.json({ ok: true });
});

// ---- people tags on a photo ----
// Free-text name on a face box, studio-only (never a /studio-first-time-user
// account, no email, no notification) - see src/db/schema.ts's mediaPeople
// comment. Detection itself runs in the browser; these two routes only ever
// persist a box + name the person already confirmed.

const peopleTagSchema = z.object({
	name: z.string().trim().min(1).max(100),
	boxX: z.number().min(0).max(1),
	boxY: z.number().min(0).max(1),
	boxW: z.number().min(0).max(1),
	boxH: z.number().min(0).max(1)
});

studioApi.post('/media/:id/people', async (c) => {
	const mediaId = Number(c.req.param('id'));
	if (!Number.isInteger(mediaId)) return c.json({ error: 'Invalid id' }, 400);

	const parsed = peopleTagSchema.safeParse(await c.req.json());
	if (!parsed.success) return c.json({ error: z.flattenError(parsed.error) }, 400);

	const db = getDb();
	const existing = await requireOwnMedia(db, mediaId, c.get('personId'));
	if (!existing) return c.json({ error: 'Not found' }, 404);

	const [row] = await db
		.insert(schema.mediaPeople)
		.values({ mediaId, ...parsed.data, createdAt: new Date().toISOString() })
		.returning();

	return c.json(row, 201);
});

studioApi.delete('/media/:id/people/:tagId', async (c) => {
	const mediaId = Number(c.req.param('id'));
	const tagId = Number(c.req.param('tagId'));
	if (!Number.isInteger(mediaId) || !Number.isInteger(tagId)) return c.json({ error: 'Invalid id' }, 400);

	const db = getDb();
	const existing = await requireOwnMedia(db, mediaId, c.get('personId'));
	if (!existing) return c.json({ error: 'Not found' }, 404);

	await db.delete(schema.mediaPeople).where(and(eq(schema.mediaPeople.id, tagId), eq(schema.mediaPeople.mediaId, mediaId)));
	return c.json({ ok: true });
});

// Autocomplete list for the name field - every name this person has typed
// on any of their own photos before, so typing "Anna" again doesn't start
// from nothing the second time.
studioApi.get('/people-names', async (c) => {
	const db = getDb();
	const names = await listPeopleNamesForPerson(db, c.get('personId'));
	return c.json(names);
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

const newPersonSchema = z.object({
	slug: z
		.string()
		.min(1)
		.max(60)
		.regex(/^[a-z0-9-]+$/),
	displayName: z.string().min(1).max(100),
	email: z.email(),
	role: z.string().min(1).max(60).default('scholar'),
	seat: z.number().int().positive().nullable().optional()
});

// Both routes below are owner-only - adding a contributor is a decision for
// the primary person to make, not something a contributor can do to
// themselves or each other.
studioApi.get('/people', async (c) => {
	if (!isPrimaryPerson(c)) return c.json({ error: 'Only the primary scholar can manage contributors' }, 403);

	const db = getDb();
	const rows = await db.select().from(schema.people).orderBy(asc(schema.people.id));
	return c.json(rows);
});

studioApi.post('/people', async (c) => {
	if (!isPrimaryPerson(c)) return c.json({ error: 'Only the primary scholar can manage contributors' }, 403);

	const parsed = newPersonSchema.safeParse(await c.req.json());
	if (!parsed.success) return c.json({ error: z.flattenError(parsed.error) }, 400);
	const input = parsed.data;

	const db = getDb();
	if (await personSlugOrEmailInUse(db, input.slug, input.email)) {
		return c.json({ error: 'That slug or email is already in use' }, 409);
	}

	const [row] = await db
		.insert(schema.people)
		.values({
			slug: input.slug,
			displayName: input.displayName,
			email: input.email,
			role: input.role,
			seat: input.seat ?? null,
			createdAt: new Date().toISOString()
		})
		.returning();

	return c.json(row, 201);
});

studioApi.get('/crossings', async (c) => {
	const db = getDb();
	const stays = await listStaysForCrossingSuggestions(db);
	const suggestions = suggestCrossings(stays).filter((s) => s.personIds.includes(c.get('personId')));
	const crossings = await listCrossingsForPerson(db, c.get('personId'));
	return c.json({ suggestions, crossings });
});

const newCrossingSchema = z.object({
	placeId: z.number().int().positive(),
	personIds: z.array(z.number().int().positive()).min(2),
	startsOn: z.string().min(1),
	endsOn: z.string().min(1)
});

studioApi.post('/crossings', async (c) => {
	const parsed = newCrossingSchema.safeParse(await c.req.json());
	if (!parsed.success) return c.json({ error: z.flattenError(parsed.error) }, 400);
	if (!parsed.data.personIds.includes(c.get('personId'))) {
		return c.json({ error: 'You can only suggest a crossing you were part of' }, 403);
	}

	const db = getDb();
	const crossing = await createCrossingFromSuggestion(db, parsed.data, new Date().toISOString());
	// Suggesting it is itself an implicit yes from the person doing the
	// suggesting - the other participant(s) still confirm separately.
	await confirmCrossingParticipant(db, crossing.id, c.get('personId'), new Date().toISOString());
	return c.json(crossing, 201);
});

studioApi.post('/crossings/:id/confirm', async (c) => {
	const id = Number(c.req.param('id'));
	if (!Number.isInteger(id)) return c.json({ error: 'Invalid id' }, 400);

	const db = getDb();
	const confirmed = await confirmCrossingParticipant(db, id, c.get('personId'), new Date().toISOString());
	if (!confirmed) return c.json({ error: 'Not found' }, 404);
	return c.json({ ok: true });
});
