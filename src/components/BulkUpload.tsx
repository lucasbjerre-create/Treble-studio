import { useEffect, useRef, useState } from 'react';
import './BulkUpload.css';
import { DEFAULT_AUDIENCE } from '../config/site';
import EntryEditor, { type InitialEntry } from './EntryEditor';
import { findOrCreatePlaceFromGps, type PlaceLike } from '../lib/placeFromGps';
import {
	capturedAtIso,
	readPhotoMetadata,
	uploadPhotoToEntry,
	type PhotoMetadata,
	type UploadedMedia,
	type UploadProgress
} from '../lib/mediaUpload';
import { timezoneFromGps } from '../lib/timezoneFromGps';
import type { MediaItem } from './PhotoUpload';

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
	timezone: string;
	metadata: PhotoMetadata;
}

type ProcessResult =
	| { status: 'duplicate'; entryId: number }
	| { status: 'error' }
	| { status: 'done'; entryId: number; occurredAt: string; timezone: string; placeId: number | null; media: UploadedMedia };

/** The first photo to finish, opened for writing immediately while the rest of the batch keeps uploading behind it. */
interface PrimaryDraft {
	key: string;
	initialEntry: InitialEntry;
	initialMedia: MediaItem[];
}

const RING_RADIUS = 15;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/** Small fixed corner indicator for the background uploads still running once the first draft is already open. */
function BackgroundProgressRing({ done, total }: { done: number; total: number }) {
	const fraction = total > 0 ? done / total : 0;
	const offset = RING_CIRCUMFERENCE * (1 - fraction);
	return (
		<div className="upload-progress-ring" role="status" aria-label={`${done} of ${total} more photos uploaded`}>
			<svg width="36" height="36" viewBox="0 0 36 36">
				<circle className="ring-track" cx="18" cy="18" r={RING_RADIUS} />
				<circle
					className="ring-fill"
					cx="18"
					cy="18"
					r={RING_RADIUS}
					style={{ strokeDasharray: RING_CIRCUMFERENCE, strokeDashoffset: offset }}
				/>
			</svg>
			<span className="ring-label">
				{done}/{total}
			</span>
		</div>
	);
}

/**
 * Select several photos at once; each becomes its own draft entry, prefilled
 * from that photo's own EXIF date and place. The first one to finish opens
 * for writing right away - the rest upload behind it one at a time
 * (studio.md), shown only as a small corner progress ring, so Lucas is never
 * stuck watching a list instead of writing. This is deliberately NOT
 * BUILD_PLAN.md's Milestone 9 ("Smart ingest") - no day/moment grouping, no
 * route legs, no story assembly, one photo always means one entry.
 */
