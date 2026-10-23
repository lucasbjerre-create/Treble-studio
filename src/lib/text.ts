/**
 * Splits body text on blank lines into paragraphs. Real Markdown rendering
 * (bold, links, etc.) isn't wired up yet - no entry currently needs it, and
 * adding a parser dependency for unused syntax would be premature. Bodies
 * render as plain paragraphs until that's actually needed.
 */
export function paragraphsFrom(bodyMd: string | null): string[] {
	if (!bodyMd) return [];
	return bodyMd
		.split(/\n\s*\n/)
		.map((p) => p.trim())
		.filter((p) => p.length > 0);
}
