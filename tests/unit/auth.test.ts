import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';
import { verifyAccessToken } from '../../src/worker/auth';

const ISSUER = 'https://lucas.cloudflareaccess.com';
const AUDIENCE = 'test-aud-tag';

let privateKey: CryptoKey;
let localJwks: ReturnType<typeof createLocalJWKSet>;

beforeAll(async () => {
	const { privateKey: priv, publicKey } = await generateKeyPair('RS256');
	privateKey = priv;
	const jwk = await exportJWK(publicKey);
	localJwks = createLocalJWKSet({ keys: [{ ...jwk, kid: 'test-key', alg: 'RS256' }] });
});

async function signToken(overrides: { issuer?: string; audience?: string; email?: string; expired?: boolean } = {}) {
	const jwt = new SignJWT({ email: overrides.email ?? 'lucasbjerre@gmail.com' })
		.setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
		.setIssuedAt()
		.setIssuer(overrides.issuer ?? ISSUER)
		.setAudience(overrides.audience ?? AUDIENCE);
	if (overrides.expired) {
		jwt.setExpirationTime('-1h');
	} else {
		jwt.setExpirationTime('1h');
	}
	return jwt.sign(privateKey);
}

describe('verifyAccessToken', () => {
	it('returns null when there is no token', async () => {
		expect(await verifyAccessToken(null, localJwks, { issuer: ISSUER, audience: AUDIENCE })).toBeNull();
	});

	it('accepts a validly signed token and returns the email', async () => {
		const token = await signToken();
		const identity = await verifyAccessToken(token, localJwks, { issuer: ISSUER, audience: AUDIENCE });
		expect(identity).toEqual({ email: 'lucasbjerre@gmail.com' });
	});

	it('rejects a token with the wrong audience', async () => {
		const token = await signToken({ audience: 'some-other-app' });
		expect(await verifyAccessToken(token, localJwks, { issuer: ISSUER, audience: AUDIENCE })).toBeNull();
	});

	it('rejects a token with the wrong issuer', async () => {
		const token = await signToken({ issuer: 'https://attacker.cloudflareaccess.com' });
		expect(await verifyAccessToken(token, localJwks, { issuer: ISSUER, audience: AUDIENCE })).toBeNull();
	});

	it('rejects an expired token', async () => {
		const token = await signToken({ expired: true });
		expect(await verifyAccessToken(token, localJwks, { issuer: ISSUER, audience: AUDIENCE })).toBeNull();
	});

	it('rejects garbage input instead of throwing', async () => {
		expect(await verifyAccessToken('not-a-real-jwt', localJwks, { issuer: ISSUER, audience: AUDIENCE })).toBeNull();
	});

	it('rejects a token with no email claim', async () => {
		const token = await new SignJWT({})
			.setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
			.setIssuedAt()
			.setIssuer(ISSUER)
			.setAudience(AUDIENCE)
			.setExpirationTime('1h')
			.sign(privateKey);
		expect(await verifyAccessToken(token, localJwks, { issuer: ISSUER, audience: AUDIENCE })).toBeNull();
	});
});
