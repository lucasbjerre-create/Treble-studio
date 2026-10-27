export interface FractionBox {
	x: number;
	y: number;
	w: number;
	h: number;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

/**
 * Normalizes two arbitrary drag points (in whatever unit they already are -
 * pixels for a hand-drawn box) into a top-left-origin rect, since a drag can
 * end up left-of or above its start point.
 */
export function rectFromPoints(x1: number, y1: number, x2: number, y2: number): FractionBox {
	return { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
}

/**
 * Converts a pixel rect - from a detector result or a hand-drawn box,
 * measured against the displayed image's own width/height - into fractions
 * (0-1) of that image. Stored as fractions (studio.md: per-photo tags table)
 * so a box still lines up on whichever of the three saved sizes is shown.
 * Clamped so a box drawn or detected slightly past the image edge never
 * gets stored out of range.
 */
export function pixelRectToFraction(rect: FractionBox, containerWidth: number, containerHeight: number): FractionBox {
	if (containerWidth <= 0 || containerHeight <= 0) return { x: 0, y: 0, w: 0, h: 0 };
	const x = clamp(rect.x / containerWidth, 0, 1);
	const y = clamp(rect.y / containerHeight, 0, 1);
	const w = clamp(rect.w / containerWidth, 0, 1 - x);
	const h = clamp(rect.h / containerHeight, 0, 1 - y);
	return { x, y, w, h };
}
