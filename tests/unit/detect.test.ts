import { describe, expect, it } from 'vitest';
import { detectLocale } from '../../src/i18n/detect';

describe('detectLocale', () => {
	it('always returns en', () => {
		expect(detectLocale()).toBe('en');
	});
});
