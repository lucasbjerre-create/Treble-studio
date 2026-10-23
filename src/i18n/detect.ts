import type { Locale } from './t';

/**
 * First-visit language: browser language if Danish, otherwise English.
 * Provisional default from docs/BUILD_PLAN.md until spec section 14.3 is settled.
 */
export function detectLocale(acceptLanguageHeader: string | null): Locale {
	if (!acceptLanguageHeader) return 'en';
	const primary = acceptLanguageHeader.split(',')[0]?.trim().toLowerCase() ?? '';
	return primary.startsWith('da') ? 'da' : 'en';
}
