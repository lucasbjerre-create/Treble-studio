import { env } from 'cloudflare:workers';
import { Hono } from 'hono';
import { getDb } from '../../db/client';
import { findMediaByKeyWithEntry, resolveViewerForPerson } from '../../db/queries';
import { isEntryVisible } from '../../lib/visibility';
import { resolveViewerEmail } from '../viewerSession';

// Not Access-gated (privacy.md: "Family media served through a Worker
// route that checks the viewer" - this is that route for photos/clips,
// studio.ts's /media-file is the separate Access-gated one for Lucas's own
// preview while uploading). Every request still resolves its own viewer and
// checks the owning entry's visibility before ever touching R2 - there's no
// bucket-level public access (privacy.md: r2.dev stays off) and no signed
// URL handed out, so this is the only way a photo ever reaches a browser
// outside /studio.
export const mediaApi = new Hono();

mediaApi.get('/:path{.+}', async (c) => {
	const key = c.req.param('path');

	const db = getDb();
	const row = await findMediaByKeyWithEntry(db, key);
	// Same response whether the key doesn't exist or exists but isn't
	// visible to this viewer - a 403 would confirm a guessed key is real.
	if (!row) return c.notFound();

	const viewerEmail = await resolveViewerEmail(c.req.raw, env.VIEWER_SESSION_SECRET);
	const viewer = await resolveViewerForPerson(db, viewerEmail, row.personId);
	const now = new Date().toISOString();
	if (!isEntryVisible({ status: row.status, audience: row.audience, publishAfter: row.publishAfter }, viewer, now)) {
		return c.notFound();
	}

	const object = await env.MEDIA.get(key);
	if (!object) return c.notFound();

	return new Response(object.body, {
		headers: {
			'Content-Type': object.httpMetadata?.contentType ?? row.mime ?? 'application/octet-stream',
			// private, not public: a family viewer's response depends on their
			// session cookie, so a shared/CDN cache could otherwise serve one
			// family's photo to a different, unauthorized viewer.
			'Cache-Control': 'private, max-age=3600'
		}
	});
});
