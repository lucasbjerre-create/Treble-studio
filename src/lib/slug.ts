// æ/ø aren't decomposable by Unicode normalization (unlike å, which is
// "a" + a combining ring) - NFKD alone would just drop them instead of
// transliterating, which matters since titles are routinely Danish.
const DANISH_REPLACEMENTS: Record<string, string> = { æ: 'ae', ø: 'o', Æ: 'ae', Ø: 'o' };

/** Lowercase, hyphenated, ASCII-only - a reasonable default slug from a title. */
export function slugify(title: string): string {
	const transliterated = title.replace(/[æøÆØ]/g, (ch) => DANISH_REPLACEMENTS[ch] ?? ch);
	return (
		transliterated
			.normalize('NFKD')
			.replace(/[̀-ͯ]/g, '') // strip remaining accents (å, é, etc.)
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '') || 'entry'
	);
}
