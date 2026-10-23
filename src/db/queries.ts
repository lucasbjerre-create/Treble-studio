import { and, asc, desc, eq, getTableColumns, gt, inArray, isNull, lt, lte, or, type SQL } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from './schema';

export type Viewer = 'public' | 'family' | 'studio';
export type Database = DrizzleD1Database<typeof schema>;

function combine(...conditions: Array<SQL | undefined>): SQL | undefined {
	const defined = conditions.filter((c): c is SQL => c !== undefined);
	return defined.length === 0 ? undefined : and(...defined);
}

/**
 * publish_after gates the public tier only - family already knows where
 * Lucas is, the delay exists to protect against strangers. See src/lib/visibility.ts
 * for the equivalent pure logic, which the privacy tests check this mirrors.
 */
function entryVisibilityWhere(viewer: Viewer, now: string): SQL | undefined {
	if (viewer === 'studio') return undefined;
	if (viewer === 'family') {
		return and(eq(schema.entries.status, 'published'), inArray(schema.entries.audience, ['family', 'public']));
	}
	return and(
		eq(schema.entries.status, 'published'),
		eq(schema.entries.audience, 'public'),
		or(isNull(schema.entries.publishAfter), lte(schema.entries.publishAfter, now))
	);
}

// Columns safe to send to public/family viewers. Excludes publish_after
// (would leak exact movement timing), consent_status and camera_json
// (privacy.md: never reaches public/family responses), and internal
// created_at/updated_at bookkeeping.
const publicEntryColumns = {
	id: schema.entries.id,
	personId: schema.entries.personId,
	chapterId: schema.entries.chapterId,
	tripId: schema.entries.tripId,
	placeId: schema.entries.placeId,
	slug: schema.entries.slug,
	format: schema.entries.format,
	category: schema.entries.category,
	arcStage: schema.entries.arcStage,
	status: schema.entries.status,
	audience: schema.entries.audience,
	originalLang: schema.entries.originalLang,
	title: schema.entries.title,
	dek: schema.entries.dek,
	bodyMd: schema.entries.bodyMd,
	occurredAt: schema.entries.occurredAt,
	endedAt: schema.entries.endedAt,
	timezone: schema.entries.timezone,
	featured: schema.entries.featured,
	publishedAt: schema.entries.publishedAt
} as const;

export async function listEntriesForViewer(
	db: Database,
	viewer: Viewer,
	now: string,
	opts: { personId?: number; chapterId?: number; category?: 'life' | 'school' | 'trip' } = {}
) {
	const where = combine(
		entryVisibilityWhere(viewer, now),
		opts.personId !== undefined ? eq(schema.entries.personId, opts.personId) : undefined,
		opts.chapterId !== undefined ? eq(schema.entries.chapterId, opts.chapterId) : undefined,
		opts.category !== undefined ? eq(schema.entries.category, opts.category) : undefined
	);

	const columns = viewer === 'studio' ? getTableColumns(schema.entries) : publicEntryColumns;
	let query = db.select(columns).from(schema.entries).$dynamic();
	if (where) query = query.where(where);
	return query.orderBy(desc(schema.entries.occurredAt));
}

/**
 * Previous and next entry by occurred_at, within the same viewer-visible set
 * for one person. Used for the entry page's prev/next links.
 */
export async function getAdjacentEntries(
	db: Database,
	viewer: Viewer,
	personId: number,
	occurredAt: string,
	now: string
) {
	const base = combine(entryVisibilityWhere(viewer, now), eq(schema.entries.personId, personId));
	const columns = viewer === 'studio' ? getTableColumns(schema.entries) : publicEntryColumns;

	const prevWhere = combine(base, lt(schema.entries.occurredAt, occurredAt));
	let prevQuery = db.select(columns).from(schema.entries).$dynamic();
	if (prevWhere) prevQuery = prevQuery.where(prevWhere);
	const prevRows = await prevQuery.orderBy(desc(schema.entries.occurredAt)).limit(1);

	const nextWhere = combine(base, gt(schema.entries.occurredAt, occurredAt));
	let nextQuery = db.select(columns).from(schema.entries).$dynamic();
	if (nextWhere) nextQuery = nextQuery.where(nextWhere);
	const nextRows = await nextQuery.orderBy(asc(schema.entries.occurredAt)).limit(1);

	return { prev: prevRows[0], next: nextRows[0] };
}

/** entry_texts lookup for rendering the other language - see getEntryTranslation usage in entry pages. */
export async function getEntryTranslation(db: Database, entryId: number, lang: 'da' | 'en') {
	const rows = await db
		.select()
		.from(schema.entryTexts)
		.where(and(eq(schema.entryTexts.entryId, entryId), eq(schema.entryTexts.lang, lang)))
		.limit(1);
	return rows[0];
}

