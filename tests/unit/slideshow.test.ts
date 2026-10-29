import { describe, expect, it } from 'vitest';
import {
	availableCollageSizes,
	clampCollageSizeForViewport,
	DEFAULT_SLIDESHOW_PREFERENCES,
	groupIntoCompositions,
	holdDurationMs,
	nextPosition,
	orderedCompositionIndices,
	previousPosition,
	shuffledOrder,
	transitionDurationMs,
	validateSlideshowPreferences,
	viewportCategoryFromWidth,
	type SlideshowPhoto
} from '../../src/lib/slideshow';

function photo(id: number, overrides: Partial<SlideshowPhoto> = {}): SlideshowPhoto {
	return {
		id,
		entryId: id,
		keyDisplay: `media/${id}-display.webp`,
		keyLarge: `media/${id}-large.webp`,
		width: 1600,
		height: 1200,
		caption: null,
		altText: null,
		occurredAt: `2026-09-${String(10 + id).padStart(2, '0')}T10:00:00.000Z`,
		...overrides
	};
}

describe('groupIntoCompositions', () => {
	it('returns nothing for zero photos', () => {
		expect(groupIntoCompositions([], 'auto', 'desktop')).toEqual([]);
	});

	it('puts a single photo in its own composition', () => {
		const result = groupIntoCompositions([photo(1)], 'auto', 'desktop');
		expect(result).toHaveLength(1);
		expect(result[0].photos.map((p) => p.id)).toEqual([1]);
		expect(result[0].layout).toBe('single');
	});

	it('never fabricates a slide to fill a requested collage size', () => {
		const result = groupIntoCompositions([photo(1), photo(2)], 4, 'desktop');
		expect(result).toHaveLength(1);
		expect(result[0].photos).toHaveLength(2);
		expect(result[0].layout).toBe('duo');
	});

	it('groups a fixed collage size of 2 across many photos, with a smaller final composition', () => {
		const photos = [photo(1), photo(2), photo(3), photo(4), photo(5)];
		const result = groupIntoCompositions(photos, 2, 'desktop');
		expect(result.map((c) => c.photos.length)).toEqual([2, 2, 1]);
		expect(result.map((c) => c.layout)).toEqual(['duo', 'duo', 'single']);
	});

	it('exhausts every photo exactly once, in order, for a fixed collage size', () => {
		const photos = [photo(1), photo(2), photo(3), photo(4), photo(5)];
		const result = groupIntoCompositions(photos, 3, 'desktop');
		const seen = result.flatMap((c) => c.photos.map((p) => p.id));
		expect(seen).toEqual([1, 2, 3, 4, 5]);
	});

	it('auto mode never groups more than one photo on a phone viewport', () => {
		const photos = [photo(1, { width: 1200, height: 1600 }), photo(2, { width: 1200, height: 1600 }), photo(3)];
		const result = groupIntoCompositions(photos, 'auto', 'phone');
		expect(result.every((c) => c.photos.length === 1)).toBe(true);
	});

	it('auto mode lets a landscape photo stand alone', () => {
		const photos = [photo(1, { width: 2000, height: 1000 }), photo(2, { width: 1200, height: 1600 })];
		const result = groupIntoCompositions(photos, 'auto', 'desktop');
		expect(result[0].photos).toHaveLength(1);
		expect(result[0].photos[0].id).toBe(1);
	});

	it('auto mode pairs two portrait photos on desktop', () => {
		const photos = [photo(1, { width: 1200, height: 1600 }), photo(2, { width: 1200, height: 1600 }), photo(3, { width: 2000, height: 1000 })];
		const result = groupIntoCompositions(photos, 'auto', 'desktop');
		expect(result[0].photos.map((p) => p.id)).toEqual([1, 2]);
		expect(result[0].layout).toBe('duo');
	});

	it('auto mode groups three non-landscape photos on desktop', () => {
		const photos = [photo(1, { width: 1200, height: 1600 }), photo(2, { width: 1000, height: 1000 }), photo(3, { width: 1200, height: 1600 }), photo(4, { width: 2000, height: 1000 })];
		const result = groupIntoCompositions(photos, 'auto', 'desktop');
		expect(result[0].photos.map((p) => p.id)).toEqual([1, 2, 3]);
		expect(result[0].layout).toBe('trio');
	});

	it('treats a photo with missing dimensions as landscape (stands alone, never crashes)', () => {
		const photos = [photo(1, { width: null, height: null }), photo(2, { width: 1200, height: 1600 })];
		const result = groupIntoCompositions(photos, 'auto', 'desktop');
		expect(result[0].photos).toHaveLength(1);
	});

	it('preserves stable chronological ordering, including timestamp ties', () => {
		const photos = [
			photo(1, { occurredAt: '2026-09-10T10:00:00.000Z' }),
			photo(2, { occurredAt: '2026-09-10T10:00:00.000Z' }),
			photo(3, { occurredAt: '2026-09-09T10:00:00.000Z' })
		];
		// Input order is already the caller's chronological order (the query
		// sorts it) - grouping must not reorder it, tie or not.
		const result = groupIntoCompositions(photos, 1, 'desktop');
		expect(result.map((c) => c.photos[0].id)).toEqual([1, 2, 3]);
	});
});

