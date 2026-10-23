export type Lang = 'da' | 'en';

export interface EntryTextSource {
	originalLang: Lang;
	title: string;
	dek: string | null;
	bodyMd: string | null;
}

export interface Translation {
	title: string | null;
	dek: string | null;
	bodyMd: string | null;
	status: 'draft' | 'approved';
}

export interface ResolvedText {
	title: string;
	dek: string | null;
	bodyMd: string | null;
	/** True when falling back to the original because no approved translation exists yet. */
	isFallback: boolean;
}

/**
 * If a translation is not approved yet, the original shows with a small note
 * saying so (spec section 6).
 */
export function resolveEntryText(entry: EntryTextSource, translation: Translation | undefined, lang: Lang): ResolvedText {
	if (lang === entry.originalLang) {
		return { title: entry.title, dek: entry.dek, bodyMd: entry.bodyMd, isFallback: false };
	}
	if (translation && translation.status === 'approved' && translation.title) {
		return { title: translation.title, dek: translation.dek, bodyMd: translation.bodyMd, isFallback: false };
	}
	return { title: entry.title, dek: entry.dek, bodyMd: entry.bodyMd, isFallback: true };
}
