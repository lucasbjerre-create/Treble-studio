import { useEffect, useRef, useState } from 'react';
import './EntryEditor.css';
import { DEFAULT_AUDIENCE } from '../config/site';
import { findOrCreatePlaceFromGps } from '../lib/placeFromGps';
import { timezoneFromGps } from '../lib/timezoneFromGps';
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
	starred: boolean;
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
	/** Set when occurredAt is only a guess (e.g. BulkUpload fell back to "now" because no photo date could be detected) - shows the "couldn't detect" warning right away instead of waiting for a photo upload within this session to trigger it. */
	occurredAtUncertain?: boolean;
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
	// Publishing navigates away (confirmPublish) rather than updating this in place, so it never needs to change.
	const status = initialEntry?.status ?? 'draft';
	const [places, setPlaces] = useState<Place[]>([]);
	const [media, setMedia] = useState<MediaItem[]>(initialMedia);

	const [title, setTitle] = useState(initialEntry?.title ?? '');
	const [dek, setDek] = useState(initialEntry?.dek ?? '');
	const [bodyMd, setBodyMd] = useState(initialEntry?.bodyMd ?? '');
	const [format, setFormat] = useState(initialEntry?.format ?? 'moment');
	const [category, setCategory] = useState(initialEntry?.category ?? 'life');
	const [chapterId, setChapterId] = useState<number | ''>(initialEntry?.chapterId ?? '');
	const [placeId, setPlaceId] = useState<number | ''>(initialEntry?.placeId ?? '');
	const [audience, setAudience] = useState<InitialEntry['audience']>(initialEntry?.audience ?? DEFAULT_AUDIENCE);
	const [originalLang, setOriginalLang] = useState<Lang>(initialEntry?.originalLang ?? 'en');
	const [occurredAtLocal, setOccurredAtLocal] = useState(
		initialEntry ? initialEntry.occurredAt.slice(0, 16) : nowLocalInputValue()
	);
	// Whether Lucas has touched the date himself - once he has, a photo's
	// EXIF capture time never overwrites it, even if he adds more photos.
	const [occurredAtTouched, setOccurredAtTouched] = useState(initialEntry !== null);
	// True when occurredAtLocal is only a guess, never confirmed against a
	// photo's own EXIF date - shows a warning instead of letting an
	// undetectable date pass for a real one. Cleared the moment Lucas
	// touches the date himself (same event that sets occurredAtTouched).
	const [dateUncertain, setDateUncertain] = useState(initialEntry?.occurredAtUncertain ?? false);
	const [timezone, setTimezone] = useState(
		initialEntry?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
	);
	// Whether Lucas has touched the timezone himself - once he has, a photo's
	// GPS never silently overrides his choice. Mirrors occurredAtTouched: a
	// brand new entry starts untouched so the first photo's own location (not
	// the phone uploading it) can set it.
	const [timezoneTouched, setTimezoneTouched] = useState(initialEntry !== null);
	const [consentStatus, setConsentStatus] = useState(initialEntry?.consentStatus ?? 'not_needed');

	const [saving, setSaving] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);
	const [saveMessage, setSaveMessage] = useState<string | null>(null);

	const [newPlaceOpen, setNewPlaceOpen] = useState(false);
	const [newPlaceQuery, setNewPlaceQuery] = useState('');
	const [newPlaceLabel, setNewPlaceLabel] = useState('');
	const [newPlacePrecision, setNewPlacePrecision] = useState<Place['precision']>('city');
	const [newPlaceStarred, setNewPlaceStarred] = useState(false);
	const [newPlaceResolved, setNewPlaceResolved] = useState<{ lat: number; lon: number } | null>(null);
	const [newPlaceLookingUp, setNewPlaceLookingUp] = useState(false);
	const [newPlaceLookupError, setNewPlaceLookupError] = useState<string | null>(null);
	const [starring, setStarring] = useState(false);
	// Whether placeId was set by Lucas picking from the dropdown or typing a
	// new place, vs. auto-detected from a photo's GPS - once touched, a later
	// photo's GPS never silently overrides his choice.
	const [placeTouched, setPlaceTouched] = useState(initialEntry?.placeId != null);

	const [reviewOpen, setReviewOpen] = useState(false);
	const [publishing, setPublishing] = useState(false);
	const [publishError, setPublishError] = useState<string | null>(null);

	// Cached across calls (BulkUpload's ensurePlacesLoaded pattern) so GPS
	// detection always matches against the full list instead of racing the
	// initial fetch - without this, a fast upload could create a place
	// before the GET resolved, and the GET's plain overwrite would then wipe
	// the just-detected place back out of the dropdown.
	const placesLoadedRef = useRef<Promise<Place[]> | null>(null);
	function ensurePlacesLoaded(): Promise<Place[]> {
		if (!placesLoadedRef.current) {
			placesLoadedRef.current = fetch('/api/studio/places')
				.then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Could not load places (${r.status})`))))
				.then((rows) => {
					const loaded = rows as Place[];
					setPlaces((prev) => {
						const extra = prev.filter((p) => !loaded.some((l) => l.id === p.id));
						return [...loaded, ...extra];
					});
					return loaded;
				})
				.catch((err) => {
					setSaveError('Could not load places - your session may have expired. Reload the page.');
					throw err;
				});
		}
		return placesLoadedRef.current;
	}

	useEffect(() => {
		ensurePlacesLoaded().catch(() => undefined);
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
		setNewPlaceStarred(false);
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
				lonPrivate: newPlaceResolved.lon,
				starred: newPlaceStarred
			})
		});
		if (!res.ok) return;
		const place = (await res.json()) as Place;
		setPlaces((prev) => [...prev, place]);
		setPlaceId(place.id);
		setPlaceTouched(true);
		resetNewPlaceForm();
	}

	const [renameLabel, setRenameLabel] = useState('');
	const [renaming, setRenaming] = useState(false);
	const [renameError, setRenameError] = useState<string | null>(null);

	/**
	 * Renames the currently selected place's headline label (e.g. a
	 * GPS-guessed "Tinicum Township" to "Philadelphia Airport") without
	 * touching its coordinates or precision - a label is just what to call
	 * the place, the location data stays whatever it already was.
	 */
	async function renamePlace() {
		if (placeId === '' || !renameLabel.trim()) return;
		setRenaming(true);
		setRenameError(null);
		try {
			const res = await fetch(`/api/studio/places/${placeId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ label: renameLabel.trim() })
			});
			if (!res.ok) throw new Error('Rename failed');
			const updated = (await res.json()) as Place;
			setPlaces((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
		} catch (err) {
			setRenameError(err instanceof Error ? err.message : 'Rename failed');
		} finally {
			setRenaming(false);
		}
	}

	/**
	 * Sets a place's studio-only starred shortcut (picker ordering + the
	 * quick-select row below, never location data) - takes the place
	 * explicitly rather than reading selectedPlace, since the quick-select
	 * row's own remove button unstars a place that isn't necessarily the one
	 * currently chosen for this entry.
	 */
	async function setPlaceStarred(place: Place, starred: boolean) {
		setStarring(true);
		try {
			const res = await fetch(`/api/studio/places/${place.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ starred })
			});
			if (!res.ok) return;
			const updated = (await res.json()) as Place;
			setPlaces((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
		} finally {
			setStarring(false);
		}
	}

	/**
	 * Auto-detects a place from a photo's EXIF GPS - best-effort, Lucas can
	 * still pick or add a place by hand if this finds nothing.
	 */
	async function detectPlaceFromGps(gps: PhotoGpsHint) {
		if (placeTouched) return;
		const currentPlaces = await ensurePlacesLoaded().catch(() => places);
		const place = await findOrCreatePlaceFromGps(gps, currentPlaces);
		if (!place) return;
		setPlaces((prev) => (prev.some((p) => p.id === place.id) ? prev : [...prev, place]));
		setPlaceId(place.id);
		setPlaceTouched(true);
	}

	/**
	 * Auto-detects the timezone a photo was actually taken in, from its own
	 * EXIF GPS - never the phone's current timezone (a Danish phone
	 * travelling in the US must not tag a Danish photo as US time).
	 */
	function detectTimezoneFromGps(gps: PhotoGpsHint) {
		if (timezoneTouched) return;
		const tz = timezoneFromGps(gps);
		if (!tz) return;
		setTimezone(tz);
		setTimezoneTouched(true);
	}

	async function confirmPublish() {
		setPublishing(true);
		setPublishError(null);
		try {
			// Always flushes the current form state first, even when entryId
			// already exists - otherwise edits made since the draft was created
			// (title, corrected date, audience, ...) are published without ever
			// having been saved.
			const id = await saveDraft();
			if (!id) throw new Error('Save the draft before publishing');
			const res = await fetch(`/api/studio/entries/${id}/publish`, { method: 'POST' });
			if (!res.ok) throw new Error(`Publish failed (${res.status})`);
			window.location.href = `/studio/entries/${id}/published`;
		} catch (err) {
			setPublishError(err instanceof Error ? err.message : 'Publish failed');
		} finally {
			setPublishing(false);
		}
	}

	const selectedPlace = places.find((p) => p.id === placeId);
	// Starred places (Chapel Hill, etc. - wherever a lot will happen) float to
	// their own group at the top of the picker instead of sitting wherever the
	// alphabet puts them.
	const sortedPlaces = [...places].sort((a, b) => a.label.localeCompare(b.label));
	const starredPlaces = sortedPlaces.filter((p) => p.starred);
	const unstarredPlaces = sortedPlaces.filter((p) => !p.starred);

	// Keeps the rename field showing the selected place's current label -
	// switching places (or a fresh auto-detection) replaces it, but Lucas's
	// own in-progress edit is left alone until he switches places again.
	useEffect(() => {
		setRenameLabel(selectedPlace?.label ?? '');
		setRenameError(null);
	}, [selectedPlace?.id, selectedPlace?.label]);

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
					if (!occurredAtTouched) {
						if (item.capturedAt) {
							setOccurredAtLocal(isoToLocalInputValue(item.capturedAt));
							setDateUncertain(false);
						} else {
							// No source at all (see mediaUpload.ts's capturedAtIso) -
							// occurredAtLocal stays whatever it already was (nowLocalInputValue
							// for a brand new entry), flagged so Lucas knows to check it
							// rather than assuming it came from the photo.
							setDateUncertain(true);
						}
					}
					void detectPlaceFromGps(gps);
					detectTimezoneFromGps(gps);
				}}
				onRemoved={(id) => setMedia((prev) => prev.filter((m) => m.id !== id))}
				onPeopleChanged={(mediaId, people) =>
					setMedia((prev) => prev.map((m) => (m.id === mediaId ? { ...m, people } : m)))
				}
				onTextChanged={(mediaId, patch) =>
					setMedia((prev) => prev.map((m) => (m.id === mediaId ? { ...m, ...patch } : m)))
				}
			/>

			<div className="field-grid">
				<label>
					Title
					<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} />
				</label>

				<label>
					Subtitle (optional)
					<input value={dek} onChange={(e) => setDek(e.target.value)} maxLength={300} />
				</label>

				<label className="full">
					Body
					<textarea value={bodyMd} onChange={(e) => setBodyMd(e.target.value)} rows={8} />
				</label>

				{/* Format and Chapter hidden for now, per Lucas's request - format
				    stays at its default ('moment'), chapterId stays unset (null). */}

				{/* A group with a plain text caption, not a <label>: a label around
				    several buttons hands every tap on its text, or on the gaps
				    between the chips, to the first button inside it. Same for
				    Place and Timezone below. */}
				<div className="field-group full" role="group" aria-labelledby="entry-tag-label">
					<span id="entry-tag-label">Tag</span>
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
				</div>

				<div className="field-group full" role="group" aria-labelledby="entry-place-label">
					<span id="entry-place-label">Place</span>
					{starredPlaces.length > 0 && (
						<div className="place-presets">
							{starredPlaces.map((p) => (
								<span key={p.id} className="place-chip">
									<button
										type="button"
										className={placeId === p.id ? 'place-chip-select active' : 'place-chip-select'}
										onClick={() => {
											setPlaceTouched(true);
											setPlaceId(p.id);
										}}
									>
										{p.label}
									</button>
									<button
										type="button"
										className="place-chip-remove"
										aria-label={`Remove ${p.label} from quick select`}
										onClick={() => setPlaceStarred(p, false)}
										disabled={starring}
									>
										×
									</button>
								</span>
							))}
						</div>
					)}
					<select
						aria-labelledby="entry-place-label"
						value={placeId}
						onChange={(e) => {
							setPlaceTouched(true);
							setPlaceId(e.target.value ? Number(e.target.value) : '');
						}}
					>
						<option value="">None</option>
						{starredPlaces.length > 0 ? (
							<>
								<optgroup label="Starred">
									{starredPlaces.map((p) => (
										<option key={p.id} value={p.id}>
											{p.label} ({p.precision})
										</option>
									))}
								</optgroup>
								<optgroup label="All places">
									{unstarredPlaces.map((p) => (
										<option key={p.id} value={p.id}>
											{p.label} ({p.precision})
										</option>
									))}
								</optgroup>
							</>
						) : (
							unstarredPlaces.map((p) => (
								<option key={p.id} value={p.id}>
									{p.label} ({p.precision})
								</option>
							))
						)}
					</select>
				</div>

				{placeId !== '' && (
					<div className="field-group full">
						{/* The label names the text field only - Rename and Star sit
						    outside it, so their words are not read out as part of
						    the field's name. */}
						<label htmlFor="entry-place-rename">Call this place (keeps its location data)</label>
						<div className="city-lookup-row">
							<input
								id="entry-place-rename"
								value={renameLabel}
								onChange={(e) => setRenameLabel(e.target.value)}
								maxLength={200}
							/>
							<button
								type="button"
								onClick={renamePlace}
								disabled={renaming || !renameLabel.trim() || renameLabel.trim() === selectedPlace?.label}
							>
								{renaming ? 'Renaming…' : 'Rename'}
							</button>
							<button
								type="button"
								onClick={() => selectedPlace && setPlaceStarred(selectedPlace, !selectedPlace.starred)}
								disabled={starring}
							>
								{selectedPlace?.starred ? '★ Starred' : '☆ Star this place'}
							</button>
						</div>
						{renameError && <p className="error">{renameError}</p>}
					</div>
				)}

				<button
					type="button"
					className="link-button"
					onClick={() => (newPlaceOpen ? resetNewPlaceForm() : setNewPlaceOpen(true))}
				>
					{newPlaceOpen ? 'Cancel new place' : '+ Add a new place'}
				</button>

				{newPlaceOpen && (
					<div className="new-place full">
						<div className="field-group full">
							<label htmlFor="entry-new-place-city">City</label>
							<div className="city-lookup-row">
								<input
									id="entry-new-place-city"
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
						</div>
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
						<label className="checkbox-row">
							<input type="checkbox" checked={newPlaceStarred} onChange={(e) => setNewPlaceStarred(e.target.checked)} />
							Star this place (shows at the top of the picker)
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
							setDateUncertain(false);
							setOccurredAtLocal(e.target.value);
						}}
					/>
					{dateUncertain && (
						<span className="warning">Couldn't detect this photo's date - check it's right.</span>
					)}
				</label>

				<div className="field-group full" role="group" aria-labelledby="entry-timezone-label">
					<span id="entry-timezone-label">Timezone</span>
					<div className="timezone-presets">
						{TIMEZONE_PRESETS.map((preset) => (
							<button
								key={preset.value}
								type="button"
								className={timezone === preset.value ? 'active' : ''}
								onClick={() => {
									setTimezoneTouched(true);
									setTimezone(preset.value);
								}}
							>
								{preset.label}
							</button>
						))}
					</div>
					<input
						aria-labelledby="entry-timezone-label"
						value={timezone}
						onChange={(e) => {
							setTimezoneTouched(true);
							setTimezone(e.target.value);
						}}
					/>
				</div>
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
