import { describe, expect, it } from 'vitest';
import { formatBytes, paragraphsFrom } from '../../src/lib/text';

describe('paragraphsFrom', () => {
	it('splits on blank lines and trims each paragraph', () => {
		expect(paragraphsFrom('First.\n\nSecond.  \n\n  Third.')).toEqual(['First.', 'Second.', 'Third.']);
	});

	it('returns an empty array for null or empty input', () => {
		expect(paragraphsFrom(null)).toEqual([]);
		expect(paragraphsFrom('')).toEqual([]);
		expect(paragraphsFrom('   ')).toEqual([]);
	});

	it('returns a single paragraph when there are no blank lines', () => {
		expect(paragraphsFrom('Just one line.')).toEqual(['Just one line.']);
	});
});

describe('formatBytes', () => {
	it('rounds to whole megabytes', () => {
		expect(formatBytes(3_000_000)).toBe('3 MB');
		expect(formatBytes(734_003_200)).toBe('700 MB');
	});

	it('reads as 0 MB rather than a confusing decimal for less than a megabyte', () => {
		expect(formatBytes(500_000)).toBe('0 MB');
	});

	it('reads as 0 MB for zero', () => {
		expect(formatBytes(0)).toBe('0 MB');
	});
});
