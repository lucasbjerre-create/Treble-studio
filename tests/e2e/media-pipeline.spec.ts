import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import exifr from 'exifr';
import { expect, test } from '@playwright/test';

// tests/fixtures/gps-exif-sample.jpg is a tiny synthetic JPEG with a
// hand-built EXIF GPS IFD spliced in (lat 35.6, lon 82.55 - matching the
// Asheville fixture place, nothing real). It exists only to prove the
// browser resize pipeline (src/lib/media.ts) strips it, not to test exifr.
const fixturePath = fileURLToPath(new URL('../fixtures/gps-exif-sample.jpg', import.meta.url));

test('a processed fixture image carries no GPS - the resize/re-encode step strips it', async ({ page }) => {
	const fixtureBytes = Array.from(readFileSync(fixturePath));

	// Sanity check the fixture itself actually has GPS before processing -
	// otherwise this test would trivially pass for the wrong reason.
	const beforeGps = await exifr.gps(Buffer.from(fixtureBytes));
	expect(beforeGps).toMatchObject({ latitude: 35.6 });

	await page.goto('/en/');

	const resultBase64 = await page.evaluate(async (bytes) => {
		// @ts-expect-error - a real browser URL path (served by the dev server), not a module specifier tsc can resolve from this file.
		const { resizeToWebp } = await import('/src/lib/media.ts');
		const blob = new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' });
		const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
		const resized = await resizeToWebp(bitmap, 1280);
		bitmap.close();
		const buf = await resized.arrayBuffer();
		const resultBytes = new Uint8Array(buf);
		let binary = '';
		for (let i = 0; i < resultBytes.length; i++) binary += String.fromCharCode(resultBytes[i]);
		return btoa(binary);
	}, fixtureBytes);

	const resultBuffer = Buffer.from(resultBase64, 'base64');

	// It's actually a WebP (RIFF....WEBP), not an accidental pass-through of the original JPEG.
	expect(resultBuffer.subarray(0, 4).toString('ascii')).toBe('RIFF');
	expect(resultBuffer.subarray(8, 12).toString('ascii')).toBe('WEBP');

	// exifr's WebP support throws "Unknown file format" rather than reporting
	// "no GPS" the way it does for JPEG/PNG, so the EXIF chunk is checked
	// directly in the RIFF container instead - canvas.convertToBlob for WebP
	// never writes one, which is the actual metadata-stripping guarantee this
	// test exists to prove, independent of what exifr happens to support.
	expect(containsRiffExifChunk(resultBuffer)).toBe(false);
});

function containsRiffExifChunk(buf: Buffer): boolean {
	let offset = 12; // past "RIFF"<size>"WEBP"
	while (offset + 8 <= buf.length) {
		const fourCc = buf.subarray(offset, offset + 4).toString('ascii');
		const chunkSize = buf.readUInt32LE(offset + 4);
		if (fourCc === 'EXIF') return true;
		offset += 8 + chunkSize + (chunkSize % 2); // chunks are padded to even size
	}
	return false;
}
