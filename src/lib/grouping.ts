export interface GroupableEntry {
	chapterId: number | null;
	occurredAt: string;
}

export interface MonthGroup<T> {
	/** 'YYYY-MM' */
	monthKey: string;
	entries: T[];
}

export interface ChapterGroup<T> {
	chapterId: number | null;
	months: MonthGroup<T>[];
}

/**
 * Groups entries by chapter then month, preserving the order chapters and
 * months are first encountered in the input - callers pass entries already
 * sorted the way they want them displayed (e.g. newest first).
 */
export function groupEntriesByChapterAndMonth<T extends GroupableEntry>(entries: T[]): ChapterGroup<T>[] {
	const chapterOrder: Array<number | null> = [];
	const byChapter = new Map<number | null, Map<string, T[]>>();

	for (const entry of entries) {
		const { chapterId } = entry;
		const monthKey = entry.occurredAt.slice(0, 7);

		let byMonth = byChapter.get(chapterId);
		if (!byMonth) {
			byMonth = new Map();
			byChapter.set(chapterId, byMonth);
			chapterOrder.push(chapterId);
		}

		let monthEntries = byMonth.get(monthKey);
		if (!monthEntries) {
			monthEntries = [];
			byMonth.set(monthKey, monthEntries);
		}
		monthEntries.push(entry);
	}

	return chapterOrder.map((chapterId) => {
		const byMonth = byChapter.get(chapterId);
		if (!byMonth) throw new Error('unreachable: chapterOrder and byChapter are built together');
		return {
			chapterId,
			months: Array.from(byMonth.entries()).map(([monthKey, monthEntries]) => ({
				monthKey,
				entries: monthEntries
			}))
		};
	});
}
