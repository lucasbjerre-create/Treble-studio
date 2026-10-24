// Tile provider, swappable from this one file (spec section 2/11).
// Positron is OpenFreeMap's muted, light style - matches the "muted custom
// style" design decision. No API key needed.
export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';

export const MAP_DEFAULT_ZOOM = 2;

// Fallback center when there's no place to center on yet (no entries
// published, or the last entry has no place) - [lon, lat] order. Without
// this the map defaults to [0, 0], literally the middle of the Atlantic off
// the coast of Africa, which is what a genuinely empty production site
// showed before any entries existed. Copenhagen, since that's where the
// real journey starts.
export const MAP_DEFAULT_CENTER: [number, number] = [12.5683, 55.6761];

// Camera timing, spec section 6. Only two hops get the longer cinematic
// treatment; everything else uses the normal move duration.
export const CAMERA_MOVE_MS = 1000;
export const CAMERA_CINEMATIC_MS = 1300;
