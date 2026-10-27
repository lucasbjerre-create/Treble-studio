import tzlookup from 'tz-lookup';
import type { PhotoGpsHint } from './mediaUpload';

/**
 * IANA timezone for where a photo was taken, from its EXIF GPS - not the
 * timezone of the phone that happens to be uploading it (a Danish phone
 * travelling in the US must not tag a Danish photo as US time). Offline
 * lookup, same lat/lon precision as the EXIF tags themselves. Null on no GPS
 * or a coordinate tz-lookup can't place (open ocean, a pole).
 */
export function timezoneFromGps(gps: PhotoGpsHint): string | null {
	if (gps.latitude == null || gps.longitude == null) return null;
	try {
		return tzlookup(gps.latitude, gps.longitude);
	} catch {
		return null;
	}
}
