-- Fictional fixture journey, per docs/BUILD_PLAN.md milestone 1.
-- Fixed ids + INSERT OR IGNORE make this safe to run more than once
-- (CLAUDE.md: "Seed runs twice without duplicating data").
-- All text and media keys are placeholders - no real content (CLAUDE.md:
-- "Real personal content never goes into seeds, fixtures or tests").

-- email is real (it's how studio auth resolves the Access-verified writer to
-- a person row), everything else about this fixture person stays fictional.
INSERT OR IGNORE INTO people (id, slug, display_name, email, role, route_color, seat, created_at)
VALUES (1, 'lucas', 'Lucas (fixture)', 'lucasbjerre@gmail.com', 'scholar', '#b3473f', 1, '2026-08-01T00:00:00.000Z');

-- Fictional second scholar (OVERNIGHT.md brand decision 5 / BUILD_PLAN.md
-- milestone 6 pilot) - entirely fictional, including the email, unlike
-- Lucas's row above. Seat order is a placeholder until Lucas settles it.
INSERT OR IGNORE INTO people (id, slug, display_name, email, role, route_color, seat, created_at)
VALUES (2, 'anna', 'Anna (fixture)', 'anna.fixture@example.test', 'scholar', NULL, 2, '2026-08-01T00:00:00.000Z');

-- Idempotent even on a database seeded before the `seat` column existed.
UPDATE people SET seat = 1 WHERE slug = 'lucas';
UPDATE people SET seat = 2 WHERE slug = 'anna';

INSERT OR IGNORE INTO chapters (id, person_id, slug, title, starts_on, ends_on, sort_order)
VALUES
	(1, 1, 'unc', 'UNC - Fall 2026', '2026-08-15', '2026-12-15', 0),
	(2, 2, 'unc', 'UNC - Fall 2026', '2026-08-15', '2026-12-15', 0);

INSERT OR IGNORE INTO places (id, label, country_code, lat_private, lon_private, lat_public, lon_public, precision)
VALUES
	(1, 'Copenhagen', 'DK', 55.6761, 12.5683, 55.67, 12.56, 'city'),
	(2, 'Chapel Hill', 'US', 35.9132, -79.0558, 35.9, -79.05, 'city'),
	(3, 'Asheville', 'US', 35.5951, -82.5515, 35.6, -82.55, 'city');

INSERT OR IGNORE INTO trips (id, person_id, title, starts_on, ends_on, summary, cover_media_id)
VALUES
	(1, 1, 'Moving to Chapel Hill', '2026-08-15', '2026-08-16', 'Leaving Copenhagen and arriving at UNC.', NULL),
	(2, 1, 'Weekend in Asheville', '2026-09-19', '2026-09-20', 'A weekend trip out of Chapel Hill.', NULL),
	(3, 2, 'Moving to Chapel Hill', '2026-08-15', '2026-08-16', 'Anna''s own flight out, same week as Lucas.', NULL),
	-- Same dates as Lucas's trip 2, same place (Asheville) - the fixture
	-- overlap src/lib/crossings.ts (task 4 tonight) is meant to suggest.
	(4, 2, 'Weekend in Asheville', '2026-09-19', '2026-09-20', 'Also out of Chapel Hill that weekend.', NULL);

INSERT OR IGNORE INTO trip_participants (trip_id, person_id)
VALUES (1, 1), (2, 1), (3, 2), (4, 2);

INSERT OR IGNORE INTO legs (id, trip_id, person_id, from_place_id, to_place_id, starts_at, ends_at, mode, geometry_json)
VALUES
	(1, 1, 1, 1, 2, '2026-08-15T14:00:00.000Z', '2026-08-16T02:00:00.000Z', 'flight', NULL),
	(2, 2, 1, 2, 3, '2026-09-19T15:00:00.000Z', '2026-09-19T18:00:00.000Z', 'car', NULL),
	(3, 2, 1, 3, 2, '2026-09-20T17:00:00.000Z', '2026-09-20T20:00:00.000Z', 'car', NULL),
	(4, 3, 2, 1, 2, '2026-08-15T16:30:00.000Z', '2026-08-16T04:30:00.000Z', 'flight', NULL),
	(5, 4, 2, 2, 3, '2026-09-19T16:00:00.000Z', '2026-09-19T19:00:00.000Z', 'car', NULL),
	(6, 4, 2, 3, 2, '2026-09-20T18:00:00.000Z', '2026-09-20T21:00:00.000Z', 'car', NULL);

