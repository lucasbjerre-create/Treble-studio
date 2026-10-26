import { jwtVerify, SignJWT } from 'jose';

const COOKIE_NAME = 'viewer_session';
const SESSION_DAYS = 30;

function secretKey(secret: string): Uint8Array {
	return new TextEncoder().encode(secret);
}

export async function mintViewerSession(email: string, secret: string): Promise<string> {
	return new SignJWT({ email })
		.setProtectedHeader({ alg: 'HS256' })
		.setIssuedAt()
		.setExpirationTime(`${SESSION_DAYS}d`)
		.sign(secretKey(secret));
}

/** Core check, independent of where the cookie comes from - mirrors src/worker/auth.ts's split for the same testability reason. */
export async function verifyViewerSessionToken(token: string | null, secret: string): Promise<string | null> {
	if (!token) return null;
	try {
		const { payload } = await jwtVerify(token, secretKey(secret));
		return typeof payload.email === 'string' ? payload.email : null;
	} catch {
		return null;
	}
}

function parseCookie(cookieHeader: string | null, name: string): string | null {
	if (!cookieHeader) return null;
	for (const part of cookieHeader.split(';')) {
		const [key, ...rest] = part.trim().split('=');
		if (key === name) return decodeURIComponent(rest.join('='));
	}
	return null;
}

/**
 * Resolves the viewer's email from the request cookie - fails open to null
 * (treated as a public viewer), never closed. This only ever widens or
 * narrows which already-published content is visible, not write access, so
 * an invalid/expired/missing session is simply "not a follower yet," not an
 * error.
 */
export async function resolveViewerEmail(request: Request, secret: string | undefined): Promise<string | null> {
	if (!secret) return null;
	const token = parseCookie(request.headers.get('Cookie'), COOKIE_NAME);
	return verifyViewerSessionToken(token, secret);
}

export function viewerSessionCookie(token: string): string {
	const maxAge = SESSION_DAYS * 24 * 60 * 60;
	return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}
