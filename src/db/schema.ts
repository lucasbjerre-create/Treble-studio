import {
	type AnySQLiteColumn,
	index,
	integer,
	primaryKey,
	real,
	sqliteTable,
	text,
	uniqueIndex
} from 'drizzle-orm/sqlite-core';

export const people = sqliteTable('people', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	slug: text('slug').notNull().unique(),
	displayName: text('display_name').notNull(),
	email: text('email'),
	role: text('role').notNull(),
	routeColor: text('route_color'),
	// Scholar colour now comes from a seat (1-16, src/styles/tokens.css's
	// [data-seat] rules), not routeColor - OVERNIGHT.md brand decision 5.
	// Assigned alphabetically by surname at launch and never reshuffled.
	seat: integer('seat'),
	createdAt: text('created_at').notNull()
});

export const chapters = sqliteTable(
	'chapters',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		personId: integer('person_id')
			.notNull()
			.references(() => people.id),
		slug: text('slug').notNull(),
		title: text('title').notNull(),
		startsOn: text('starts_on').notNull(),
		endsOn: text('ends_on'),
		sortOrder: integer('sort_order').notNull().default(0)
	},
	(t) => [
		index('chapters_person_id_idx').on(t.personId),
		uniqueIndex('chapters_person_slug_unique').on(t.personId, t.slug)
	]
);

export const places = sqliteTable('places', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	label: text('label').notNull(),
	countryCode: text('country_code'),
	latPrivate: real('lat_private'),
	lonPrivate: real('lon_private'),
	latPublic: real('lat_public'),
	lonPublic: real('lon_public'),
	precision: text('precision', { enum: ['exact', 'area', 'city', 'hidden'] }).notNull()
});

export const trips = sqliteTable(
	'trips',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		personId: integer('person_id')
			.notNull()
			.references(() => people.id),
		title: text('title').notNull(),
		startsOn: text('starts_on').notNull(),
		endsOn: text('ends_on'),
		summary: text('summary'),
		coverMediaId: integer('cover_media_id').references((): AnySQLiteColumn => media.id)
	},
	(t) => [index('trips_person_id_idx').on(t.personId), index('trips_cover_media_id_idx').on(t.coverMediaId)]
);

export const tripParticipants = sqliteTable(
	'trip_participants',
	{
		tripId: integer('trip_id')
			.notNull()
			.references(() => trips.id),
		personId: integer('person_id')
			.notNull()
			.references(() => people.id)
	},
	(t) => [primaryKey({ columns: [t.tripId, t.personId] }), index('trip_participants_person_id_idx').on(t.personId)]
);

export const legs = sqliteTable(
	'legs',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		tripId: integer('trip_id')
			.notNull()
			.references(() => trips.id),
		personId: integer('person_id')
			.notNull()
			.references(() => people.id),
		fromPlaceId: integer('from_place_id')
			.notNull()
			.references(() => places.id),
		toPlaceId: integer('to_place_id')
			.notNull()
			.references(() => places.id),
		startsAt: text('starts_at').notNull(),
		endsAt: text('ends_at'),
		mode: text('mode', { enum: ['walk', 'car', 'bus', 'train', 'ferry', 'flight'] }).notNull(),
		geometryJson: text('geometry_json')
	},
	(t) => [
		index('legs_trip_id_idx').on(t.tripId),
		index('legs_person_id_idx').on(t.personId),
		index('legs_from_place_id_idx').on(t.fromPlaceId),
		index('legs_to_place_id_idx').on(t.toPlaceId)
	]
);

export const entries = sqliteTable(
	'entries',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		personId: integer('person_id')
			.notNull()
			.references(() => people.id),
		chapterId: integer('chapter_id').references(() => chapters.id),
		tripId: integer('trip_id').references((): AnySQLiteColumn => trips.id),
		placeId: integer('place_id').references(() => places.id),
		slug: text('slug').notNull(),
		format: text('format', {
			enum: ['remark', 'moment', 'clip', 'note', 'feature', 'recap', 'postcard', 'milestone']
		}).notNull(),
		category: text('category', { enum: ['life', 'school', 'trip'] }).notNull(),
		arcStage: text('arc_stage', {
			enum: ['arrival', 'disorientation', 'routine', 'belonging', 'leaving']
		}),
		status: text('status', {
			enum: ['inbox', 'draft', 'uploading', 'ready', 'published', 'archived']
		}).notNull(),
		// Family first: new entries default to family, public is opt in per entry (BUILD_PLAN.md provisional default).
		audience: text('audience', { enum: ['private', 'family', 'public'] }).notNull().default('family'),
		originalLang: text('original_lang', { enum: ['da', 'en'] }).notNull(),
		title: text('title').notNull(),
		dek: text('dek'),
		bodyMd: text('body_md'),
		occurredAt: text('occurred_at').notNull(),
		endedAt: text('ended_at'),
		timezone: text('timezone').notNull(),
		publishAfter: text('publish_after'),
		consentStatus: text('consent_status', {
			enum: ['not_needed', 'asked', 'yes_family', 'yes_public', 'declined']
		})
			.notNull()
			.default('not_needed'),
		featured: integer('featured', { mode: 'boolean' }).notNull().default(false),
		groupMapOptIn: integer('group_map_opt_in', { mode: 'boolean' }).notNull().default(false),
		cameraJson: text('camera_json'),
		createdAt: text('created_at').notNull(),
		updatedAt: text('updated_at').notNull(),
		publishedAt: text('published_at')
	},
	(t) => [
		index('entries_person_occurred_idx').on(t.personId, t.occurredAt),
		index('entries_status_published_idx').on(t.status, t.publishedAt),
		index('entries_chapter_id_idx').on(t.chapterId),
		index('entries_trip_id_idx').on(t.tripId),
		index('entries_place_id_idx').on(t.placeId),
		// Slugs are unique per person, not globally - the URL is /[lang]/[person]/[slug].
		uniqueIndex('entries_person_slug_unique').on(t.personId, t.slug)
	]
);

