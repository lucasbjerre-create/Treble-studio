/**
 * Resolves a stored media key into something an <img>/<video> src can use
 * directly. Fixture/seed media already store a full path under public/ (e.g.
 * "/fixtures/chapel-hill-quad.svg", always starting with "/") and need no
 * resolving. A real upload's key is a bare R2 object key (e.g.
 * "media/12/abc-display.webp", never a leading slash) and is served through
 * the viewer-checked /api/media route (src/worker/api/media.ts) - never a
 * direct R2 URL, which would mean either making the bucket public (never -
 * privacy.md) or handing out a signed URL that outlives this one response.
 */
export function publicMediaUrl(key: string): string {
	return key.startsWith('/') ? key : `/api/media/${key}`;
}
