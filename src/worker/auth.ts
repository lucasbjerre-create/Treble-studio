import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

export interface AccessIdentity {
	email: string;
}

/**
 * The core check, independent of where the key comes from - split out so
 * tests can inject a local JWKS instead of fetching Access's real
 * certs endpoint over the network.
 */
export async function verifyAccessToken(
	token: string | null,
	getKey: JWTVerifyGetKey,
	options: { issuer: string; audience: string }
): Promise<AccessIdentity | null> {
	if (!token) return null;
	try {
		const { payload } = await jwtVerify(token, getKey, options);
		if (typeof payload.email !== 'string') return null;
		return { email: payload.email };
	} catch {
		return null;
	}
}

// createRemoteJWKSet does its own internal caching of fetched keys; one
// instance per team domain per isolate is enough, so it's cached here too.
const jwksCache = new Map<string, JWTVerifyGetKey>();

function getRemoteJwks(teamDomain: string): JWTVerifyGetKey {
	let jwks = jwksCache.get(teamDomain);
	if (!jwks) {
		jwks = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`));
		jwksCache.set(teamDomain, jwks);
	}
	return jwks;
}

export interface AccessEnv {
	TEAM_DOMAIN?: string;
	POLICY_AUD?: string;
	// Local dev only - see verifyAccessRequest below. Set via .dev.vars
	// (gitignored), never wrangler.jsonc and never `wrangler secret put`.
	DEV_BYPASS_EMAIL?: string;
}

/**
 * Verifies the Cloudflare Access JWT on every studio/write request, even
 * though Access already sits in front (privacy.md, CLAUDE.md hard rule) -
 * this is what actually rejects a request if Access were ever misconfigured.
 * Missing secrets (not deployed/configured yet) fail closed, not open.
 */
export async function verifyAccessRequest(request: Request, env: AccessEnv): Promise<AccessIdentity | null> {
	if (import.meta.env.DEV && env.DEV_BYPASS_EMAIL) {
		return { email: env.DEV_BYPASS_EMAIL };
	}

	const token = request.headers.get('Cf-Access-Jwt-Assertion');
	if (!token || !env.TEAM_DOMAIN || !env.POLICY_AUD) return null;
	return verifyAccessToken(token, getRemoteJwks(env.TEAM_DOMAIN), {
		issuer: env.TEAM_DOMAIN,
		audience: env.POLICY_AUD
	});
}
