import { useEffect, useState } from 'react';
import './EntryEditor.css';
import { resolveEntryText, type Lang } from '../lib/translation';
import PhotoUpload, { type MediaItem, type PhotoGpsHint } from './PhotoUpload';

interface Chapter {
	id: number;
	title: string;
}

interface Place {
	id: number;
	label: string;
	precision: 'exact' | 'area' | 'city' | 'hidden';
}

export interface InitialEntry {
	id: number;
	chapterId: number | null;
	placeId: number | null;
	format: string;
	category: string;
	audience: 'private' | 'family' | 'public';
	originalLang: Lang;
	title: string;
	dek: string | null;
	bodyMd: string | null;
	occurredAt: string;
	timezone: string;
	consentStatus: string;
	status: string;
}

interface Props {
	chapters: Chapter[];
	initialEntry: InitialEntry | null;
	initialMedia: MediaItem[];
}

const CATEGORIES = ['life', 'school', 'trip'];
const AUDIENCES: Array<InitialEntry['audience']> = ['private', 'family', 'public'];
const PRECISIONS: Place['precision'][] = ['exact', 'area', 'city', 'hidden'];
const CONSENTS = ['not_needed', 'asked', 'yes_family', 'yes_public', 'declined'];

// Display only - the stored value stays the lowercase_with_underscores enum.
function consentLabel(value: string): string {
	return value
		.split('_')
		.map((word) => word[0].toUpperCase() + word.slice(1))
		.join(' ');
}

// The three timezones the journey actually moves between - quick buttons
// beat typing an IANA name on a phone. The field stays a free text input too
// for anywhere else (a weekend trip, a layover).
const TIMEZONE_PRESETS: Array<{ label: string; value: string }> = [
	{ label: 'Denmark', value: 'Europe/Copenhagen' },
	{ label: 'North Carolina', value: 'America/New_York' },
	{ label: 'Singapore', value: 'Asia/Singapore' }
];

function nowLocalInputValue(): string {
	const d = new Date();
	const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
	return local.toISOString().slice(0, 16);
}

// Same local-wall-clock conversion as nowLocalInputValue, for an arbitrary
// UTC ISO timestamp (a photo's EXIF capture time, round-tripped through the
// commit response) instead of "now".
function isoToLocalInputValue(iso: string): string {
	const d = new Date(iso);
	const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
	return local.toISOString().slice(0, 16);
}