export const media = sqliteTable(
	'media',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		entryId: integer('entry_id')
			.notNull()
			.references((): AnySQLiteColumn => entries.id),
		ownerId: integer('owner_id')
			.notNull()
			.references(() => people.id),
		kind: text('kind', { enum: ['photo', 'clip', 'audio', 'pdf'] }).notNull(),
		keyThumb: text('key_thumb'),
		keyDisplay: text('key_display'),
		keyLarge: text('key_large'),
		posterKey: text('poster_key'),
		mime: text('mime'),
		width: integer('width'),
		height: integer('height'),
		durationMs: integer('duration_ms'),
		bytes: integer('bytes'),
		capturedAt: text('captured_at'),
		caption: text('caption'),
		altText: text('alt_text'),
		sha256: text('sha256'),
		phash: text('phash'),
		// Raw EXIF read client-side before resizing (studio.md: "store the
		// result on the media row, privately"). Never selected for public/
		// family viewers - same pattern as sha256/phash in src/db/queries.ts.
		exifJson: text('exif_json'),
		sortOrder: integer('sort_order').notNull().default(0)
	},
	(t) => [index('media_entry_id_idx').on(t.entryId), index('media_owner_id_idx').on(t.ownerId)]
);

export const tags = sqliteTable('tags', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	slug: text('slug').notNull().unique(),
	label: text('label').notNull()
});

export const entryTags = sqliteTable(
	'entry_tags',
	{
		entryId: integer('entry_id')
			.notNull()
			.references(() => entries.id),
		tagId: integer('tag_id')
			.notNull()
			.references(() => tags.id)
	},
	(t) => [primaryKey({ columns: [t.entryId, t.tagId] }), index('entry_tags_tag_id_idx').on(t.tagId)]
);

export const assignments = sqliteTable('assignments', {
	entryId: integer('entry_id')
		.primaryKey()
		.references(() => entries.id),
	institution: text('institution'),
	course: text('course'),
	role: text('role'),
	team: text('team'),
	publicSummary: text('public_summary'),
	documentKey: text('document_key'),
	artifactAudience: text('artifact_audience', { enum: ['private', 'family', 'public'] })
});

export const inboxItems = sqliteTable(
	'inbox_items',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		ownerId: integer('owner_id')
			.notNull()
			.references(() => people.id),
		createdAt: text('created_at').notNull(),
		source: text('source').notNull(),
		text: text('text'),
		latPrivate: real('lat_private'),
		lonPrivate: real('lon_private'),
		mediaKeysJson: text('media_keys_json'),
		status: text('status').notNull()
	},
	(t) => [index('inbox_items_owner_id_idx').on(t.ownerId)]
);

export const reactions = sqliteTable(
	'reactions',
	{
		entryId: integer('entry_id')
			.notNull()
			.references(() => entries.id),
		// The three reaction labels are still open (spec section 14.11), so no enum yet.
		kind: text('kind').notNull(),
		count: integer('count').notNull().default(0)
	},
	(t) => [primaryKey({ columns: [t.entryId, t.kind] })]
);

export const questions = sqliteTable(
	'questions',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		entryId: integer('entry_id')
			.notNull()
			.references(() => entries.id),
		name: text('name'),
		text: text('text').notNull(),
		createdAt: text('created_at').notNull(),
		status: text('status').notNull()
	},
	(t) => [index('questions_entry_id_idx').on(t.entryId)]
);

export const reviewEvents = sqliteTable(
	'review_events',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		entryId: integer('entry_id')
			.notNull()
			.references(() => entries.id),
		actorId: integer('actor_id').references(() => people.id),
		fromStatus: text('from_status'),
		toStatus: text('to_status').notNull(),
		note: text('note'),
		createdAt: text('created_at').notNull()
	},
	(t) => [index('review_events_entry_id_idx').on(t.entryId), index('review_events_actor_id_idx').on(t.actorId)]
);

export const entryTexts = sqliteTable(
	'entry_texts',
	{
		entryId: integer('entry_id')
			.notNull()
			.references(() => entries.id),
		lang: text('lang', { enum: ['da', 'en'] }).notNull(),
		title: text('title'),
		dek: text('dek'),
		bodyMd: text('body_md'),
		status: text('status', { enum: ['draft', 'approved'] }).notNull().default('draft')
	},
	(t) => [primaryKey({ columns: [t.entryId, t.lang] })]
);

export const mediaTexts = sqliteTable(
	'media_texts',
	{
		mediaId: integer('media_id')
			.notNull()
			.references(() => media.id),
		lang: text('lang', { enum: ['da', 'en'] }).notNull(),
		caption: text('caption'),
		altText: text('alt_text'),
		status: text('status', { enum: ['draft', 'approved'] }).notNull().default('draft')
	},
	(t) => [primaryKey({ columns: [t.mediaId, t.lang] })]
);
