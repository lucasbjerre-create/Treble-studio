import { useEffect, useRef, useState } from 'react';
import './BulkUpload.css';
import { DEFAULT_AUDIENCE } from '../config/site';
import { findOrCreatePlaceFromGps, type PlaceLike } from '../lib/placeFromGps';
import { readPhotoMetadata, uploadPhotoToEntry, type PhotoMetadata, type UploadProgress } from '../lib/mediaUpload';

type FilePhase =
	| { phase: 'reading' }
	| { phase: 'checking' }
	| { phase: 'duplicate'; entryId: number }
	| { phase: 'creating' }
	| UploadProgress
	| { phase: 'placing' }
	| { phase: 'done'; entryId: number; occurredAt: string; placeLabel: string | null }
	| { phase: 'error'; message: string; retry: () => void };

interface FileRow {
	key: string;
	name: string;
	thumbUrl: string;
	phase: FilePhase;
}

/** What's already been done for one file, kept across a retry so it never repeats a completed step (in particular: never creates a second draft entry for the same photo). */
interface FileProgress {
	entryId: number;
	occurredAt: string;
	metadata: PhotoMetadata;
}

/**
 * Select several photos at once; each becomes its own draft entry, prefilled
 * from that photo's own EXIF date and place, ready to finish individually in
 * the normal entry editor. This is deliberately NOT BUILD_PLAN.md's
 * Milestone 9 ("Smart ingest") - no day/moment grouping, no route legs, no
 * story assembly, one photo always means one entry.
 */
