// Resend's REST API via plain fetch - no SDK dependency, same minimal
// approach as src/worker/geocoding.ts. https://resend.com/docs/api-reference/emails/send-email
const RESEND_URL = 'https://api.resend.com/emails';

// Set up once Lucas verifies a sending domain with Resend (see the
// dashboard steps given alongside this change) - matches treble.cordoza.dk,
// the domain the site itself already lives on.
const FROM_ADDRESS = 'Exchange year site <login@treble.cordoza.dk>';

export interface LoginCodeEmail {
	lang: 'da' | 'en';
	email: string;
	code: string;
}

const SUBJECTS = { da: 'Din login-kode', en: 'Your login code' };
const BODIES = {
	da: (code: string) => `<p>Din login-kode er <strong>${code}</strong>. Den udløber om 10 minutter.</p>`,
	en: (code: string) => `<p>Your login code is <strong>${code}</strong>. It expires in 10 minutes.</p>`
};

export async function sendLoginCode({ lang, email, code }: LoginCodeEmail, apiKey: string): Promise<boolean> {
	const res = await fetch(RESEND_URL, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			from: FROM_ADDRESS,
			to: [email],
			subject: SUBJECTS[lang],
			html: BODIES[lang](code)
		})
	});
	return res.ok;
}