-- Entries: leaving Copenhagen, arriving in Chapel Hill, a weekend trip, one
-- school entry, two remarks, one entry still inside its publish delay, one
-- private draft.
INSERT OR IGNORE INTO entries (
	id, person_id, chapter_id, trip_id, place_id, slug, format, category, arc_stage,
	status, audience, original_lang, title, dek, body_md, occurred_at, ended_at,
	timezone, publish_after, consent_status, featured, group_map_opt_in, camera_json,
	created_at, updated_at, published_at
) VALUES
	(
		1, 1, 1, 1, 1, 'leaving-copenhagen', 'milestone', 'life', 'leaving',
		'published', 'public', 'da', 'Tak for nu, København', 'Sidste dag hjemme.',
		'Sidste pakning, sidste kop kaffe ved køkkenbordet, så lufthavnen.',
		'2026-08-15T09:00:00.000Z', NULL, 'Europe/Copenhagen', '2026-08-17T09:00:00.000Z',
		'not_needed', 1, 0, NULL, '2026-08-15T09:00:00.000Z', '2026-08-15T09:00:00.000Z',
		'2026-08-17T09:00:00.000Z'
	),
	(
		2, 1, 1, 1, 2, 'arriving-in-chapel-hill', 'milestone', 'life', 'arrival',
		'published', 'public', 'en', 'Landed in Chapel Hill', 'Jet lag and a new key.',
		'Placeholder fixture text: the dorm room, the heat, the first American grocery store trip.',
		'2026-08-16T20:00:00.000Z', NULL, 'America/New_York', '2026-08-18T20:00:00.000Z',
		'not_needed', 1, 0, NULL, '2026-08-16T20:00:00.000Z', '2026-08-16T20:00:00.000Z',
		'2026-08-18T20:00:00.000Z'
	),
	(
		3, 1, 1, 2, 3, 'weekend-in-asheville', 'moment', 'trip', 'routine',
		'published', 'family', 'en', 'Weekend in Asheville', NULL,
		'Placeholder fixture text: a weekend road trip to Asheville with two other scholars.',
		'2026-09-20T15:00:00.000Z', NULL, 'America/New_York', '2026-09-22T15:00:00.000Z',
		'not_needed', 0, 0, NULL, '2026-09-20T15:00:00.000Z', '2026-09-20T15:00:00.000Z',
		'2026-09-22T15:00:00.000Z'
	),
	(
		4, 1, 1, NULL, 2, 'first-econ-assignment', 'note', 'school', 'routine',
		'published', 'family', 'en', 'First econ assignment', NULL,
		'Placeholder fixture text: notes on a first group assignment.',
		'2026-08-20T14:00:00.000Z', NULL, 'America/New_York', NULL,
		'not_needed', 0, 0, NULL, '2026-08-20T14:00:00.000Z', '2026-08-20T14:00:00.000Z',
		'2026-08-20T14:00:00.000Z'
	),
	(
		5, 1, 1, NULL, 2, 'remark-grocery-store', 'remark', 'life', 'disorientation',
		'published', 'family', 'en', 'Grocery store sticker shock', NULL,
		'Placeholder fixture text: a short remark about grocery prices.',
		'2026-09-01T18:00:00.000Z', NULL, 'America/New_York', NULL,
		'not_needed', 0, 0, NULL, '2026-09-01T18:00:00.000Z', '2026-09-01T18:00:00.000Z',
		'2026-09-01T18:00:00.000Z'
	),
	(
		6, 1, 1, NULL, 2, 'remark-laundry', 'remark', 'life', 'disorientation',
		'published', 'family', 'en', 'Learning the laundry machines', NULL,
		'Placeholder fixture text: a short remark about dorm laundry.',
		'2026-09-05T19:00:00.000Z', NULL, 'America/New_York', NULL,
		'not_needed', 0, 0, NULL, '2026-09-05T19:00:00.000Z', '2026-09-05T19:00:00.000Z',
		'2026-09-05T19:00:00.000Z'
	),
	(
		7, 1, 1, NULL, 2, 'still-settling-in', 'moment', 'life', 'routine',
		'published', 'public', 'en', 'Still settling in', NULL,
		'Placeholder fixture text: this one is still inside its public delay window.',
		'2026-10-20T10:00:00.000Z', NULL, 'America/New_York', '2099-01-01T00:00:00.000Z',
		'not_needed', 0, 0, NULL, '2026-10-20T10:00:00.000Z', '2026-10-20T10:00:00.000Z',
		'2099-01-01T00:00:00.000Z'
	),
	(
		8, 1, 1, NULL, 2, 'private-draft-thoughts', 'note', 'life', NULL,
		'draft', 'private', 'en', 'Private draft thoughts', NULL,
		'Placeholder fixture text: an unpublished private draft, never meant to go out.',
		'2026-10-22T22:00:00.000Z', NULL, 'America/New_York', NULL,
		'not_needed', 0, 0, NULL, '2026-10-22T22:00:00.000Z', '2026-10-22T22:00:00.000Z',
		NULL
	),
	-- Anna (person 2): arrival, a remark, then the Asheville weekend that
	-- overlaps Lucas's trip 2 in both place and date (task 2 tonight).
	(
		9, 2, 2, 3, 2, 'anna-arriving-in-chapel-hill', 'milestone', 'life', 'arrival',
		'published', 'public', 'en', 'Settling into Chapel Hill', 'A different flight, the same new city.',
		'Placeholder fixture text: Anna''s own arrival, a few hours behind Lucas''s.',
		'2026-08-16T22:00:00.000Z', NULL, 'America/New_York', '2026-08-18T22:00:00.000Z',
		'not_needed', 0, 0, NULL, '2026-08-16T22:00:00.000Z', '2026-08-16T22:00:00.000Z',
		'2026-08-18T22:00:00.000Z'
	),
	(
		10, 2, 2, NULL, 2, 'anna-orientation-week', 'remark', 'life', 'disorientation',
		'published', 'family', 'en', 'Orientation week is a blur', NULL,
		'Placeholder fixture text: a short remark about the first week of orientation.',
		'2026-08-22T17:00:00.000Z', NULL, 'America/New_York', NULL,
		'not_needed', 0, 0, NULL, '2026-08-22T17:00:00.000Z', '2026-08-22T17:00:00.000Z',
		'2026-08-22T17:00:00.000Z'
	),
	(
		11, 2, 2, 4, 3, 'anna-weekend-in-asheville', 'moment', 'trip', 'routine',
		'published', 'public', 'en', 'Also in Asheville this weekend', 'Small world.',
		'Placeholder fixture text: Anna''s group ended up in Asheville the same weekend as Lucas''s, without planning it.',
		'2026-09-19T20:00:00.000Z', NULL, 'America/New_York', '2026-09-21T20:00:00.000Z',
		'not_needed', 0, 0, NULL, '2026-09-19T20:00:00.000Z', '2026-09-19T20:00:00.000Z',
		'2026-09-21T20:00:00.000Z'
	);

