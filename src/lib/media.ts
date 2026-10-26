// Browser-only (OffscreenCanvas/ImageBitmap) - not Node-testable the way
// src/lib's other pure functions are, so this is exercised by
// tests/e2e/media-pipeline.spec.ts (a real browser) instead of vitest.

/**
 * Resizes to at most `maxWidth` and re-encodes as WebP. The re-encode is the
 * metadata-stripping step (studio.md) - a canvas-drawn, freshly-encoded blob
 * carries no EXIF by construction, nothing extra needed for that part.
 */
export async function resizeToWebp(bitmap: ImageBitmap, maxWidth: number): Promise<Blob> {
	const scale = Math.min(1, maxWidth / bitmap.width);
	const width = Math.round(bitmap.width * scale);
	const height = Math.round(bitmap.height * scale);
	const canvas = new OffscreenCanvas(width, height);
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('Canvas not available');
	ctx.drawImage(bitmap, 0, 0, width, height);
	return canvas.convertToBlob({ type: 'image/webp', quality: 0.85 });
}
