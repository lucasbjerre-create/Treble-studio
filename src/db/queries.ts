import { and, asc, desc, eq, getTableColumns, gt, gte, inArray, isNull, lt, lte, or, type SQL } from 'drizzle-orm';
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
 * Just the columns the studio entries list (and its delete UI) needs,
 * including created_at - studio-only by construction (filtered to one
 * person, no audience/status filter), so this doesn't go through
 * listEntriesForViewer's viewer-dependent column set, whose inferred type
 * only ever carries publicEntryColumns's fields regardless of which branch
 * actually runs.
 */
export async function listEntrySummariesForPerson(db: Database, personId: number) {
	return db
		.select({
			id: schema.entries.id,
			title: schema.entries.title,
			status: schema.entries.status,
			occurredAt: schema.entries.occurredAt,
			createdAt: schema.entries.createdAt,
			// So EntryList can tell a genuinely new, never-published draft (the
			// only kind sweepStaleDrafts - entryDeletion.ts - ever auto-deletes)
			// apart from one that's been unpublished back to draft, which is
			// exempt regardless of age. Without this the expiry countdown
			// wrongly threatens an unpublished entry that will never actually
			// auto-delete.
			publishedAt: schema.entries.publishedAt
		})
		.from(schema.entries)
		.where(eq(schema.entries.personId, personId))
		.orderBy(desc(schema.entries.occurredAt));
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

/**
 * Always studio-level columns (every field, no visibility filter) - used only
 * by the studio editor, which already gates access via requireOwnEntry-style
 * person checks rather than the public/family audience rules.
 */
export async function getEntryById(db: Database, id: number) {
	const rows = await db.select().from(schema.entries).where(eq(schema.entries.id, id)).limit(1);
	return rows[0];
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

/**
 * For the public /api/media route (src/worker/api/media.ts): looks a media
 * row up by its R2 object key (matching whichever of the four key columns
 * it is - a request only ever carries one key, not the row's id) together
 * with its owning entry's visibility fields. Deliberately does NOT filter by
 * viewer here, unlike every other query in this file - the caller doesn't
 * know which viewer tier applies until it has this row's personId (family
 * follow status is per-person), so it resolves the viewer first and then
 * checks src/lib/visibility.ts's isEntryVisible against the fields
 * returned here. That pure check is the same one entryVisibilityWhere is
 * audited to mirror (see listEntriesForViewer above), not an ad-hoc
 * reimplementation - the two-step shape is what differs here, not the rule.
 */
export async function findMediaByKeyWithEntry(db: Database, key: string) {
	const rows = await db
		.select({
			id: schema.media.id,
			mime: schema.media.mime,
			entryId: schema.media.entryId,
			personId: schema.entries.personId,
			status: schema.entries.status,
			audience: schema.entries.audience,
			publishAfter: schema.entries.publishAfter
		})
		.from(schema.media)
		.innerJoin(schema.entries, eq(schema.media.entryId, schema.entries.id))
		.where(
			or(
				eq(schema.media.keyThumb, key),
				eq(schema.media.keyDisplay, key),
				eq(schema.media.keyLarge, key),
				eq(schema.media.posterKey, key)
			)
		)
		.limit(1);
	return rows[0];
}

/**
 * Studio-only, owner-scoped: has this person already uploaded a photo with
 * this exact sha256? Used by the bulk-upload flow to skip re-creating a
 * duplicate entry rather than silently uploading the same photo twice.
 * Scoped to ownerId, never just a bare sha256 match, so one person's upload
 * can never surface another person's media row.
 */
export async function findMediaBySha256ForOwner(db: Database, ownerId: number, sha256: string) {
	const rows = await db
		.select({ id: schema.media.id, entryId: schema.media.entryId })
		.from(schema.media)
		.where(and(eq(schema.media.ownerId, ownerId), eq(schema.media.sha256, sha256)))
		.limit(1);
	return rows[0];
}

/**
 * Studio-only, like findMediaBySha256ForOwner above: media_people is never
 * selected for a public/family viewer anywhere, so there's no viewer
 * argument to get wrong here.
 */
export async function listPeopleTagsForMedia(db: Database, mediaIds: number[]) {
	if (mediaIds.length === 0) return [];
	return db.select().from(schema.mediaPeople).where(inArray(schema.mediaPeople.mediaId, mediaIds));
}

/**
 * Names only, grouped by media id - feeds the public "With Anna, Erik" note
 * below a photo (src/lib/peopleNote.ts). Safe for any viewer: a caller only
 * ever passes ids it already got back from a viewer-filtered media query, so
 * a media row this function was never asked about simply has no entry in
 * the returned map - there's no separate audience check to get wrong here.
 */
export async function listPeopleNamesByMedia(db: Database, mediaIds: number[]): Promise<Map<number, string[]>> {
	const byMedia = new Map<number, string[]>();
	if (mediaIds.length === 0) return byMedia;

	const rows = await db
		.select({ mediaId: schema.mediaPeople.mediaId, name: schema.mediaPeople.name })
		.from(schema.mediaPeople)
		.where(inArray(schema.mediaPeople.mediaId, mediaIds));

	for (const row of rows) {
		const names = byMedia.get(row.mediaId) ?? [];
		names.push(row.name);
		byMedia.set(row.mediaId, names);
	}
	return byMedia;
}

// Autocomplete source for the "type a name" box - every name this person has
// ever typed on one of their own photos, deduplicated. Free text, not a
// roster table: a new name is simply one nothing here has returned yet.
export async function listPeopleNamesForPerson(db: Database, personId: number) {
	const rows = await db
		.select({ name: schema.mediaPeople.name })
		.from(schema.mediaPeople)
		.innerJoin(schema.media, eq(schema.mediaPeople.mediaId, schema.media.id))
		.where(eq(schema.media.ownerId, personId))
		.groupBy(schema.mediaPeople.name)
		.orderBy(asc(schema.mediaPeople.name));
	return rows.map((r) => r.name);
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
// seat is public on purpose - it drives the scholar colour on public map markers/trails (map-theme.json).
const publicPersonColumns = {
	id: schema.people.id,
	slug: schema.people.slug,
	displayName: schema.people.displayName,
	role: schema.people.role,
	routeColor: schema.people.routeColor,
	seat: schema.people.seat
} as const;

export async function getPersonBySlug(db: Database, viewer: Viewer, slug: string) {
	const columns = viewer === 'studio' ? getTableColumns(schema.people) : publicPersonColumns;
	const rows = await db.select(columns).from(schema.people).where(eq(schema.people.slug, slug)).limit(1);
	return rows[0];
}

/** Resolves the studio writer behind an Access-verified email - studio-only, full columns. */
export async function getPersonByEmail(db: Database, email: string) {
	const rows = await db.select().from(schema.people).where(eq(schema.people.email, email)).limit(1);
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
 * route geometry near home - that's milestone 7 (family layer and privacy
 * hardening, renumbered from the original 5 when the group path was chosen),
 * not implemented here. geometry_json is returned as-is.
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

/**
 * Per-page viewer resolution for milestone 5's followers model: a follower
 * of one person isn't automatically a follower of another (BUILD_PLAN), so
 * this is checked per (viewer email, this page's person) pair rather than
 * being a flat site-wide tier. Every existing query helper above keeps
 * taking the same Viewer type unchanged - a page just resolves which of
 * 'public'/'family' applies before calling them, exactly as it already
 * passes a literal 'public' today.
 */
export async function resolveViewerForPerson(db: Database, viewerEmail: string | null, personId: number): Promise<Viewer> {
	if (!viewerEmail) return 'public';
	// Lowercased defensively here too (also done at every /api/viewer/*
	// write) - emails are stored lowercase, so an un-normalized cookie value
	// would otherwise silently never match.
	const rows = await db
		.select({ id: schema.follows.id })
		.from(schema.follows)
		.where(
			and(
				eq(schema.follows.email, viewerEmail.toLowerCase()),
				eq(schema.follows.personId, personId),
				eq(schema.follows.status, 'approved')
			)
		)
		.limit(1);
	return rows.length > 0 ? 'family' : 'public';
}

/**
 * Raw material for suggesting crossings (src/lib/crossings.ts): one row per
 * (trip, place that trip's entries actually touch). Studio-only - this is
 * for the person reviewing suggestions, not a public/family read path, so it
 * takes no viewer argument and returns everything.
 */
export async function listStaysForCrossingSuggestions(db: Database) {
	const rows = await db
		.selectDistinct({
			personId: schema.trips.personId,
			placeId: schema.entries.placeId,
			startsOn: schema.trips.startsOn,
			endsOn: schema.trips.endsOn
		})
		.from(schema.trips)
		.innerJoin(schema.entries, eq(schema.entries.tripId, schema.trips.id));

	return rows.filter((r): r is typeof r & { placeId: number; endsOn: string } => r.placeId !== null && r.endsOn !== null);
}

export interface ConfirmedCrossing {
	id: number;
	placeId: number;
	startsOn: string;
	endsOn: string;
	personIds: number[];
}

/**
 * Only crossings where every participant has confirmed - never an
 * unconfirmed one, to any viewer tier. Confirmation is checked before any
 * crossing row is even selected, not filtered out afterward, so there's no
 * code path that builds a response containing one and then has to remember
 * to strip it.
 *
 * Being confirmed is not the same as being visible: a crossing's own
 * metadata (that these two people were in this place during this date
 * range) is itself audience-gated by requiring at least one of the
 * participants' own entries in that window to actually be visible to
 * `viewer` - otherwise a public viewer could learn two people crossed paths
 * purely from a confirmed-but-otherwise-entirely-family/private crossing,
 * which is exactly the kind of cross-person inference the unconfirmed-case
 * rule (never reveal a crossing exists) is also protecting against.
 *
 * Not called from any page yet (the crossing map marker is still unbuilt -
 * see BUILD_PLAN milestone 6). Flagging before it is: `viewer` here is one
 * flat tier applied to every participant's entries via entryVisibilityWhere,
 * but milestone 5 made 'family' a per-person thing (resolveViewerForPerson,
 * a visitor only follows specific people, not everyone). Called naively
 * with 'family' resolved for just one participant, this would also surface
 * the OTHER participant's family-tier entries to a visitor who never
 * followed them. Whoever builds the crossing UI needs either a per-person
 * viewer map here, not one flat Viewer, or to intersect this function's
 * result with each participant's own resolved tier at the call site.
 */
export async function listConfirmedCrossingsForViewer(
	db: Database,
	viewer: Viewer,
	now: string
): Promise<ConfirmedCrossing[]> {
	const participantRows = await db
		.select({
			crossingId: schema.crossingParticipants.crossingId,
			personId: schema.crossingParticipants.personId,
			confirmed: schema.crossingParticipants.confirmed
		})
		.from(schema.crossingParticipants);

	const byCrossing = new Map<number, { personId: number; confirmed: boolean }[]>();
	for (const row of participantRows) {
		const list = byCrossing.get(row.crossingId) ?? [];
		list.push({ personId: row.personId, confirmed: row.confirmed });
		byCrossing.set(row.crossingId, list);
	}

	const confirmedIds = [...byCrossing.entries()]
		.filter(([, participants]) => participants.length >= 2 && participants.every((p) => p.confirmed))
		.map(([id]) => id);
	if (confirmedIds.length === 0) return [];

	const crossingRows = await db.select().from(schema.crossings).where(inArray(schema.crossings.id, confirmedIds));

	const crossings = crossingRows.map((c) => ({
		id: c.id,
		placeId: c.placeId,
		startsOn: c.startsOn,
		endsOn: c.endsOn,
		personIds: (byCrossing.get(c.id) ?? []).map((p) => p.personId)
	}));

	if (viewer === 'studio') return crossings;

	const visible = await Promise.all(
		crossings.map(async (crossing) => {
			const entries = await listEntriesForCrossing(db, viewer, crossing, now);
			return entries.length > 0 ? crossing : null;
		})
	);
	return visible.filter((c): c is ConfirmedCrossing => c !== null);
}

/**
 * Each participant's own entries for a confirmed crossing, filtered by the
 * same viewer-audience rule as everywhere else (entryVisibilityWhere) - a
 * public viewer gets only the public, non-delayed entries from whichever
 * participants have any, never a family or private entry from either person
 * just because the crossing itself is confirmed.
 */
export async function listEntriesForCrossing(db: Database, viewer: Viewer, crossing: ConfirmedCrossing, now: string) {
	const where = combine(
		entryVisibilityWhere(viewer, now),
		eq(schema.entries.placeId, crossing.placeId),
		inArray(schema.entries.personId, crossing.personIds),
		gte(schema.entries.occurredAt, `${crossing.startsOn}T00:00:00.000Z`),
		lte(schema.entries.occurredAt, `${crossing.endsOn}T23:59:59.999Z`)
	);

	const columns = viewer === 'studio' ? getTableColumns(schema.entries) : publicEntryColumns;
	let query = db.select(columns).from(schema.entries).$dynamic();
	if (where) query = query.where(where);
	return query.orderBy(asc(schema.entries.occurredAt));
}

/**
 * Distinct people with at least one entry this viewer can see - the gate for
 * the "Choose your TREBLEr" picker (task 4 / BUILD_PLAN milestone 6), which
 * only appears once two or more people have a published entry the viewer can
 * see; otherwise the homepage stays exactly as it was for one person.
 */
export async function listPeopleWithVisibleEntries(db: Database, viewer: Viewer, now: string) {
	const where = entryVisibilityWhere(viewer, now);
	const personIdRows = await db
		.selectDistinct({ personId: schema.entries.personId })
		.from(schema.entries)
		.where(where);
	const personIds = personIdRows.map((r) => r.personId);
	if (personIds.length === 0) return [];

	return db.select(publicPersonColumns).from(schema.people).where(inArray(schema.people.id, personIds));
}

/** Studio-only: every follow request (pending/approved/revoked) for one person, newest first. */
export async function listFollowersForPerson(db: Database, personId: number) {
	return db.select().from(schema.follows).where(eq(schema.follows.personId, personId)).orderBy(desc(schema.follows.createdAt));
}

// Photo-only, display-safe columns for the slideshow (src/lib/slideshow.ts).
// Scoped to kind 'photo' at the query itself - clips/audio/pdf are out of
// scope for this feature, never fetched then hidden. Deliberately narrower
// than publicMediaColumns: no kind/posterKey/durationMs/sortOrder, since
// those only matter for video or for ordering within one entry, which this
// cross-entry, cross-person-safe query handles itself.
const publicSlideshowMediaColumns = {
	id: schema.media.id,
	entryId: schema.media.entryId,
	keyDisplay: schema.media.keyDisplay,
	keyLarge: schema.media.keyLarge,
	width: schema.media.width,
	height: schema.media.height,
	caption: schema.media.caption,
	altText: schema.media.altText
} as const;

export interface SlideshowMediaRow {
	id: number;
	entryId: number;
	keyDisplay: string | null;
	keyLarge: string | null;
	width: number | null;
	height: number | null;
	caption: string | null;
	altText: string | null;
	occurredAt: string;
}

export interface SlideshowMediaPage {
	items: SlideshowMediaRow[];
	hasMore: boolean;
}

/**
 * Every published photo from one person this viewer is authorized to see,
 * oldest first (the slideshow tells the journey in the order it was lived -
 * see docs/00_master_project.md's slideshow note). Reuses
 * entryVisibilityWhere, the exact audience filter every other public/family
 * query in this file uses - no parallel rule.
 *
 * Offset paginated rather than keyset: fine at this project's realistic
 * photo counts (studio.md's own storage estimate is a few thousand photos a
 * year across everyone) - keyset pagination would only earn its complexity
 * at a scale this site isn't going to reach. Never returns a total count, so
 * a caller can't learn how many photos are hidden beyond what it already
 * received - only hasMore, which is true/false regardless of why the next
 * page might come back empty (exhausted vs. nothing-authorized).
 */
export async function listMediaForPersonViewer(
	db: Database,
	viewer: Viewer,
	personId: number,
	now: string,
	opts: { offset?: number; limit?: number } = {}
): Promise<SlideshowMediaPage> {
	const offset = Math.max(0, opts.offset ?? 0);
	const limit = Math.max(1, Math.min(opts.limit ?? 24, 60));

	const where = combine(
		eq(schema.entries.personId, personId),
		eq(schema.media.kind, 'photo'),
		entryVisibilityWhere(viewer, now)
	);

	let query = db
		.select({ ...publicSlideshowMediaColumns, occurredAt: schema.entries.occurredAt })
		.from(schema.media)
		.innerJoin(schema.entries, eq(schema.media.entryId, schema.entries.id))
		.$dynamic();
	if (where) query = query.where(where);

	// limit+1 to detect "more exist" without a separate count query.
	const rows = await query
		.orderBy(asc(schema.entries.occurredAt), asc(schema.entries.id), asc(schema.media.sortOrder), asc(schema.media.id))
		.limit(limit + 1)
		.offset(offset);

	return { items: rows.slice(0, limit), hasMore: rows.length > limit };
}
