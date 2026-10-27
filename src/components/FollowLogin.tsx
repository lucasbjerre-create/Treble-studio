import { useState } from 'react';
import './FollowLogin.css';

export interface FollowLoginStrings {
	gatedTitle: string;
	gatedBody: string;
	emailLabel: string;
	emailPlaceholder: string;
	requestButton: string;
	requestSent: string;
	codeLabel: string;
	codePlaceholder: string;
	verifyButton: string;
	verifyError: string;
	pending: string;
	reload: string;
	genericError: string;
}

interface Props {
	personSlug: string;
	lang: 'da' | 'en';
	strings: FollowLoginStrings;
}

type Step = 'email' | 'code' | 'done';

/**
 * Combines "ask to follow this person" and "log in" into one flow, since
 * from a visitor's side they're the same request ("let me see more") - a
 * code proves the email is theirs, the follow request is what Lucas
 * actually approves. Reused wherever a page hits family-tier content an
 * unapproved viewer can't see yet.
 */
export default function FollowLogin({ personSlug, lang, strings }: Props) {
	const [step, setStep] = useState<Step>('email');
	const [email, setEmail] = useState('');
	const [code, setCode] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	async function requestCode() {
		setSubmitting(true);
		setError(null);
		try {
			await fetch('/api/viewer/follow', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, personSlug })
			});
			const res = await fetch('/api/viewer/request-code', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, lang })
			});
			if (!res.ok) throw new Error();
			setStep('code');
		} catch {
			setError(strings.genericError);
		} finally {
			setSubmitting(false);
		}
	}

	async function verifyCode() {
		setSubmitting(true);
		setError(null);
		try {
			const res = await fetch('/api/viewer/verify-code', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, code })
			});
			if (!res.ok) throw new Error();
			// Not an automatic reload: if the follow is still pending, reloading
			// immediately would just show this same gated prompt again, which
			// reads as "it didn't work" - showing the pending message directly
			// is clearer, and a real approval is checked next time they visit.
			setStep('done');
		} catch {
			setError(strings.verifyError);
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<div className="follow-login">
			<h2>{strings.gatedTitle}</h2>
			{step !== 'done' && <p>{strings.gatedBody}</p>}

			{step === 'email' && (
				<form
					onSubmit={(e) => {
						e.preventDefault();
						void requestCode();
					}}
				>
					<label>
						{strings.emailLabel}
						<input
							type="email"
							required
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							placeholder={strings.emailPlaceholder}
						/>
					</label>
					<button type="submit" disabled={submitting}>
						{strings.requestButton}
					</button>
				</form>
			)}

			{step === 'code' && (
				<>
					<p className="hint">{strings.requestSent}</p>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							void verifyCode();
						}}
					>
						<label>
							{strings.codeLabel}
							<input
								inputMode="numeric"
								pattern="[0-9]*"
								maxLength={6}
								required
								value={code}
								onChange={(e) => setCode(e.target.value)}
								placeholder={strings.codePlaceholder}
							/>
						</label>
						<button type="submit" disabled={submitting}>
							{strings.verifyButton}
						</button>
					</form>
				</>
			)}

			{step === 'done' && (
				<>
					<p className="hint">{strings.pending}</p>
					<button type="button" onClick={() => window.location.reload()}>
						{strings.reload}
					</button>
				</>
			)}

			{error && <p className="error">{error}</p>}
		</div>
	);
}