export default function BulkUpload() {
	const [rows, setRows] = useState<FileRow[]>([]);
	const [places, setPlaces] = useState<PlaceLike[]>([]);
	const [placesLoaded, setPlacesLoaded] = useState(false);
	const [processing, setProcessing] = useState(false);

	const progressByKey = useRef(new Map<string, FileProgress>());
	const objectUrls = useRef<string[]>([]);

	useEffect(
		() => () => {
			for (const url of objectUrls.current) URL.revokeObjectURL(url);
		},
		[]
	);

	// Fetched once per bulk session and reused across files, so five photos
	// from the same city reuse one place instead of creating five duplicates.
	async function ensurePlacesLoaded(): Promise<PlaceLike[]> {
		if (placesLoaded) return places;
		const res = await fetch('/api/studio/places');
		const loaded = res.ok ? ((await res.json()) as PlaceLike[]) : [];
		setPlaces(loaded);
		setPlacesLoaded(true);
		return loaded;
	}

	function setPhase(key: string, phase: FilePhase) {
		setRows((prev) => prev.map((r) => (r.key === key ? { ...r, phase } : r)));
	}

	async function processFile(file: File, key: string) {
		try {
			const saved = progressByKey.current.get(key);
			let entryId: number;
			let occurredAt: string;
			let metadata: PhotoMetadata;

			if (saved) {
				({ entryId, occurredAt, metadata } = saved);
			} else {
				setPhase(key, { phase: 'reading' });
				// Read EXIF and hash before anything else touches the file (studio.md).
				metadata = await readPhotoMetadata(file);

				setPhase(key, { phase: 'checking' });
				let duplicateEntryId: number | undefined;
				try {
					const dupRes = await fetch(`/api/studio/media/by-sha256?sha256=${metadata.sha256}`);
					if (dupRes.ok) {
						const dup = (await dupRes.json()) as { found: boolean; entryId?: number };
						if (dup.found) duplicateEntryId = dup.entryId;
					}
				} catch {
					// Best-effort - a failed check just means we proceed as if it's new.
				}
				if (duplicateEntryId !== undefined) {
					setPhase(key, { phase: 'duplicate', entryId: duplicateEntryId });
					return;
				}

				setPhase(key, { phase: 'creating' });
				occurredAt = metadata.exif?.DateTimeOriginal
					? new Date(metadata.exif.DateTimeOriginal as string | number | Date).toISOString()
					: new Date().toISOString();

				const entryRes = await fetch('/api/studio/entries', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						chapterId: null,
						placeId: null,
						format: 'moment',
						category: 'life',
						audience: DEFAULT_AUDIENCE,
						originalLang: 'en',
						// Placeholder, same as the single-entry editor's photo-first
						// draft - the server requires a non-empty title, and this is
						// the obvious prompt for Lucas to replace it.
						title: 'Untitled entry',
						dek: null,
						bodyMd: null,
						occurredAt,
						timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
						consentStatus: 'not_needed'
					})
				});
				if (!entryRes.ok) throw new Error('Could not create a draft entry');
				({ id: entryId } = (await entryRes.json()) as { id: number });

				progressByKey.current.set(key, { entryId, occurredAt, metadata });
			}

			await uploadPhotoToEntry(file, entryId, metadata, (status) => setPhase(key, status));

			setPhase(key, { phase: 'placing' });
			const currentPlaces = await ensurePlacesLoaded();
			const gps = { latitude: metadata.gps?.latitude ?? null, longitude: metadata.gps?.longitude ?? null };
			const place = await findOrCreatePlaceFromGps(gps, currentPlaces);
			let placeLabel: string | null = null;
			if (place) {
				setPlaces((prev) => (prev.some((p) => p.id === place.id) ? prev : [...prev, place]));
				placeLabel = place.label;
				// Best-effort too - a dropped PATCH here still leaves a perfectly
				// finishable draft, just without a place guessed on it yet.
				await fetch(`/api/studio/entries/${entryId}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ placeId: place.id })
				}).catch(() => undefined);
			}

			setPhase(key, { phase: 'done', entryId, occurredAt, placeLabel });
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Upload failed';
			setPhase(key, { phase: 'error', message, retry: () => processFile(file, key) });
		}
	}

	async function handleFiles(files: File[]) {
		await ensurePlacesLoaded();

		const newRows: FileRow[] = files.map((file) => {
			const thumbUrl = URL.createObjectURL(file);
			objectUrls.current.push(thumbUrl);
			return {
				key: `${file.name}-${file.lastModified}-${Math.random()}`,
				name: file.name,
				thumbUrl,
				phase: { phase: 'reading' }
			};
		});
		setRows((prev) => [...prev, ...newRows]);

		setProcessing(true);
		// One file at a time (studio.md's "process files one at a time... so
		// phones do not run out of memory") - now across files, not just
		// across one file's three sizes, for the same reason.
		for (let i = 0; i < files.length; i++) {
			await processFile(files[i], newRows[i].key);
		}
		setProcessing(false);
	}

	return (
		<div className="bulk-upload">
			<label className={processing ? 'bulk-file-picker disabled' : 'bulk-file-picker'}>
				Select photos
				<input
					type="file"
					accept="image/*"
					multiple
					disabled={processing}
					onChange={(e) => {
						// Extract the concrete Files before resetting value - e.target.files
						// is a live FileList, and clearing value (so the same file can be
						// picked again later) empties that same list out from under us.
						const files = Array.from(e.target.files ?? []);
						e.target.value = '';
						if (files.length > 0) void handleFiles(files);
					}}
				/>
			</label>

			{rows.length === 0 && (
				<p className="hint">
					Pick several photos at once, from any days or places. Each becomes its own draft entry with a guessed date
					and place - open it from the list below to write the rest.
				</p>
			)}

			{rows.length > 0 && (
				<ul className="bulk-list">
					{rows.map((row) => (
						<li key={row.key} className="bulk-row">
							<img src={row.thumbUrl} alt="" />
							<div className="bulk-row-info">
								<span className="name">{row.name}</span>
								{row.phase.phase === 'reading' && <span className="status">Reading photo…</span>}
								{row.phase.phase === 'checking' && <span className="status">Checking for duplicates…</span>}
								{row.phase.phase === 'creating' && <span className="status">Creating draft…</span>}
								{row.phase.phase === 'processing' && <span className="status">Processing…</span>}
								{row.phase.phase === 'uploading' && <span className="status">Uploading {row.phase.progress}</span>}
								{row.phase.phase === 'committing' && <span className="status">Saving…</span>}
								{row.phase.phase === 'placing' && <span className="status">Guessing place…</span>}
								{row.phase.phase === 'duplicate' && (
									<span className="status">
										Already uploaded - <a href={`/studio/entries/${row.phase.entryId}`}>open its entry</a>
									</span>
								)}
								{row.phase.phase === 'done' && (
									<span className="status done">
										Draft ready, {row.phase.occurredAt.slice(0, 10)}
										{row.phase.placeLabel ? `, ${row.phase.placeLabel}` : ''} -{' '}
										<a href={`/studio/entries/${row.phase.entryId}`}>finish it</a>
									</span>
								)}
								{row.phase.phase === 'error' && (
									<span className="status error">
										{row.phase.message}{' '}
										<button type="button" onClick={row.phase.retry}>
											Retry
										</button>
									</span>
								)}
							</div>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
