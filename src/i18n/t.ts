import { en, type Dictionary } from './en';
import { da } from './da';

export type Locale = 'en' | 'da';

export const LOCALES: readonly Locale[] = ['en', 'da'];

export function isLocale(value: string): value is Locale {
	return (LOCALES as readonly string[]).includes(value);
}

const dictionaries: Record<Locale, Dictionary> = { en, da };

export function t(locale: Locale): Dictionary {
	return dictionaries[locale];
}
