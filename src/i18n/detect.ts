import type { Locale } from './t';

/**
 * First-visit language: always English. Settled in spec section 14.3 -
 * no browser-language detection. Visitors switch to Danish themselves.
 */
export function detectLocale(): Locale {
	return 'en';
}
