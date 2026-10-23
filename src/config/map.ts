// Tile provider, swappable from this one file (spec section 2/11).
// Positron is OpenFreeMap's muted, light style - matches the "muted custom
// style" design decision. No API key needed.
export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';

export const MAP_DEFAULT_ZOOM = 2;

// Camera timing, spec section 6. Only two hops get the longer cinematic
// treatment; everything else uses the normal move duration.
export const CAMERA_MOVE_MS = 1000;
export const CAMERA_CINEMATIC_MS = 1300;
