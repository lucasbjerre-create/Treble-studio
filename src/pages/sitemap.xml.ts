import type { APIRoute } from 'astro';
import { getDb } from '../db/client';
import { getPersonBySlug, listEntriesForViewer } from '../db/queries';
import { PRIMARY_PERSON_SLUG, SITE_URL } from '../config/site';
import { LOCALES } from '../i18n/t';

export const prerender = false;

// Public entries only, in both languages - same privacy boundary as
// rss.xml.ts and every other public page (listEntriesForViewer's 'public'
// viewer). A private, family-only or still-delayed entry must never leak
// its URL here, even just as a link with no content (privacy.md).
export const GET: APIRoute = async () => {
	const db = getDb();
	const now = new Date().toISOString();

	const person = await getPersonBySlug(db, 'public', PRIMARY_PERSON_SLUG);
	const entries = person ? await listEntriesForViewer(db, 'public', now, { personId: person.id }) : [];

	const staticPaths = ['', 'journal', 'archive', 'explore'];

	const urls: string[] = [];
	for (const lang of LOCALES) {
		for (const path of staticPaths) {
			urls.push(`${SITE_URL}/${lang}/${path}`);
		}
		if (person) {
			for (const entry of entries) {
				urls.push(`${SITE_URL}/${lang}/${person.slug}/${entry.slug}`);
			}
		}
	}

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `	<url><loc>${url}</loc></url>`).join('\n')}
</urlset>
`;

	return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
