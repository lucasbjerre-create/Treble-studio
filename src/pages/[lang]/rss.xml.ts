import type { APIRoute } from 'astro';
import { getDb } from '../../db/client';
import { getPersonBySlug, listEntriesForViewer, listEntryTranslations } from '../../db/queries';
import { PRIMARY_PERSON_SLUG, SITE_URL } from '../../config/site';
import { isLocale, t, type Locale } from '../../i18n/t';
import { resolveEntryText } from '../../lib/translation';

export const prerender = false;

// Public entries only, per language (task 7 / spec section 7: "RSS feed
// generated for free"). Never the family/private/delayed tiers - this is the
// same public viewer and entryVisibilityWhere every other public page uses,
// not a separate, easier-to-get-wrong filter.
function xmlEscape(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

export const GET: APIRoute = async ({ params }) => {
	const rawLang = params.lang;
	if (!rawLang || !isLocale(rawLang)) {
		return new Response('Not found', { status: 404 });
	}
	const lang = rawLang as Locale;
	const dict = t(lang);

	const db = getDb();
	const now = new Date().toISOString();

	const person = await getPersonBySlug(db, 'public', PRIMARY_PERSON_SLUG);
	if (!person) return new Response('Not found', { status: 404 });

	const entries = await listEntriesForViewer(db, 'public', now, { personId: person.id });
	const limited = entries.slice(0, 30);
	const translations = await listEntryTranslations(
		db,
		limited.map((e) => e.id),
		lang
	);

	const items = limited
		.map((entry) => {
			const resolved = resolveEntryText(
				{ originalLang: entry.originalLang, title: entry.title, dek: entry.dek, bodyMd: entry.bodyMd },
				translations.get(entry.id),
				lang
			);
			const link = `${SITE_URL}/${lang}/${person.slug}/${entry.slug}`;
			return `
	<item>
		<title>${xmlEscape(resolved.title)}</title>
		<link>${xmlEscape(link)}</link>
		<guid isPermaLink="true">${xmlEscape(link)}</guid>
		<pubDate>${new Date(entry.publishedAt ?? entry.occurredAt).toUTCString()}</pubDate>
		${resolved.dek ? `<description>${xmlEscape(resolved.dek)}</description>` : ''}
	</item>`;
		})
		.join('');

	const feedUrl = `${SITE_URL}/${lang}/rss.xml`;
	const siteUrl = `${SITE_URL}/${lang}/`;
	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
	<title>${xmlEscape(dict.siteTitle)}</title>
	<link>${xmlEscape(siteUrl)}</link>
	<atom:link href="${xmlEscape(feedUrl)}" rel="self" type="application/rss+xml" />
	<description>${xmlEscape(dict.siteTitle)}</description>
	<language>${lang}</language>${items}
</channel>
</rss>
`;

	return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
