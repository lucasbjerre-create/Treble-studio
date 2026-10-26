import { defineMiddleware } from 'astro:middleware';
import { env } from 'cloudflare:workers';
import { verifyAccessRequest } from './worker/auth';
import { resolveViewerEmail } from './worker/viewerSession';

export const onRequest = defineMiddleware(async (context, next) => {
	// Milestone 5: resolves a visitor's follower session on every request,
	// not just /studio - fails open to null (a missing/expired/invalid
	// session just means "not logged in," same as never having one). This
	// only ever affects which already-filtered content a page shows, never
	// write access, so failing open here is correct, unlike the Access
	// check below.
	context.locals.viewerEmail = await resolveViewerEmail(context.request, env.VIEWER_SESSION_SECRET);

	if (!context.url.pathname.startsWith('/studio')) return next();

	// Gates every /studio page request, even though Cloudflare Access already
	// sits in front of the same path at the edge (privacy.md, CLAUDE.md hard
	// rule: "Studio and write routes verify the Cloudflare Access JWT in the
	// Worker, even though Access also sits in front"). Fails closed if the
	// Access secrets aren't configured yet, rather than letting requests through.
	const identity = await verifyAccessRequest(context.request, env);
	if (!identity) {
		return new Response('Unauthorized', { status: 403 });
	}

	context.locals.accessEmail = identity.email;
	return next();
});