export default function BulkUpload() {
	const [rows, setRows] = useState<FileRow[]>([]);
	const [places, setPlaces] = useState<PlaceLike[]>([]);
	const [placesLoaded, setPlacesLoaded] = useState(false);
	const [processing, setProcessing] = useState(false);
	const [primary, setPrimary] = useState<PrimaryDraft | null>(null);

	const progressByKey = useRef(new Map<string, FileProgress>());
	const objectUrls = useRef<string[]>([]);
	// A ref, not state: handleFiles reads this synchronously across await
	// points within one loop (and across separate picks), where a state
	// value would still read stale - only the first successful file of the
	// whole session should ever become the open draft.
	const primaryAssigned = useRef(false);

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

	async function processFile(file: File, key: string): Promise<ProcessResult> {
		try {
			const saved = progressByKey.current.get(key);
			let entryId: number;
			let occurredAt: string;
			let timezone: string;
			let metadata: PhotoMetadata;

			if (saved) {
				({ entryId, occurredAt, timezone, metadata } = saved);
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
					return { status: 'duplicate', entryId: duplicateEntryId };
				}

				setPhase(key, { phase: 'creating' });
				// From the photo's own GPS, not this phone's clock - a Danish
				// phone travelling in the US must not tag a Danish photo as US
				// time. Falls back to the phone's timezone only when the photo
				// carries no GPS at all.
				timezone =
					timezoneFromGps({ latitude: metadata.gps?.latitude ?? null, longitude: metadata.gps?.longitude ?? null }) ??
					Intl.DateTimeFormat().resolvedOptions().timeZone;
				// capturedAtIso corrects for exifr parsing DateTimeOriginal in
				// *this* runtime's local timezone (see mediaUpload.ts) - without
				// that, a bulk upload done from a different timezone than the
				// photo was taken in would silently mis-date every draft it creates.
				occurredAt = capturedAtIso(metadata.exif, metadata.gps) ?? new Date().toISOString();

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
						timezone,
						consentStatus: 'not_needed'
					})
				});
				if (!entryRes.ok) throw new Error('Could not create a draft entry');
				({ id: entryId } = (await entryRes.json()) as { id: number });

				progressByKey.current.set(key, { entryId, occurredAt, timezone, metadata });
			}

			const { media, gps } = await uploadPhotoToEntry(file, entryId, metadata, (status) => setPhase(key, status));

			setPhase(key, { phase: 'placing' });
			const currentPlaces = await ensurePlacesLoaded();
			const place = await findOrCreatePlaceFromGps(gps, currentPlaces);
			let placeLabel: string | null = null;
			let placeId: number | null = null;
			if (place) {
				setPlaces((prev) => (prev.some((p) => p.id === place.id) ? prev : [...prev, place]));
				placeLabel = place.label;
				placeId = place.id;
				// Best-effort too - a dropped PATCH here still leaves a perfectly
				// finishable draft, just without a place guessed on it yet.
				await fetch(`/api/studio/entries/${entryId}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ placeId: place.id })
				}).catch(() => undefined);
			}

			setPhase(key, { phase: 'done', entryId, occurredAt, placeLabel });
			return { status: 'done', entryId, occurredAt, timezone, placeId, media };
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Upload failed';
			setPhase(key, { phase: 'error', message, retry: () => runFile(file, key) });
			return { status: 'error' };
		}
	}

	/**
	 * Runs one file and, the first time anything actually finishes - whether
	 * that's the batch's first file or a later retry after the first one
	 * failed - opens it as the draft Lucas writes in, right away. Everything
	 * after that point keeps uploading behind it instead of blocking on it.
	 */
	async function runFile(file: File, key: string) {
		const result = await processFile(file, key);
		if (!primaryAssigned.current && result.status === 'done') {
			primaryAssigned.current = true;
			setPrimary({
				key,
				initialEntry: {
					id: result.entryId,
					chapterId: null,
					placeId: result.placeId,
					format: 'moment',
					category: 'life',
					audience: DEFAULT_AUDIENCE,
					originalLang: 'en',
					title: 'Untitled entry',
					dek: null,
					bodyMd: null,
					occurredAt: result.occurredAt,
					timezone: result.timezone,
					consentStatus: 'not_needed',
					status: 'draft'
				},
				initialMedia: [{ ...result.media, people: [] }]
			});
		}
		return result;
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
		// phones do not run out of memory") - the first one is what Lucas is
		// waiting on, the rest just continue in this same loop afterward,
		// which is what makes them "background" from his point of view once
		// runFile has already opened the first as a draft.
		for (let i = 0; i < files.length; i++) {
			await runFile(files[i], newRows[i].key);
		}
		setProcessing(false);
	}

	// Before the first file has succeeded, every row (including it) shows in
	// the plain list below, same as before this feature existed - only once
	// primary exists does its row get pulled out into the inline editor
	// instead, leaving the rest to show as "background" here.
	const backgroundRows = primary ? rows.filter((r) => r.key !== primary.key) : [];
	const visibleRows = primary ? backgroundRows : rows;
	const backgroundDone = backgroundRows.filter((r) => ['done', 'duplicate', 'error'].includes(r.phase.phase)).length;
	const showRing = backgroundRows.length > 0 && backgroundDone < backgroundRows.length;

	return (
		<div className="bulk-upload">
			<label className={processing ? 'bulk-file-picker disabled' : 'bulk-file-picker'}>
				Select photos
				<input
					type="file"
					// .heic/.heif alongside the image/* wildcard - see PhotoUpload.tsx.
					accept="image/*,.heic,.heif"
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

			{rows.length === 0 && !primary && (
				<p className="hint">
					Pick several photos at once, from any days or places. The first one opens below to write up right away -
					the rest finish behind it, one at a time.
				</p>
			)}

			{primary && (
				<div className="bulk-primary">
					<p className="hint">
						First draft ready - keep writing below.
						{backgroundRows.length > 0 && ' The rest are uploading in the background; leaving this page stops them.'}
					</p>
					<EntryEditor chapters={[]} initialEntry={primary.initialEntry} initialMedia={primary.initialMedia} />
				</div>
			)}

			{visibleRows.length > 0 && (
				<ul className="bulk-list">
					{visibleRows.map((row) => (
						<li key={row.key} className="bulk-row">
							<img src={row.thumbUrl} alt="" />
							<div className="bulk-row-info">
								<span className="name">{row.name}</span>
								{row.phase.phase === 'reading' && <span className="status">Reading photo…</span>}
								{row.phase.phase === 'checking' && <span className="status">Checking for duplicates…</span>}
								{row.phase.phase === 'creating' && <span className="status">Creating draft…</span>}
								{row.phase.phase === 'processing' && <span className="status">Processing…</span>}
								{row.phase.phase === 'converting' && <span className="status">Converting from HEIC…</span>}
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

			{showRing && <BackgroundProgressRing done={backgroundDone} total={backgroundRows.length} />}
		</div>
	);
}
