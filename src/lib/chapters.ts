export interface ChapterForLookup {
	startsOn: string;
}

/**
 * The most recently started chapter as of `today` ('YYYY-MM-DD'). Chapters
 * don't need a crisp end date for this to make sense - once the next
 * chapter starts, it becomes current.
 */
export function currentChapter<T extends ChapterForLookup>(chapters: T[], today: string): T | undefined {
	const started = chapters
		.filter((c) => c.startsOn <= today)
		.sort((a, b) => (a.startsOn < b.startsOn ? 1 : a.startsOn > b.startsOn ? -1 : 0));
	return started[0];
}
