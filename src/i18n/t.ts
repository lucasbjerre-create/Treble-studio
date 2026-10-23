import { en, type Dictionary } from './en';
import { da } from './da';

export type Locale = 'en' | 'da';

const dictionaries: Record<Locale, Dictionary> = { en, da };

export function t(locale: Locale): Dictionary {
	return dictionaries[locale];
}
