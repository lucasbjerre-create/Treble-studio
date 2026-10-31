export type CollageSize = 1 | 2 | 3 | 4 | 'auto';
export type ViewportCategory = 'phone' | 'tablet' | 'desktop';
export type Speed = 'slow' | 'normal' | 'fast';
export type LayoutName = 'single' | 'duo' | 'trio' | 'quad';
export type TransitionStyle = 'fade' | 'slide' | 'zoom';

/**
 * Exactly the fields src/db/queries.ts's listMediaForPersonViewer already
 * returns (publicSlideshowMediaColumns) - duplicated here, not imported,
 * so this module stays DB-free and independently testable, same split as
 * src/lib/visibility.ts's own EntryVisibilityInput.
 */
export interface SlideshowPhoto {
	id: number;
	entryId: number;
	keyDisplay: string | null;
	keyLarge: string | null;
	width: number | null;
	height: number | null;
	caption: string | null;
	altText: string | null;
	occurredAt: string;
}

export interface SlideshowComposition {
	photos: SlideshowPhoto[];
	layout: LayoutName;
}

function layoutForCount(count: number): LayoutName {
	if (count >= 4) return 'quad';
	if (count === 3) return 'trio';
	if (count === 2) return 'duo';
	return 'single';
}

type AspectCategory = 'portrait' | 'landscape' | 'square';

/** Missing dimensions default to 'landscape' - the common case, and the safest one to let stand alone (layoutForCount(1)) rather than guess a pairing that might crop badly. */
function aspectCategory(photo: SlideshowPhoto): AspectCategory {
	if (!photo.width || !photo.height) return 'landscape';
	const ratio = photo.width / photo.height;
	if (ratio > 1.15) return 'landscape';
	if (ratio < 0.87) return 'portrait';
	return 'square';
}

/**
 * How many of the next photos belong in one 'auto' composition, looking only
 * at what's actually coming up (never the whole remaining set) so this stays
 * a local, explainable rule: a strong landscape photo gets to breathe alone;
 * phones never group more than one at a time (legibility); two or three
 * portrait/square photos in a row pair or trio nicely side by side.
 */
function chooseAutoGroupSize(remaining: SlideshowPhoto[], viewport: ViewportCategory): 1 | 2 | 3 {
	if (viewport === 'phone') return 1;
	const [first, second, third] = remaining;
	if (!first || aspectCategory(first) === 'landscape') return 1;
	if (viewport === 'desktop' && second && third && aspectCategory(second) !== 'landscape' && aspectCategory(third) !== 'landscape') {
		return 3;
	}
	if (second && aspectCategory(second) !== 'landscape') return 2;
	return 1;
}

/**
 * Groups authorized photos (already in display order - see
 * listMediaForPersonViewer) into compositions. Never fabricates a slide to
 * fill a position: a requested size larger than what's left just produces a
 * smaller final composition instead.
 */
export function groupIntoCompositions(
	photos: SlideshowPhoto[],
	collageSize: CollageSize,
	viewport: ViewportCategory
): SlideshowComposition[] {
	const compositions: SlideshowComposition[] = [];
	let index = 0;
	while (index < photos.length) {
		const remaining = photos.slice(index);
		const size = collageSize === 'auto' ? chooseAutoGroupSize(remaining, viewport) : collageSize;
		const slice = remaining.slice(0, Math.max(1, Math.min(size, remaining.length)));
		compositions.push({ photos: slice, layout: layoutForCount(slice.length) });
		index += slice.length;
	}
	return compositions;
}

/** Collage choices offered for a viewport - phone drops 3/4 for legibility (master prompt). */
export function availableCollageSizes(viewport: ViewportCategory): CollageSize[] {
	return viewport === 'phone' ? [1, 2, 'auto'] : [1, 2, 3, 4, 'auto'];
}

/** Falls back to 'auto' if a stored/requested size isn't offered at this viewport (e.g. 4 on a phone after resizing from desktop). */
export function clampCollageSizeForViewport(size: CollageSize, viewport: ViewportCategory): CollageSize {
	return availableCollageSizes(viewport).includes(size) ? size : 'auto';
}

