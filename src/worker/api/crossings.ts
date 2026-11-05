import { env } from 'cloudflare:workers';
import { Hono } from 'hono';
import { getDb } from '../../db/client';
import {
	getPersonBySlug,
	getPlaceById,
	listConfirmedCrossingsForViewer,
	listCrossingsForPerson,
	listEntriesForCrossing,
	listEntryTranslations,
	listPersonSummariesByIds,
	resolveViewerForPerson,
	type Viewer
} from '../../db/queries';
import { isLocale, type Locale } from '../../i18n/t';
import { resolveEntryText } from '../../lib/translation';
import { resolveViewerEmail } from '../viewerSession';

// Not Access-gated, same shape as slideshowApi - the confirmed, audience-
// filtered crossings for one person's explore map. Viewer is resolved from
// the session cookie, once per crossing PARTICIPANT (not once for the whole
// request), since milestone 5 made 'family' a per-person thing - see the
// comment on listConfirmedCrossingsForViewer in src/db/queries.ts.
export const crossingsApi = new Hono();

crossingsApi.get('/:personSlug', async (c) => {
	const db = getDb();
	const person = await getPersonBySlug(db, 'public', c.req.param('personSlug'));
	// Same response shape for a nonexistent person as "no crossings yet" -
	// never reveals whether a slug exists via a different response shape.
	if (!person) return c.json({ crossings: [] });

	const langParam = c.req.query('lang');
	const lang: Locale = langParam && isLocale(langParam) ? langParam : 'en';

	// listCrossingsForPerson is studio-only (unfiltered), but nothing it
	// returns reaches the response here - it's only used to learn which
	// personIds might need a resolved viewer tier before the real
	// privacy-filtered calls below run. The actual response is built
	// entirely from listConfirmedCrossingsForViewer/listEntriesForCrossing.
	const candidates = (await listCrossingsForPerson(db, person.id)).filter((x) => x.participants.every((p) => p.confirmed));
	if (candidates.length === 0) return c.json({ crossings: [] });

	const participantIds = [...new Set(candidates.flatMap((x) => x.participants.map((p) => p.personId)))];
	const viewerEmail = await resolveViewerEmail(c.req.raw, env.VIEWER_SESSION_SECRET);
	const viewerByPerson = new Map<number, Viewer>(
		await Promise.all(participantIds.map(async (id) => [id, await resolveViewerForPerson(db, viewerEmail, id)] as const))
	);

	const now = new Date().toISOString();
	const visible = await listConfirmedCrossingsForViewer(db, viewerByPerson, now, { personId: person.id });

	const people = await listPersonSummariesByIds(db, [...new Set(visible.flatMap((x) => x.personIds))]);

	const crossings = await Promise.all(
		visible.map(async (crossing) => {
			const place = await getPlaceById(db, 'public', crossing.placeId);
			const entries = await listEntriesForCrossing(db, viewerByPerson, crossing, now);
			const translations = await listEntryTranslations(
				db,
				entries.map((e) => e.id),
				lang
			);
			return {
				id: crossing.id,
				lon: place?.lonPublic ?? null,
				lat: place?.latPublic ?? null,
				startsOn: crossing.startsOn,
				endsOn: crossing.endsOn,
				entries: entries.map((entry) => {
					const resolved = resolveEntryText(
						{ originalLang: entry.originalLang, title: entry.title, dek: entry.dek, bodyMd: entry.bodyMd },
						translations.get(entry.id),
						lang
					);
					const summary = people.get(entry.personId);
					return {
						personId: entry.personId,
						personSlug: summary?.slug ?? '',
						displayName: summary?.displayName ?? '',
						seat: summary?.seat ?? null,
						slug: entry.slug,
						title: resolved.title,
						occurredAt: entry.occurredAt
					};
				})
			};
		})
	);

	// A crossing's place has no public coordinates (e.g. precision 'hidden')
	// or has zero visible entries once drilled into - never render a marker
	// for either case.
	return c.json({ crossings: crossings.filter((x) => x.lon !== null && x.lat !== null && x.entries.length > 0) });
});