INSERT OR IGNORE INTO entry_texts (entry_id, lang, title, dek, body_md, status)
VALUES (
	1, 'en', 'Thanks for now, Copenhagen', 'Last day at home.',
	'Placeholder fixture translation of the Danish original.', 'approved'
);

INSERT OR IGNORE INTO assignments (entry_id, institution, course, role, team, public_summary, document_key, artifact_audience)
VALUES (4, 'UNC Chapel Hill', 'ECON 101', 'student', NULL, 'A first group assignment.', NULL, 'private');

-- Placeholder media for milestone 2's layout work. Real R2-backed, viewer-
-- checked serving is milestone 4 (upload) / 5 (privacy hardening) - these
-- key_* values are plain /fixtures/ paths under public/, not R2 keys, until
-- then. See src/components/Media.astro.
INSERT OR IGNORE INTO media (
	id, entry_id, owner_id, kind, key_thumb, key_display, key_large, poster_key,
	mime, width, height, duration_ms, bytes, captured_at, caption, alt_text,
	sha256, phash, sort_order
) VALUES
	(
		1, 1, 1, 'photo',
		'/fixtures/copenhagen-harbor.svg', '/fixtures/copenhagen-harbor.svg', '/fixtures/copenhagen-harbor.svg',
		NULL, 'image/svg+xml', 1200, 900, NULL, NULL, '2026-08-15T08:30:00.000Z',
		'The harbor, one last time.', 'The Copenhagen harbor on an overcast morning.',
		NULL, NULL, 0
	),
	(
		2, 2, 1, 'photo',
		'/fixtures/chapel-hill-quad.svg', '/fixtures/chapel-hill-quad.svg', '/fixtures/chapel-hill-quad.svg',
		NULL, 'image/svg+xml', 1200, 900, NULL, NULL, '2026-08-16T19:00:00.000Z',
		'The quad, first look.', 'The UNC quad in late summer light.',
		NULL, NULL, 0
	),
	(
		3, 3, 1, 'photo',
		'/fixtures/asheville-overlook.svg', '/fixtures/asheville-overlook.svg', '/fixtures/asheville-overlook.svg',
		NULL, 'image/svg+xml', 1200, 900, NULL, NULL, '2026-09-20T14:00:00.000Z',
		'The overlook outside Asheville.', 'A mountain overlook near Asheville.',
		NULL, NULL, 0
	),
	(
		4, 11, 2, 'photo',
		'/fixtures/asheville-overlook.svg', '/fixtures/asheville-overlook.svg', '/fixtures/asheville-overlook.svg',
		NULL, 'image/svg+xml', 1200, 900, NULL, NULL, '2026-09-19T19:30:00.000Z',
		'Same overlook, different weekend group.', 'A mountain overlook near Asheville, Anna''s photo.',
		NULL, NULL, 0
	);
