/**
 * Builds the "With Anna, Erik" line shown below a public photo - null when
 * nobody's tagged, so callers can skip rendering it entirely rather than
 * showing an empty line.
 */
export function peopleNoteFor(names: string[], withLabel: string): string | null {
	if (names.length === 0) return null;
	return `${withLabel} ${names.join(', ')}`;
}
