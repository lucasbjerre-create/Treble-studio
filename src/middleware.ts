import { defineMiddleware } from 'astro:middleware';
import { env } from 'cloudflare:workers';
import { verifyAccessRequest } from './worker/auth';

// Gates every /studio page request, even though Cloudflare Access already
// sits in front of the same path at the edge (privacy.md, CLAUDE.md hard
// rule: "Studio and write routes verify the Cloudflare Access JWT in the
// Worker, even though Access also sits in front"). Fails closed if the
// Access secrets aren't configured yet, rather than letting requests through.
export const onRequest = defineMiddleware(async (context, next) => {
	if (!context.url.pathname.startsWith('/studio')) return next();

	const identity = await verifyAccessRequest(context.request, env);
	if (!identity) {
		return new Response('Unauthorized', { status: 403 });
	}

	context.locals.accessEmail = identity.email;
	return next();
});
