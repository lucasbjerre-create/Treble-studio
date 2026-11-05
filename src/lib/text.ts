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

/** "412 MB" - whole megabytes, rounded, for the storage quota meter. Bytes under 1 MB still read as "0 MB" rather than a confusing decimal. */
export function formatBytes(bytes: number): string {
	return `${Math.round(bytes / (1024 * 1024))} MB`;
}
