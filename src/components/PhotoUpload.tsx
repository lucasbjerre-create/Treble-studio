import exifr from 'exifr';
import { useState } from 'react';
import './PhotoUpload.css';
import { resizeToWebp } from '../lib/media';

export interface MediaItem {
	id: number;
	keyThumb: string | null;
	caption: string | null;
	capturedAt: string | null;
}

export interface PhotoGpsHint {
	latitude: number | null;
	longitude: number | null;
}

interface Props {
	entryId: number | null;
	/** Creates (or returns the existing) entry id, called lazily on the first photo - lets "add a photo" be the first thing Lucas does, with the draft row created silently underneath it. */
	ensureEntryId: () => Promise<number | null>;
	media: MediaItem[];
	/** gps is this photo's own EXIF coordinates (not persisted as separate media columns, only inside exifJson), for auto-detecting a place. */
	onUploaded: (item: MediaItem, gps: PhotoGpsHint) => void;
	onRemoved: (id: number) => void;
}

type SizeName = 'thumb' | 'display' | 'large';
const SIZE_WIDTHS: Record<SizeName, number> = { thumb: 480, display: 1280, large: 2048 };

type FileStatus =
	| { phase: 'processing' }
	| { phase: 'uploading'; progress: string }
	| { phase: 'committing' }
	| { phase: 'done' }
	| { phase: 'error'; message: string; retry: () => void };

interface InFlightFile {
	key: string;
	name: string;
	status: FileStatus;
}

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', buffer);
	return Array.from(new Uint8Array(digest))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

/**
 * One photo at a time (studio.md: "process files one at a time... so phones
 * do not run out of memory"), each with its own progress/retry - a failed
 * file never blocks the others or the already-saved draft.
 */
export default function PhotoUpload({ entryId, ensureEntryId, media, onUploaded, onRemoved }: Props) {
	const [inFlight, setInFlight] = useState<InFlightFile[]>([]);
	const [removingId, setRemovingId] = useState<number | null>(null);

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
			const exif = await exifr.parse(file, true).catch(() => undefined);
			// exifr.gps() is the documented way to get both latitude and
			// longitude reliably (parse()'s own output only guarantees
			// latitude) - undefined when the photo has no GPS tags.
			const gps = await exifr.gps(file).catch(() => undefined);
			const originalBuffer = await file.arrayBuffer();
			const sha256 = await sha256Hex(originalBuffer);

			// imageOrientation: 'from-image' applies the EXIF orientation while
			// decoding, so there's no separate manual rotation step.
			const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
			// Captured before close() - a closed ImageBitmap reports 0x0 for
			// both, which then failed the commit payload's validation.
			const { width, height } = bitmap;
			const blobs: Record<SizeName, Blob> = {
				thumb: await resizeToWebp(bitmap, SIZE_WIDTHS.thumb),
				display: await resizeToWebp(bitmap, SIZE_WIDTHS.display),
				large: await resizeToWebp(bitmap, SIZE_WIDTHS.large)
			};
			bitmap.close();

			setStatus({ phase: 'uploading', progress: '0 / 3' });

			const presignRes = await fetch('/api/studio/media/presign', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ entryId: id })
			});
			if (!presignRes.ok) throw new Error('Could not get an upload URL');
			const { keys, urls } = (await presignRes.json()) as {
				keys: Record<SizeName, string>;
				urls: Record<SizeName, string>;
			};

			let done = 0;
			for (const size of ['thumb', 'display', 'large'] as SizeName[]) {
				const putRes = await fetch(urls[size], {
					method: 'PUT',
					headers: { 'Content-Type': 'image/webp' },
					body: blobs[size]
				});
				if (!putRes.ok) throw new Error(`Upload failed for the ${size} size`);
				done += 1;
				setStatus({ phase: 'uploading', progress: `${done} / 3` });
			}

			setStatus({ phase: 'committing' });

			const commitRes = await fetch('/api/studio/media/commit', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					entryId: id,
					keyThumb: keys.thumb,
					keyDisplay: keys.display,
					keyLarge: keys.large,
					kind: 'photo',
					mime: 'image/webp',
					width,
					height,
					bytes: blobs.large.size,
					capturedAt: exif?.DateTimeOriginal ? new Date(exif.DateTimeOriginal).toISOString() : null,
					sha256,
					exifJson: exif ? JSON.stringify(exif) : null
				})
			});
			if (!commitRes.ok) throw new Error('Could not save the uploaded photo');
			const row = (await commitRes.json()) as MediaItem;

			setStatus({ phase: 'done' });
			onUploaded(row, { latitude: gps?.latitude ?? null, longitude: gps?.longitude ?? null });
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
					accept="image/*"
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
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
