// Not pure (hits /api/studio/geocode/reverse and /api/studio/places) but
// small enough, and used identically from two components - EntryEditor.tsx
// (one photo) and BulkUpload.tsx (one new entry per photo) - that
// duplicating it would be the real risk (studio.md's "automation can sort,
// group and suggest" guess living in two places that quietly disagree).
import type { PhotoGpsHint } from './mediaUpload';

export interface PlaceLike {
	id: number;
	label: string;
	precision: 'exact' | 'area' | 'city' | 'hidden';
}

/**
 * Auto-detects a place from a photo's EXIF GPS, via reverse geocoding -
 * reuses an existing place with the same label (case-insensitive) rather
 * than creating a duplicate every time. Defaults a newly-created place to
 * city-level precision, same as the manual city lookup: GPS is exact, but an
 * entry's audience may be public, and precision is a privacy choice Lucas
 * should make deliberately, not one a default silently picks. Returns null
 * (not a rejected promise) on no GPS, no match or any request failure, since
 * this is always a best-effort guess a caller can ignore.
 */
export async function findOrCreatePlaceFromGps(
	gps: PhotoGpsHint,
	existingPlaces: PlaceLike[]
): Promise<PlaceLike | null> {
	if (gps.latitude == null || gps.longitude == null) return null;
	try {
		const res = await fetch(`/api/studio/geocode/reverse?lat=${gps.latitude}&lon=${gps.longitude}`);
		if (!res.ok) return null;
		const { label } = (await res.json()) as { label: string };

		const existing = existingPlaces.find((p) => p.label.toLowerCase() === label.toLowerCase());
		if (existing) return existing;

		const placeRes = await fetch('/api/studio/places', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ label, precision: 'city', latPrivate: gps.latitude, lonPrivate: gps.longitude })
		});
		if (!placeRes.ok) return null;
		return (await placeRes.json()) as PlaceLike;
	} catch {
		return null;
	}
}
