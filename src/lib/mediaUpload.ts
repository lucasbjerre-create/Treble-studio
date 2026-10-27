// Browser-only (crypto.subtle, createImageBitmap, OffscreenCanvas via
// resizeToWebp) - not Node-testable the way src/lib's other pure functions
// are, same as media.ts. Shared by PhotoUpload.tsx (one entry, picked by
// hand) and BulkUpload.tsx (one new entry per file) so the two upload paths
// can't silently drift apart (studio.md's per-file contract: EXIF before
// anything else touches the file, resize/strip to three WebP sizes, presign,
// upload each size, then commit).
import exifr from 'exifr';
import { resizeToWebp } from './media';

export interface PhotoGpsHint {
	latitude: number | null;
	longitude: number | null;
}

export interface PhotoMetadata {
	exif: Record<string, unknown> | undefined;
	gps: { latitude: number; longitude: number } | undefined;
	sha256: string;
}

export interface UploadedMedia {
	id: number;
	keyThumb: string | null;
	caption: string | null;
	capturedAt: string | null;
}

export type UploadProgress =
	| { phase: 'processing' }
	| { phase: 'uploading'; progress: string }
	| { phase: 'committing' };

const SIZE_WIDTHS = { thumb: 480, display: 1280, large: 2048 } as const;
type SizeName = keyof typeof SIZE_WIDTHS;
const SIZES: SizeName[] = ['thumb', 'display', 'large'];

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', buffer);
	return Array.from(new Uint8Array(digest))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

/**
 * Reads EXIF and computes the sha256 of the original file, before anything
 * else touches it (studio.md). Split out from uploadPhotoToEntry so callers
 * that need to know the hash first - BulkUpload's duplicate check - don't
 * have to create an entry before they can tell whether this photo was
 * already uploaded.
 */
export async function readPhotoMetadata(file: File): Promise<PhotoMetadata> {
	const exif = await exifr.parse(file, true).catch(() => undefined);
	// exifr.gps() is the documented way to get both latitude and longitude
	// reliably (parse()'s own output only guarantees latitude) - undefined
	// when the photo has no GPS tags.
	const gps = await exifr.gps(file).catch(() => undefined);
	const sha256 = await sha256Hex(await file.arrayBuffer());
	return { exif, gps, sha256 };
}

/**
 * Resizes/strips to three WebP sizes, presigns, uploads each size, then
 * commits the media row against an already-created entryId. Takes the
 * metadata already read by readPhotoMetadata rather than re-reading the
 * file, so a caller that needed the hash up front never pays for EXIF/hash
 * work twice.
 */
export async function uploadPhotoToEntry(
	file: File,
	entryId: number,
	metadata: PhotoMetadata,
	onProgress: (status: UploadProgress) => void
): Promise<{ media: UploadedMedia; gps: PhotoGpsHint }> {
	onProgress({ phase: 'processing' });

	// imageOrientation: 'from-image' applies the EXIF orientation while
	// decoding, so there's no separate manual rotation step.
	const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
	// Captured before close() - a closed ImageBitmap reports 0x0 for both,
	// which then fails the commit payload's validation.
	const { width, height } = bitmap;
	const blobs: Record<SizeName, Blob> = {
		thumb: await resizeToWebp(bitmap, SIZE_WIDTHS.thumb),
		display: await resizeToWebp(bitmap, SIZE_WIDTHS.display),
		large: await resizeToWebp(bitmap, SIZE_WIDTHS.large)
	};
	bitmap.close();

	onProgress({ phase: 'uploading', progress: '0 / 3' });

	const presignRes = await fetch('/api/studio/media/presign', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ entryId })
	});
	if (!presignRes.ok) throw new Error('Could not get an upload URL');
	const { keys, urls } = (await presignRes.json()) as {
		keys: Record<SizeName, string>;
		urls: Record<SizeName, string>;
	};

	let done = 0;
	for (const size of SIZES) {
		const putRes = await fetch(urls[size], {
			method: 'PUT',
			headers: { 'Content-Type': 'image/webp' },
			body: blobs[size]
		});
		if (!putRes.ok) throw new Error(`Upload failed for the ${size} size`);
		done += 1;
		onProgress({ phase: 'uploading', progress: `${done} / 3` });
	}

	onProgress({ phase: 'committing' });

	const { exif, gps, sha256 } = metadata;
	const commitRes = await fetch('/api/studio/media/commit', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			entryId,
			keyThumb: keys.thumb,
			keyDisplay: keys.display,
			keyLarge: keys.large,
			kind: 'photo',
			mime: 'image/webp',
			width,
			height,
			bytes: blobs.large.size,
			capturedAt: exif?.DateTimeOriginal ? new Date(exif.DateTimeOriginal as string | number | Date).toISOString() : null,
			sha256,
			exifJson: exif ? JSON.stringify(exif) : null
		})
	});
	if (!commitRes.ok) throw new Error('Could not save the uploaded photo');
	const media = (await commitRes.json()) as UploadedMedia;

	return { media, gps: { latitude: gps?.latitude ?? null, longitude: gps?.longitude ?? null } };
}
