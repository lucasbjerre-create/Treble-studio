import { localMonthKey } from './entryDate';

export interface GroupableEntry {
	chapterId: number | null;
	occurredAt: string;
	/** The entry's own IANA timezone - months follow the local calendar where the entry happened, not UTC. */
	timezone: string;
}

export interface MonthGroup<T> {
	/** 'YYYY-MM', in the entries' own local time */
	monthKey: string;
	year: number;
	/** 1-12 */
	month: number;
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
 *
 * The month is the entry's local one (src/lib/entryDate.ts): an evening on
 * 31 October in Chapel Hill is already 1 November in UTC, and belongs under
 * October.
 */
export function groupEntriesByChapterAndMonth<T extends GroupableEntry>(entries: T[]): ChapterGroup<T>[] {
	const chapterOrder: Array<number | null> = [];
	const byChapter = new Map<number | null, Map<string, T[]>>();

	for (const entry of entries) {
		const { chapterId } = entry;
		const monthKey = localMonthKey(entry.occurredAt, entry.timezone);

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
				year: Number(monthKey.slice(0, 4)),
				month: Number(monthKey.slice(5, 7)),
				entries: monthEntries
			}))
		};
	});
}
