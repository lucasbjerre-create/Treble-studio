/** Up to 3 letters for a scholar marker label (map-theme.json: "initials, 2 or 3 letters"). */
export function initialsFor(displayName: string): string {
	const letters = displayName
		.split(/\s+/)
		.map((word) => word.match(/^\p{L}/u)?.[0])
		.filter((letter): letter is string => Boolean(letter));

	return letters.slice(0, 3).join('').toUpperCase();
}
