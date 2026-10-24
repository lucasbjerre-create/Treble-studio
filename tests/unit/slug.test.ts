import { describe, expect, it } from 'vitest';
import { slugify } from '../../src/lib/slug';

describe('slugify', () => {
	it('lowercases and hyphenates', () => {
		expect(slugify('Landed in Chapel Hill')).toBe('landed-in-chapel-hill');
	});

	it('transliterates Danish æ/ø/å (not just drops them)', () => {
		expect(slugify('Tak for nu, København')).toBe('tak-for-nu-kobenhavn');
		expect(slugify('Sidste dag på kærlighed')).toBe('sidste-dag-pa-kaerlighed');
	});

	it('strips punctuation and collapses repeated separators', () => {
		expect(slugify('Wait... what?! (really)')).toBe('wait-what-really');
	});

	it('trims leading/trailing hyphens', () => {
		expect(slugify('  -- hello -- ')).toBe('hello');
	});

	it('falls back to "entry" for input with nothing sluggable', () => {
		expect(slugify('???')).toBe('entry');
	});
});
