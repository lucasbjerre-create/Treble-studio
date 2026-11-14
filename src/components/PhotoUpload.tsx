import { useEffect, useRef, useState } from 'react';
import './PhotoUpload.css';
import { readPhotoMetadata, uploadPhotoToEntry, type PhotoGpsHint } from '../lib/mediaUpload';
import PhotoPeopleTags, { type PersonTag } from './PhotoPeopleTags';

export interface MediaItem {
	id: number;
	keyThumb: string | null;
	keyDisplay: string | null;
	caption: string | null;
	altText: string | null;
	capturedAt: string | null;
	people: PersonTag[];
}

/** A saved change to a photo's caption and/or alt text. Only the keys present changed; null means that one was cleared. */
export interface MediaTextPatch {
	caption?: string | null;
	altText?: string | null;
}

export type { PersonTag, PhotoGpsHint };

interface Props {
	entryId: number | null;
	/** Creates (or returns the existing) entry id, called lazily on the first photo - lets "add a photo" be the first thing Lucas does, with the draft row created silently underneath it. */
	ensureEntryId: () => Promise<number | null>;
	media: MediaItem[];
	/** gps is this photo's own EXIF coordinates (not persisted as separate media columns, only inside exifJson), for auto-detecting a place. */
	onUploaded: (item: MediaItem, gps: PhotoGpsHint) => void;
	onRemoved: (id: number) => void;
	onPeopleChanged: (mediaId: number, people: PersonTag[]) => void;
	/** Called once the server has stored a new caption or alt text, so whoever owns the media list holds the saved value. */
	onTextChanged: (mediaId: number, patch: MediaTextPatch) => void;
}

type FileStatus =
	| { phase: 'processing' }
	| { phase: 'converting' }
	| { phase: 'uploading'; progress: string }
	| { phase: 'committing' }
	| { phase: 'done' }
	| { phase: 'error'; message: string; retry: () => void };

interface InFlightFile {
	key: string;
	name: string;
	status: FileStatus;
}

type RemoveStep = 'idle' | 'confirm' | 'removing';

/**
 * Removing a photo deletes it from storage, so it takes two taps: the first
 * only asks, and nothing is deleted until Remove is pressed. The question
 * appears where the first button was and Remove sits below it (see
 * PhotoUpload.css), so a double tap cannot do both steps. A failed request
 * says so and leaves the question open to try again.
 */
function PhotoRemoveControl({ mediaId, onRemoved }: { mediaId: number; onRemoved: (id: number) => void }) {
	const [step, setStep] = useState<RemoveStep>('idle');
	const [error, setError] = useState<string | null>(null);
	// True once the question has been opened. Cancel brings the first button
	// back, and this hands keyboard focus back to it there, without it ever
	// taking focus when the photo list first renders.
	const [returnFocus, setReturnFocus] = useState(false);
	const questionId = `photo-${mediaId}-remove-question`;

	async function removePhoto() {
		setStep('removing');
		setError(null);
		let removed = false;
		try {
			const res = await fetch(`/api/studio/media/${mediaId}`, { method: 'DELETE' });
			// A 404 means the photo is already gone on the server (an earlier
			// attempt got through but its answer never arrived), so it leaves
			// the list here as well instead of failing forever.
			removed = res.ok || res.status === 404;
		} catch {
			removed = false;
		}
		if (removed) {
			// The parent drops this photo, which unmounts this control - nothing
			// more to set here.
			onRemoved(mediaId);
			return;
		}
		setError('Could not remove this photo. Try again.');
		setStep('confirm');
	}

	if (step === 'idle') {
		return (
			<button
				type="button"
				className="photo-remove"
				autoFocus={returnFocus}
				onClick={() => {
					setReturnFocus(true);
					setStep('confirm');
				}}
			>
				Remove photo
			</button>
		);
	}

	const removing = step === 'removing';
	return (
		<div className="photo-remove-confirm" role="group" aria-labelledby={questionId}>
			<span id={questionId} className="photo-remove-question">
				Remove photo?
			</span>
			<button type="button" className="photo-remove-yes" onClick={removePhoto} disabled={removing}>
				{removing ? 'Removing…' : 'Remove'}
			</button>
			<button
				type="button"
				// Focus lands on the safe answer, so a second press of Enter or
				// Space after opening the question never deletes anything.
				autoFocus
				onClick={() => {
					setError(null);
					setStep('idle');
				}}
				disabled={removing}
			>
				Cancel
			</button>
			{error && (
				<p className="photo-remove-error" role="alert">
					{error}
				</p>
			)}
		</div>
	);
}

type TextField = 'caption' | 'altText';
type TextStatus = 'idle' | 'saving' | 'saved' | 'error';

// Same limit as the server's (mediaTextSchema in src/worker/api/studio.ts).
const TEXT_MAX_LENGTH = 400;

const TEXT_FIELDS: Array<{ field: TextField; idSuffix: string; label: string; help: string }> = [
	{ field: 'caption', idSuffix: 'caption', label: 'Caption', help: 'Shown under the photo on the site.' },
	{
		field: 'altText',
		idSuffix: 'alt-text',
		label: 'Alt text',
		help: 'Describes the photo for people who cannot see it.'
	}
];

