import { describe, expect, it } from 'vitest';
import { pixelRectToFraction, rectFromPoints } from '../../src/lib/boxes';

describe('rectFromPoints', () => {
	it('normalizes a drag that goes down-right', () => {
		expect(rectFromPoints(10, 10, 50, 40)).toEqual({ x: 10, y: 10, w: 40, h: 30 });
	});

	it('normalizes a drag that goes up-left', () => {
		expect(rectFromPoints(50, 40, 10, 10)).toEqual({ x: 10, y: 10, w: 40, h: 30 });
	});
});

describe('pixelRectToFraction', () => {
	it('converts a pixel rect to fractions of the container', () => {
		expect(pixelRectToFraction({ x: 100, y: 50, w: 200, h: 100 }, 1000, 500)).toEqual({
			x: 0.1,
			y: 0.1,
			w: 0.2,
			h: 0.2
		});
	});

	it('clamps a box that starts past the edge to zero size, not negative', () => {
		expect(pixelRectToFraction({ x: 1200, y: 50, w: 100, h: 100 }, 1000, 500)).toEqual({
			x: 1,
			y: 0.1,
			w: 0,
			h: 0.2
		});
	});

	it('clamps a box whose far edge overshoots the container', () => {
		const result = pixelRectToFraction({ x: 900, y: 50, w: 300, h: 100 }, 1000, 500);
		expect(result.x).toBe(0.9);
		expect(result.y).toBe(0.1);
		expect(result.w).toBeCloseTo(0.1);
		expect(result.h).toBe(0.2);
	});

	it('returns an empty box for a zero-size container instead of dividing by zero', () => {
		expect(pixelRectToFraction({ x: 10, y: 10, w: 10, h: 10 }, 0, 0)).toEqual({ x: 0, y: 0, w: 0, h: 0 });
	});
});
