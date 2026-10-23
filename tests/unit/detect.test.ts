import { describe, expect, it } from 'vitest';
import { detectLocale } from '../../src/i18n/detect';

describe('detectLocale', () => {
	it('returns da when the browser prefers Danish', () => {
		expect(detectLocale('da-DK,da;q=0.9,en;q=0.8')).toBe('da');
	});

	it('returns en for any non-Danish language', () => {
		expect(detectLocale('fr-FR,fr;q=0.9')).toBe('en');
	});

	it('returns en when there is no header', () => {
		expect(detectLocale(null)).toBe('en');
	});
});
