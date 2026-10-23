import { describe, expect, it } from 'vitest';
import { paragraphsFrom } from '../../src/lib/text';

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