describe('availableCollageSizes / clampCollageSizeForViewport', () => {
	it('drops 3 and 4 on phone', () => {
		expect(availableCollageSizes('phone')).toEqual([1, 2, 'auto']);
		expect(availableCollageSizes('desktop')).toEqual([1, 2, 3, 4, 'auto']);
	});

	it('clamps an unavailable size back to auto', () => {
		expect(clampCollageSizeForViewport(4, 'phone')).toBe('auto');
		expect(clampCollageSizeForViewport(2, 'phone')).toBe(2);
		expect(clampCollageSizeForViewport(4, 'desktop')).toBe(4);
	});
});

describe('viewportCategoryFromWidth', () => {
	it('buckets phone, tablet and desktop', () => {
		expect(viewportCategoryFromWidth(400)).toBe('phone');
		expect(viewportCategoryFromWidth(800)).toBe('tablet');
		expect(viewportCategoryFromWidth(1400)).toBe('desktop');
	});
});

describe('nextPosition / previousPosition', () => {
	it('wraps forward past the last composition', () => {
		expect(nextPosition(2, 3)).toBe(0);
	});

	it('wraps backward past the first composition', () => {
		expect(previousPosition(0, 3)).toBe(2);
	});

	it('repeats the same single composition when there is only one (the documented exception)', () => {
		expect(nextPosition(0, 1)).toBe(0);
		expect(previousPosition(0, 1)).toBe(0);
	});

	it('is a no-op on zero compositions rather than dividing by zero', () => {
		expect(nextPosition(0, 0)).toBe(0);
		expect(previousPosition(0, 0)).toBe(0);
	});
});

describe('shuffledOrder / orderedCompositionIndices', () => {
	it('produces a permutation of 0..count-1', () => {
		const order = shuffledOrder(10, 42);
		expect([...order].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
	});

	it('is deterministic for the same seed', () => {
		expect(shuffledOrder(12, 7)).toEqual(shuffledOrder(12, 7));
	});

	it('can differ for a different seed', () => {
		expect(shuffledOrder(12, 7)).not.toEqual(shuffledOrder(12, 99));
	});

	it('defaults to chronological order when shuffle is off', () => {
		expect(orderedCompositionIndices(5, false, 1)).toEqual([0, 1, 2, 3, 4]);
	});

	it('uses a shuffled order when shuffle is on', () => {
		expect(orderedCompositionIndices(5, true, 1)).toEqual(shuffledOrder(5, 1));
	});
});

describe('holdDurationMs / transitionDurationMs', () => {
	it('maps every supported speed to a positive duration, slow > normal > fast', () => {
		expect(holdDurationMs('slow')).toBeGreaterThan(holdDurationMs('normal'));
		expect(holdDurationMs('normal')).toBeGreaterThan(holdDurationMs('fast'));
	});

	it('drops the transition to instant under reduced motion', () => {
		expect(transitionDurationMs(true)).toBe(0);
		expect(transitionDurationMs(false)).toBeGreaterThan(0);
	});
});

describe('validateSlideshowPreferences', () => {
	it('returns the defaults for garbage input', () => {
		expect(validateSlideshowPreferences(null)).toEqual(DEFAULT_SLIDESHOW_PREFERENCES);
		expect(validateSlideshowPreferences('nonsense')).toEqual(DEFAULT_SLIDESHOW_PREFERENCES);
		expect(validateSlideshowPreferences(42)).toEqual(DEFAULT_SLIDESHOW_PREFERENCES);
	});

	it('returns the defaults when fields are the wrong type or value', () => {
		expect(validateSlideshowPreferences({ speed: 'ludicrous', collageSize: 99 })).toEqual(DEFAULT_SLIDESHOW_PREFERENCES);
	});

	it('keeps valid fields as-is', () => {
		expect(validateSlideshowPreferences({ speed: 'fast', collageSize: 3 })).toEqual({ speed: 'fast', collageSize: 3 });
	});

	it('validates each field independently, keeping the valid one', () => {
		expect(validateSlideshowPreferences({ speed: 'fast', collageSize: 'bogus' })).toEqual({ speed: 'fast', collageSize: 'auto' });
	});
});