export function viewportCategoryFromWidth(width: number): ViewportCategory {
	if (width < 600) return 'phone';
	if (width < 1024) return 'tablet';
	return 'desktop';
}

/**
 * Wraps in both directions - Next from the last composition returns to the
 * first, Previous from the first returns to the last. With only one
 * composition (photo count below the collage size), this correctly "repeats"
 * immediately, which is the one allowed exception to the no-repeat rule.
 */
export function nextPosition(position: number, total: number): number {
	if (total <= 0) return 0;
	return (position + 1) % total;
}

export function previousPosition(position: number, total: number): number {
	if (total <= 0) return 0;
	return (position - 1 + total) % total;
}

/** Deterministic PRNG from a numeric seed - same seed always produces the same order, so shuffle stays stable for one slideshow session instead of rerolling on every render. */
function mulberry32(seed: number): () => number {
	let a = seed;
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** A permutation of 0..count-1, deterministic for a given seed (Fisher-Yates driven by mulberry32). */
export function shuffledOrder(count: number, seed: number): number[] {
	const order = Array.from({ length: count }, (_, i) => i);
	const rand = mulberry32(seed);
	for (let i = order.length - 1; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1));
		[order[i], order[j]] = [order[j], order[i]];
	}
	return order;
}

/** Composition indices in playback order - identity when shuffle is off (chronological, the default), shuffledOrder when it's on. */
export function orderedCompositionIndices(total: number, shuffle: boolean, seed: number): number[] {
	if (!shuffle) return Array.from({ length: total }, (_, i) => i);
	return shuffledOrder(total, seed);
}

const HOLD_DURATION_MS: Record<Speed, number> = { slow: 8000, normal: 5000, fast: 3000 };

/** How long one composition stays on screen before auto-advancing. */
export function holdDurationMs(speed: Speed): number {
	return HOLD_DURATION_MS[speed];
}

/** Matches tokens.css's --duration-slow (360ms), the slowest transition already in this project's motion scale - restrained, editorial, nothing longer. */
export const TRANSITION_DURATION_MS = 360;

/** Reduced motion means an immediate change, not a slower one - crossfades drop to 0ms rather than lingering. */
export function transitionDurationMs(reducedMotion: boolean): number {
	return reducedMotion ? 0 : TRANSITION_DURATION_MS;
}

export interface SlideshowPreferences {
	speed: Speed;
	collageSize: CollageSize;
	transitionStyle: TransitionStyle;
}

export const DEFAULT_SLIDESHOW_PREFERENCES: SlideshowPreferences = {
	speed: 'normal',
	collageSize: 'auto',
	transitionStyle: 'fade'
};

const VALID_SPEEDS: ReadonlySet<string> = new Set(['slow', 'normal', 'fast']);
const VALID_COLLAGE_SIZES: ReadonlySet<CollageSize> = new Set([1, 2, 3, 4, 'auto']);
const VALID_TRANSITION_STYLES: ReadonlySet<string> = new Set(['fade', 'slide', 'zoom']);

/**
 * Defends against corrupted/foreign localStorage JSON (a hand-edited value,
 * a future version's shape, outright garbage) - always returns a safe,
 * usable preference set rather than throwing or passing bad data through.
 * Never reads viewer identity, audience info or media URLs (none are ever
 * stored here in the first place).
 */
export function validateSlideshowPreferences(raw: unknown): SlideshowPreferences {
	if (!raw || typeof raw !== 'object') return DEFAULT_SLIDESHOW_PREFERENCES;
	const obj = raw as Record<string, unknown>;
	const speed = VALID_SPEEDS.has(obj.speed as string) ? (obj.speed as Speed) : DEFAULT_SLIDESHOW_PREFERENCES.speed;
	const collageSize = VALID_COLLAGE_SIZES.has(obj.collageSize as CollageSize)
		? (obj.collageSize as CollageSize)
		: DEFAULT_SLIDESHOW_PREFERENCES.collageSize;
	const transitionStyle = VALID_TRANSITION_STYLES.has(obj.transitionStyle as string)
		? (obj.transitionStyle as TransitionStyle)
		: DEFAULT_SLIDESHOW_PREFERENCES.transitionStyle;
	return { speed, collageSize, transitionStyle };
}