/** Batched entry_texts lookup for a list page (archive) - one query instead of one per entry. */
export async function listEntryTranslations(db: Database, entryIds: number[], lang: 'da' | 'en') {
	if (entryIds.length === 0) return new Map<number, Awaited<ReturnType<typeof getEntryTranslation>>>();
	const rows = await db
		.select()
		.from(schema.entryTexts)
		.where(and(inArray(schema.entryTexts.entryId, entryIds), eq(schema.entryTexts.lang, lang)));
	return new Map(rows.map((row) => [row.entryId, row]));
}

export async function getEntryBySlugForViewer(
	db: Database,
	viewer: Viewer,
	personSlug: string,
	slug: string,
	now: string
) {
	const where = combine(
		eq(schema.people.slug, personSlug),
		eq(schema.entries.slug, slug),
		entryVisibilityWhere(viewer, now)
	);

	const columns = viewer === 'studio' ? getTableColumns(schema.entries) : publicEntryColumns;
	let query = db
		.select(columns)
		.from(schema.entries)
		.innerJoin(schema.people, eq(schema.entries.personId, schema.people.id))
		.$dynamic();
	if (where) query = query.where(where);
	const rows = await query.limit(1);
	return rows[0];
}

// Excludes owner_id and bytes (internal bookkeeping, not privacy-mandated)
// and sha256/phash (privacy.md: never reaches public/family responses).
const publicMediaColumns = {
	id: schema.media.id,
	entryId: schema.media.entryId,
	kind: schema.media.kind,
	keyThumb: schema.media.keyThumb,
	keyDisplay: schema.media.keyDisplay,
	keyLarge: schema.media.keyLarge,
	posterKey: schema.media.posterKey,
	mime: schema.media.mime,
	width: schema.media.width,
	height: schema.media.height,
	durationMs: schema.media.durationMs,
	capturedAt: schema.media.capturedAt,
	caption: schema.media.caption,
	altText: schema.media.altText,
	sortOrder: schema.media.sortOrder
} as const;

export async function listMediaForEntry(db: Database, viewer: Viewer, entryId: number, now: string) {
	const where = combine(eq(schema.media.entryId, entryId), entryVisibilityWhere(viewer, now));

	const columns = viewer === 'studio' ? getTableColumns(schema.media) : publicMediaColumns;
	let query = db
		.select(columns)
		.from(schema.media)
		.innerJoin(schema.entries, eq(schema.media.entryId, schema.entries.id))
		.$dynamic();
	if (where) query = query.where(where);
	return query.orderBy(asc(schema.media.sortOrder));
}

// The privacy-critical exclusion: lat_private/lon_private never selected for
// public or family viewers, proven by their absence from the result, not a
// null check.
const publicPlaceColumns = {
	id: schema.places.id,
	label: schema.places.label,
	countryCode: schema.places.countryCode,
	latPublic: schema.places.latPublic,
	lonPublic: schema.places.lonPublic,
	precision: schema.places.precision
} as const;

export async function listPlacesForViewer(db: Database, viewer: Viewer) {
	const columns = viewer === 'studio' ? getTableColumns(schema.places) : publicPlaceColumns;
	return db.select(columns).from(schema.places);
}

export async function getPlaceById(db: Database, viewer: Viewer, id: number) {
	const columns = viewer === 'studio' ? getTableColumns(schema.places) : publicPlaceColumns;
	const rows = await db.select(columns).from(schema.places).where(eq(schema.places.id, id)).limit(1);
	return rows[0];
}

// Excludes email - never needed by a reader and not privacy-cleared for public display.
const publicPersonColumns = {
	id: schema.people.id,
	slug: schema.people.slug,
	displayName: schema.people.displayName,
	role: schema.people.role,
	routeColor: schema.people.routeColor
} as const;

export async function getPersonBySlug(db: Database, viewer: Viewer, slug: string) {
	const columns = viewer === 'studio' ? getTableColumns(schema.people) : publicPersonColumns;
	const rows = await db.select(columns).from(schema.people).where(eq(schema.people.slug, slug)).limit(1);
	return rows[0];
}

// Chapters aren't audience-gated themselves (just organizational metadata on
// top of entries, which are), so no viewer filtering - same as places.
export async function listChaptersForPerson(db: Database, personId: number) {
	return db
		.select()
		.from(schema.chapters)
		.where(eq(schema.chapters.personId, personId))
		.orderBy(asc(schema.chapters.sortOrder));
}

/**
 * Hides future-dated legs from public/family (privacy.md). Does NOT yet trim
 * route geometry near home - that's milestone 5 (family layer and privacy
 * hardening), not implemented here. geometry_json is returned as-is.
 */
export async function listLegsForViewer(
	db: Database,
	viewer: Viewer,
	now: string,
	opts: { tripId?: number } = {}
) {
	const where = combine(
		viewer === 'studio' ? undefined : lte(schema.legs.startsAt, now),
		opts.tripId !== undefined ? eq(schema.legs.tripId, opts.tripId) : undefined
	);
	let query = db.select().from(schema.legs).$dynamic();
	if (where) query = query.where(where);
	return query.orderBy(asc(schema.legs.startsAt));
}