// What gets stored: trimmed, and nothing at all (null) instead of an empty
// string - the same rule the server applies.
function normaliseText(value: string | null): string | null {
	const trimmed = (value ?? '').trim();
	return trimmed === '' ? null : trimmed;
}

/**
 * Caption and alt text for one photo. Each saves on its own when the field
 * loses focus, and only if the text changed. The saved values live in the
 * parent's media list (onTextChanged); the only state here is the text being
 * typed and how the last save went. A failed save never touches the entry's
 * own Save draft / Publish - it just says so, with a Retry.
 */
function PhotoTextFields({
	media,
	onTextChanged
}: {
	media: MediaItem;
	onTextChanged: (mediaId: number, patch: MediaTextPatch) => void;
}) {
	const [drafts, setDrafts] = useState<Record<TextField, string>>({
		caption: media.caption ?? '',
		altText: media.altText ?? ''
	});
	const [status, setStatus] = useState<Record<TextField, TextStatus>>({ caption: 'idle', altText: 'idle' });
	// The newest value sent for saving, per field (it may still be on its
	// way) - leaving a field only saves when its text differs from this.
	// undefined means the last attempt failed, so whatever is in the field
	// now still has to be sent. Refs, not state: they are read again after a
	// request finishes, where a state value would be stale.
	const asked = useRef<Record<TextField, string | null | undefined>>({
		caption: normaliseText(media.caption),
		altText: normaliseText(media.altText)
	});
	// Counts saves per field, so one that finishes can tell whether a newer
	// save of the same field is already queued behind it.
	const latest = useRef<Record<TextField, number>>({ caption: 0, altText: 0 });
	// What each field holds right now - typing can carry on while a save is
	// on its way, and "Saved" must only ever describe the text on screen.
	const typed = useRef<Record<TextField, string>>({
		caption: media.caption ?? '',
		altText: media.altText ?? ''
	});
	// One request at a time per photo, in the order the fields were left, so
	// an older value can never reach the server after a newer one.
	const queue = useRef<Promise<void>>(Promise.resolve());

	function setFieldStatus(field: TextField, value: TextStatus) {
		setStatus((prev) => ({ ...prev, [field]: value }));
	}

	function editField(field: TextField, value: string) {
		typed.current[field] = value;
		setDrafts((prev) => ({ ...prev, [field]: value }));
		// "Saved" was about the text before this edit.
		setStatus((prev) => ({
			caption: prev.caption === 'saved' ? 'idle' : prev.caption,
			altText: prev.altText === 'saved' ? 'idle' : prev.altText
		}));
	}

	function saveField(field: TextField) {
		const next = normaliseText(drafts[field]);
		if (next === asked.current[field]) return;
		asked.current[field] = next;
		latest.current[field] += 1;
		const attempt = latest.current[field];
		setFieldStatus(field, 'saving');

		const send = async () => {
			const patch: MediaTextPatch = field === 'caption' ? { caption: next } : { altText: next };
			let ok = false;
			try {
				const res = await fetch(`/api/studio/media/${media.id}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(patch)
				});
				ok = res.ok;
			} catch {
				ok = false;
			}
			if (ok) onTextChanged(media.id, patch);
			// A newer save of this field is queued behind this one - its result
			// decides what the status says, not this one's.
			if (latest.current[field] !== attempt) return;
			if (ok) {
				// Not "Saved" if more was typed since: that text is not stored
				// until the field is left again.
				setFieldStatus(field, normaliseText(typed.current[field]) === next ? 'saved' : 'idle');
			} else {
				asked.current[field] = undefined;
				setFieldStatus(field, 'error');
			}
		};
		// The catch keeps the queue usable whatever happens inside send - a
		// rejected link would silently skip every save queued after it.
		queue.current = queue.current.then(send).catch(() => undefined);
	}

	function retryFailed() {
		if (status.caption === 'error') saveField('caption');
		if (status.altText === 'error') saveField('altText');
	}

	const saving = status.caption === 'saving' || status.altText === 'saving';
	const captionFailed = status.caption === 'error';
	const altTextFailed = status.altText === 'error';
	const failed = captionFailed || altTextFailed;
	const saved = status.caption === 'saved' || status.altText === 'saved';

	let statusText = '';
	let statusClass = 'media-text-message';
	if (saving) {
		statusText = 'Saving…';
	} else if (failed) {
		statusText =
			captionFailed && altTextFailed
				? 'Could not save the caption and alt text.'
				: captionFailed
					? 'Could not save the caption.'
					: 'Could not save the alt text.';
		statusClass = 'media-text-message failed';
	} else if (saved) {
		statusText = 'Saved';
		statusClass = 'media-text-message saved';
	}

	return (
		<div className="media-text">
			{TEXT_FIELDS.map(({ field, idSuffix, label, help }) => {
				const inputId = `photo-${media.id}-${idSuffix}`;
				return (
					<div key={field} className="media-field">
						<label htmlFor={inputId}>{label}</label>
						<textarea
							id={inputId}
							rows={2}
							maxLength={TEXT_MAX_LENGTH}
							value={drafts[field]}
							aria-describedby={`${inputId}-help`}
							onChange={(e) => editField(field, e.target.value)}
							onBlur={() => saveField(field)}
						/>
						<p id={`${inputId}-help`} className="media-field-help">
							{help}
						</p>
					</div>
				);
			})}
			{/* Always rendered, with room for one line kept free in the
			    stylesheet, so a status appearing never moves what is below it
			    while it is being tapped. */}
			<div className="media-text-status">
				<span role="status" className={statusClass}>
					{statusText}
				</span>
				{failed && !saving && (
					<button type="button" onClick={retryFailed}>
						Retry
					</button>
				)}
			</div>
		</div>
	);
}

/**
 * One photo at a time (studio.md: "process files one at a time... so phones
 * do not run out of memory"), each with its own progress/retry - a failed
 * file never blocks the others or the already-saved draft. Every uploaded
 * photo then gets its own caption and alt text fields, people tags and a
 * two-step remove.
 */
export default function PhotoUpload({
	entryId,
	ensureEntryId,
	media,
	onUploaded,
	onRemoved,
	onPeopleChanged,
	onTextChanged
}: Props) {
	const [inFlight, setInFlight] = useState<InFlightFile[]>([]);
	// Autocomplete source for the people tagger below, loaded once per
	// session rather than per photo.
	const [knownNames, setKnownNames] = useState<string[]>([]);

	useEffect(() => {
		fetch('/api/studio/people-names')
			.then((r) => (r.ok ? r.json() : []))
			.then((names) => setKnownNames(names as string[]))
			.catch(() => undefined);
	}, []);

	// A retry reuses the same key so it updates the existing row instead of
	// adding a second one - found live: a retry click looked like it did
	// nothing because the new attempt's row was easy to miss below the
	// still-failed original.
	async function processAndUpload(file: File, existingKey?: string) {
		const key = existingKey ?? `${file.name}-${file.lastModified}-${Math.random()}`;
		if (existingKey) {
			setInFlight((prev) => prev.map((f) => (f.key === key ? { ...f, status: { phase: 'processing' } } : f)));
		} else {
			setInFlight((prev) => [...prev, { key, name: file.name, status: { phase: 'processing' } }]);
		}

		function setStatus(status: FileStatus) {
			setInFlight((prev) => prev.map((f) => (f.key === key ? { ...f, status } : f)));
		}

		try {
			const id = entryId ?? (await ensureEntryId());
			if (!id) throw new Error('Could not create a draft to attach this photo to');

			// Read EXIF before anything else touches the file (studio.md).
			const metadata = await readPhotoMetadata(file);
			const { media, gps } = await uploadPhotoToEntry(file, id, metadata, setStatus);

			setStatus({ phase: 'done' });
			// A photo that was just committed has no alt text or people tags yet.
			onUploaded({ ...media, altText: null, people: [] }, gps);
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Upload failed';
			setStatus({ phase: 'error', message, retry: () => processAndUpload(file, key) });
		}
	}

	return (
		<div className="photo-upload">
			<label className="file-picker">
				Add a photo
				<input
					type="file"
					// .heic/.heif alongside the image/* wildcard - iPhones often hand
					// HEIC files to a file input with no MIME type at all, which
					// image/* alone doesn't match on some OSes' file pickers.
					accept="image/*,.heic,.heif"
					onChange={(e) => {
						const file = e.target.files?.[0];
						e.target.value = '';
						if (file) processAndUpload(file);
					}}
				/>
			</label>

			{inFlight.map((f) => (
				<div key={f.key} className="file-row">
					<span>{f.name}</span>
					{f.status.phase === 'processing' && <span>Processing…</span>}
					{f.status.phase === 'converting' && <span>Converting from HEIC…</span>}
					{f.status.phase === 'uploading' && <span>Uploading {f.status.progress}</span>}
					{f.status.phase === 'committing' && <span>Saving…</span>}
					{f.status.phase === 'done' && <span>Done</span>}
					{f.status.phase === 'error' && (
						<span className="error">
							{f.status.message}{' '}
							<button type="button" onClick={f.status.retry}>
								Retry
							</button>
						</span>
					)}
				</div>
			))}

			{media.length > 0 && (
				<ul className="media-list">
					{media.map((m) => (
						<li key={m.id} className="media-item">
							<div className="media-item-head">
								{m.keyThumb && (
									<img
										className="media-thumb"
										src={`/api/studio/media-file/${m.keyThumb}`}
										alt={m.altText ?? m.caption ?? ''}
									/>
								)}
								<PhotoRemoveControl mediaId={m.id} onRemoved={onRemoved} />
							</div>
							<PhotoTextFields media={m} onTextChanged={onTextChanged} />
							<PhotoPeopleTags media={m} knownNames={knownNames} onChange={(people) => onPeopleChanged(m.id, people)} />
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