export default function EntryEditor({ chapters, initialEntry, initialMedia }: Props) {
	const [entryId, setEntryId] = useState<number | null>(initialEntry?.id ?? null);
	const [status, setStatus] = useState(initialEntry?.status ?? 'draft');
	const [places, setPlaces] = useState<Place[]>([]);
	const [media, setMedia] = useState<MediaItem[]>(initialMedia);

	const [title, setTitle] = useState(initialEntry?.title ?? '');
	const [dek, setDek] = useState(initialEntry?.dek ?? '');
	const [bodyMd, setBodyMd] = useState(initialEntry?.bodyMd ?? '');
	const [format, setFormat] = useState(initialEntry?.format ?? 'moment');
	const [category, setCategory] = useState(initialEntry?.category ?? 'life');
	const [chapterId, setChapterId] = useState<number | ''>(initialEntry?.chapterId ?? '');
	const [placeId, setPlaceId] = useState<number | ''>(initialEntry?.placeId ?? '');
	const [audience, setAudience] = useState<InitialEntry['audience']>(initialEntry?.audience ?? 'family');
	const [originalLang, setOriginalLang] = useState<Lang>(initialEntry?.originalLang ?? 'en');
	const [occurredAtLocal, setOccurredAtLocal] = useState(
		initialEntry ? initialEntry.occurredAt.slice(0, 16) : nowLocalInputValue()
	);
	// Whether Lucas has touched the date himself - once he has, a photo's
	// EXIF capture time never overwrites it, even if he adds more photos.
	const [occurredAtTouched, setOccurredAtTouched] = useState(initialEntry !== null);
	const [timezone, setTimezone] = useState(
		initialEntry?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
	);
	const [consentStatus, setConsentStatus] = useState(initialEntry?.consentStatus ?? 'not_needed');

	const [saving, setSaving] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);
	const [saveMessage, setSaveMessage] = useState<string | null>(null);

	const [newPlaceOpen, setNewPlaceOpen] = useState(false);
	const [newPlaceQuery, setNewPlaceQuery] = useState('');
	const [newPlaceLabel, setNewPlaceLabel] = useState('');
	const [newPlacePrecision, setNewPlacePrecision] = useState<Place['precision']>('city');
	const [newPlaceResolved, setNewPlaceResolved] = useState<{ lat: number; lon: number } | null>(null);
	const [newPlaceLookingUp, setNewPlaceLookingUp] = useState(false);
	const [newPlaceLookupError, setNewPlaceLookupError] = useState<string | null>(null);
	// Whether placeId was set by Lucas picking from the dropdown or typing a
	// new place, vs. auto-detected from a photo's GPS - once touched, a later
	// photo's GPS never silently overrides his choice.
	const [placeTouched, setPlaceTouched] = useState(initialEntry?.placeId != null);

	const [reviewOpen, setReviewOpen] = useState(false);
	const [publishing, setPublishing] = useState(false);
	const [publishError, setPublishError] = useState<string | null>(null);

	useEffect(() => {
		fetch('/api/studio/places')
			.then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Could not load places (${r.status})`))))
			.then((rows) => setPlaces(rows as Place[]))
			.catch(() => setSaveError('Could not load places - your session may have expired. Reload the page.'));
	}, []);

	function currentPayload() {
		return {
			chapterId: chapterId === '' ? null : Number(chapterId),
			placeId: placeId === '' ? null : Number(placeId),
			format,
			category,
			audience,
			originalLang,
			// The server requires a non-empty title; a photo-first draft (added
			// before typing anything) needs a placeholder so the silent
			// auto-create succeeds. The Title field itself stays blank so
			// there's an obvious prompt to replace it.
			title: title.trim() || 'Untitled entry',
			dek: dek || null,
			bodyMd: bodyMd || null,
			occurredAt: new Date(occurredAtLocal).toISOString(),
			timezone,
			consentStatus
		};
	}

	async function saveDraft(): Promise<number | null> {
		setSaving(true);
		setSaveError(null);
		setSaveMessage(null);
		try {
			const res = await fetch(entryId ? `/api/studio/entries/${entryId}` : '/api/studio/entries', {
				method: entryId ? 'PATCH' : 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(currentPayload())
			});
			if (!res.ok) throw new Error(`Save failed (${res.status})`);
			const data = (await res.json()) as { id?: number };
			const id = entryId ?? data.id ?? null;
			if (!entryId && id) setEntryId(id);
			setSaveMessage('Draft saved.');
			return id;
		} catch (err) {
			setSaveError(err instanceof Error ? err.message : 'Save failed');
			return null;
		} finally {
			setSaving(false);
		}
	}

	async function lookupPlace() {
		if (!newPlaceQuery.trim()) return;
		setNewPlaceLookingUp(true);
		setNewPlaceLookupError(null);
		try {
			const res = await fetch(`/api/studio/geocode?q=${encodeURIComponent(newPlaceQuery.trim())}`);
			if (!res.ok) throw new Error(res.status === 404 ? 'No match found - try a different spelling' : 'Lookup failed');
			const result = (await res.json()) as { label: string; lat: number; lon: number };
			setNewPlaceResolved({ lat: result.lat, lon: result.lon });
			setNewPlaceLabel(result.label);
		} catch (err) {
			setNewPlaceResolved(null);
			setNewPlaceLookupError(err instanceof Error ? err.message : 'Lookup failed');
		} finally {
			setNewPlaceLookingUp(false);
		}
	}

	function resetNewPlaceForm() {
		setNewPlaceOpen(false);
		setNewPlaceQuery('');
		setNewPlaceLabel('');
		setNewPlaceResolved(null);
		setNewPlaceLookupError(null);
	}

	async function addPlace() {
		if (!newPlaceLabel.trim() || !newPlaceResolved) return;
		const res = await fetch('/api/studio/places', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				label: newPlaceLabel,
				precision: newPlacePrecision,
				latPrivate: newPlaceResolved.lat,
				lonPrivate: newPlaceResolved.lon
			})
		});
		if (!res.ok) return;
		const place = (await res.json()) as Place;
		setPlaces((prev) => [...prev, place]);
		setPlaceId(place.id);
		setPlaceTouched(true);
		resetNewPlaceForm();
	}

	/**
	 * Auto-detects a place from a photo's EXIF GPS, via reverse geocoding -
	 * reuses an existing place with the same label (case-insensitive) rather
	 * than creating a duplicate every time. Defaults new auto-created places
	 * to city-level precision, same as the manual city lookup: GPS is exact,
	 * but an entry's audience may be public, and precision is a privacy
	 * choice Lucas should make deliberately, not one a default silently picks.
	 */
	async function detectPlaceFromGps(gps: PhotoGpsHint) {
		if (placeTouched || gps.latitude == null || gps.longitude == null) return;
		try {
			const res = await fetch(`/api/studio/geocode/reverse?lat=${gps.latitude}&lon=${gps.longitude}`);
			if (!res.ok) return;
			const { label } = (await res.json()) as { label: string };

			const existing = places.find((p) => p.label.toLowerCase() === label.toLowerCase());
			if (existing) {
				setPlaceId(existing.id);
				setPlaceTouched(true);
				return;
			}

			const placeRes = await fetch('/api/studio/places', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ label, precision: 'city', latPrivate: gps.latitude, lonPrivate: gps.longitude })
			});
			if (!placeRes.ok) return;
			const place = (await placeRes.json()) as Place;
			setPlaces((prev) => [...prev, place]);
			setPlaceId(place.id);
			setPlaceTouched(true);
		} catch {
			// Best-effort - Lucas can still pick or add a place by hand.
		}
	}

	async function confirmPublish() {
		setPublishing(true);
		setPublishError(null);
		try {
			const id = entryId ?? (await saveDraft());
			if (!id) throw new Error('Save the draft before publishing');
			const res = await fetch(`/api/studio/entries/${id}/publish`, { method: 'POST' });
			if (!res.ok) throw new Error(`Publish failed (${res.status})`);
			setStatus('published');
			setReviewOpen(false);
		} catch (err) {
			setPublishError(err instanceof Error ? err.message : 'Publish failed');
		} finally {
			setPublishing(false);
		}
	}

	const selectedPlace = places.find((p) => p.id === placeId);
	const otherLang: Lang = originalLang === 'en' ? 'da' : 'en';
	const source = { originalLang, title, dek: dek || null, bodyMd: bodyMd || null };
	const previewOriginal = resolveEntryText(source, undefined, originalLang);
	const previewOther = resolveEntryText(source, undefined, otherLang);

	return (
		<div className="entry-editor">
			<PhotoUpload
				entryId={entryId}
				ensureEntryId={saveDraft}
				media={media}
				onUploaded={(item, gps) => {
					setMedia((prev) => [...prev, item]);
					if (!occurredAtTouched && item.capturedAt) {
						setOccurredAtLocal(isoToLocalInputValue(item.capturedAt));
					}
					void detectPlaceFromGps(gps);
				}}
				onRemoved={(id) => setMedia((prev) => prev.filter((m) => m.id !== id))}
			/>

			<div className="field-grid">
				<label>
					Title
					<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} />
				</label>

				<label>
					Dek (optional)
					<input value={dek} onChange={(e) => setDek(e.target.value)} maxLength={300} />
				</label>

				<label className="full">
					Body
					<textarea value={bodyMd} onChange={(e) => setBodyMd(e.target.value)} rows={8} />
				</label>

				{/* Format and Chapter hidden for now, per Lucas's request - format
				    stays at its default ('moment'), chapterId stays unset (null). */}

				<label className="full">
					Tag
					<div className="bubble-row">
						{CATEGORIES.map((c) => (
							<button
								key={c}
								type="button"
								className={category === c ? 'bubble active' : 'bubble'}
								onClick={() => setCategory(c)}
							>
								{c}
							</button>
						))}
					</div>
				</label>

				<label>
					Place
					<select
						value={placeId}
						onChange={(e) => {
							setPlaceTouched(true);
							setPlaceId(e.target.value ? Number(e.target.value) : '');
						}}
					>
						<option value="">None</option>
						{places.map((p) => (
							<option key={p.id} value={p.id}>
								{p.label} ({p.precision})
							</option>
						))}
					</select>
				</label>

				<button
					type="button"
					className="link-button"
					onClick={() => (newPlaceOpen ? resetNewPlaceForm() : setNewPlaceOpen(true))}
				>
					{newPlaceOpen ? 'Cancel new place' : '+ Add a new place'}
				</button>

				{newPlaceOpen && (
					<div className="new-place full">
						<label className="full">
							City
							<div className="city-lookup-row">
								<input
									value={newPlaceQuery}
									onChange={(e) => {
										setNewPlaceQuery(e.target.value);
										setNewPlaceResolved(null);
									}}
									placeholder="e.g. Chapel Hill"
								/>
								<button type="button" onClick={lookupPlace} disabled={newPlaceLookingUp || !newPlaceQuery.trim()}>
									{newPlaceLookingUp ? 'Looking up…' : 'Look up'}
								</button>
							</div>
						</label>
						{newPlaceLookupError && <p className="error">{newPlaceLookupError}</p>}
						{newPlaceResolved && (
							<label className="full">
								Found - name to save it as (edit if you like)
								<input value={newPlaceLabel} onChange={(e) => setNewPlaceLabel(e.target.value)} />
							</label>
						)}
						<label>
							Precision
							<select
								value={newPlacePrecision}
								onChange={(e) => setNewPlacePrecision(e.target.value as Place['precision'])}
							>
								{PRECISIONS.map((p) => (
									<option key={p} value={p}>
										{p}
									</option>
								))}
							</select>
						</label>
						<button type="button" onClick={addPlace} disabled={!newPlaceResolved || !newPlaceLabel.trim()}>
							Save place
						</button>
						<p className="attribution">City lookup by OpenStreetMap / Nominatim.</p>
					</div>
				)}

				<label>
					Audience
					<select value={audience} onChange={(e) => setAudience(e.target.value as InitialEntry['audience'])}>
						{AUDIENCES.map((a) => (
							<option key={a} value={a}>
								{a}
							</option>
						))}
					</select>
				</label>

				<label>
					Consent
					<select value={consentStatus} onChange={(e) => setConsentStatus(e.target.value)}>
						{CONSENTS.map((c) => (
							<option key={c} value={c}>
								{consentLabel(c)}
							</option>
						))}
					</select>
				</label>

				<label>
					Original language
					<select value={originalLang} onChange={(e) => setOriginalLang(e.target.value as Lang)}>
						<option value="en">English</option>
						<option value="da">Dansk</option>
					</select>
				</label>

				<label>
					Occurred at
					<input
						type="datetime-local"
						value={occurredAtLocal}
						onChange={(e) => {
							setOccurredAtTouched(true);
							setOccurredAtLocal(e.target.value);
						}}
					/>
				</label>

				<label className="full">
					Timezone
					<div className="timezone-presets">
						{TIMEZONE_PRESETS.map((preset) => (
							<button
								key={preset.value}
								type="button"
								className={timezone === preset.value ? 'active' : ''}
								onClick={() => setTimezone(preset.value)}
							>
								{preset.label}
							</button>
						))}
					</div>
					<input value={timezone} onChange={(e) => setTimezone(e.target.value)} />
				</label>
			</div>

			<div className="save-row">
				<button type="button" onClick={saveDraft} disabled={saving}>
					{saving ? 'Saving…' : 'Save draft'}
				</button>
				{saveMessage && <span className="ok">{saveMessage}</span>}
				{saveError && <span className="error">{saveError}</span>}
				<span className="status-badge" data-status={status}>
					{status}
				</span>
			</div>

			<div className="publish-row">
				<button type="button" onClick={() => setReviewOpen(true)} disabled={!entryId && !title}>
					Review & publish
				</button>
			</div>

			{reviewOpen && (
				<div className="review-panel" role="dialog" aria-label="Review before publishing">
					<h2>Review before publishing</h2>
					<dl>
						<dt>Audience</dt>
						<dd>
							<span className={`visibility-badge visibility-badge--${audience === 'private' ? 'private' : audience}`}>
								{audience === 'public' ? 'Public' : audience === 'family' ? 'Followers only' : 'Only me'}
							</span>
						</dd>
						<dt>Precision</dt>
						<dd>{selectedPlace?.precision ?? 'no place selected'}</dd>
						<dt>Consent</dt>
						<dd>{consentLabel(consentStatus)}</dd>
					</dl>

					<div className="lang-preview">
						<section>
							<h3>{originalLang.toUpperCase()} (original)</h3>
							<strong>{previewOriginal.title || '(no title)'}</strong>
							{previewOriginal.dek && <p>{previewOriginal.dek}</p>}
						</section>
						<section>
							<h3>{otherLang.toUpperCase()}</h3>
							<strong>{previewOther.title || '(no title)'}</strong>
							{previewOther.dek && <p>{previewOther.dek}</p>}
							{previewOther.isFallback && <p className="note">Not yet translated — shows the original for now.</p>}
						</section>
					</div>

					{publishError && <p className="error">{publishError}</p>}

					<div className="review-actions">
						<button type="button" onClick={confirmPublish} disabled={publishing}>
							{publishing ? 'Publishing…' : 'Confirm publish'}
						</button>
						<button type="button" onClick={() => setReviewOpen(false)} disabled={publishing}>
							Back
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
