import { env } from 'cloudflare:workers';
import { Hono } from 'hono';
import { z } from 'zod';
import { getDb } from '../../db/client';
import { getPersonBySlug, listMediaForPersonViewer, resolveViewerForPerson } from '../../db/queries';
import { resolveViewerEmail } from '../viewerSession';

// Not Access-gated, same as viewerApi - a paginated, audience-filtered photo
// list for the slideshow island (src/components/Slideshow.tsx). Separate
// from mediaApi (which serves one photo's bytes by R2 key): this returns
// the list of keys/dimensions/captions a person's slideshow pages through,
// resolved to URLs client-side via publicMediaUrl. Viewer is resolved from
// the session cookie exactly like middleware.ts does for page requests,
// since Hono routes mounted under /api don't go through Astro.locals.
export const slideshowApi = new Hono();

const pageQuerySchema = z.object({
	offset: z.coerce.number().int().min(0).optional(),
	limit: z.coerce.number().int().min(1).max(60).optional()
});

slideshowApi.get('/:personSlug', async (c) => {
	const parsed = pageQuerySchema.safeParse(c.req.query());
	if (!parsed.success) return c.json({ error: z.flattenError(parsed.error) }, 400);

	const db = getDb();
	const person = await getPersonBySlug(db, 'public', c.req.param('personSlug'));
	// Same response shape for a nonexistent person as an exhausted page -
	// never reveals whether a slug exists via a different response shape.
	if (!person) return c.json({ items: [], hasMore: false });

	const viewerEmail = await resolveViewerEmail(c.req.raw, env.VIEWER_SESSION_SECRET);
	const viewer = await resolveViewerForPerson(db, viewerEmail, person.id);
	const now = new Date().toISOString();

	const page = await listMediaForPersonViewer(db, viewer, person.id, now, {
		offset: parsed.data.offset,
		limit: parsed.data.limit
	});
	return c.json(page);
});
