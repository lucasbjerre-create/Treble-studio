import { useEffect, useState } from 'react';
import './PhotoUpload.css';
import { readPhotoMetadata, uploadPhotoToEntry, type PhotoGpsHint } from '../lib/mediaUpload';
import PhotoPeopleTags, { type PersonTag } from './PhotoPeopleTags';

export interface MediaItem {
	id: number;
	keyThumb: string | null;
	keyDisplay: string | null;
	caption: string | null;
	capturedAt: string | null;
	people: PersonTag[];
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

/**
 * One photo at a time (studio.md: "process files one at a time... so phones
 * do not run out of memory"), each with its own progress/retry - a failed
 * file never blocks the others or the already-saved draft.
 */
export default function PhotoUpload({ entryId, ensureEntryId, media, onUploaded, onRemoved, onPeopleChanged }: Props) {
	const [inFlight, setInFlight] = useState<InFlightFile[]>([]);
	const [removingId, setRemovingId] = useState<number | null>(null);
	// Autocomplete source for the people tagger below, loaded once per
	// session rather than per photo.
	const [knownNames, setKnownNames] = useState<string[]>([]);

	useEffect(() => {
		fetch('/api/studio/people-names')
			.then((r) => (r.ok ? r.json() : []))
			.then((names) => setKnownNames(names as string[]))
			.catch(() => undefined);
	}, []);

	async function removePhoto(id: number) {
		setRemovingId(id);
		try {
			const res = await fetch(`/api/studio/media/${id}`, { method: 'DELETE' });
			if (res.ok) onRemoved(id);
		} finally {
			setRemovingId(null);
		}
	}

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
			onUploaded({ ...media, people: [] }, gps);
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
						<li key={m.id}>
							{m.keyThumb && <img src={`/api/studio/media-file/${m.keyThumb}`} alt={m.caption ?? ''} />}
							<button type="button" className="remove" onClick={() => removePhoto(m.id)} disabled={removingId === m.id}>
								{removingId === m.id ? '…' : '✕'}
							</button>
							<PhotoPeopleTags media={m} knownNames={knownNames} onChange={(people) => onPeopleChanged(m.id, people)} />
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
