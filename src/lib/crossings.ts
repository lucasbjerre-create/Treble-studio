/**
 * Suggests crossings: moments when two or more scholars were in the same
 * place on overlapping (or back-to-back) dates. Pure and computed only -
 * nothing here is a confirmed crossing. Confirmation is manual and mutual,
 * per scholar, done elsewhere (spec section 10 / BUILD_PLAN milestone 6).
 *
 * map-theme.json's crossing_rule talks about "within 2km", but this project's
 * data model only has discrete place rows (not raw GPS per stay), so "same
 * place" here means the same placeId - the practical equivalent once stays
 * are already grouped at city/area precision.
 */

export interface Stay {
	personId: number;
	placeId: number;
	/** Inclusive, 'YYYY-MM-DD'. */
	startsOn: string;
	/** Inclusive, 'YYYY-MM-DD'. */
	endsOn: string;
}

export interface CrossingSuggestion {
	placeId: number;
	personIds: number[];
	/** Inclusive, 'YYYY-MM-DD' - the overlapping group's earliest start. */
	startsOn: string;
	/** Inclusive, 'YYYY-MM-DD' - the overlapping group's latest end. */
	endsOn: string;
}

export interface DateRange {
	/** Inclusive, 'YYYY-MM-DD'. */
	startsOn: string;
	/** Inclusive, 'YYYY-MM-DD'. */
	endsOn: string;
}

/**
 * Consecutive-day ranges merge into one crossing (map-theme.json: "Merge
 * consecutive days at the same place into one crossing"), so a gap of
 * exactly one day still counts - only a gap of two or more days doesn't.
 * Exported for createCrossingFromSuggestion's dedupe check (src/db/queries.ts).
 */
export function dateRangesOverlapOrAdjacent(a: DateRange, b: DateRange): boolean {
	const aEnd = addDays(a.endsOn, 1);
	const bEnd = addDays(b.endsOn, 1);
	return a.startsOn <= bEnd && b.startsOn <= aEnd;
}

/** Same people, regardless of order - used to recognise an existing crossing as the same one being re-suggested. */
export function sameParticipants(a: number[], b: number[]): boolean {
	if (a.length !== b.length) return false;
	const sortedA = [...a].sort((x, y) => x - y);
	const sortedB = [...b].sort((x, y) => x - y);
	return sortedA.every((id, i) => id === sortedB[i]);
}

function datesOverlapOrAdjacent(a: Stay, b: Stay): boolean {
	return dateRangesOverlapOrAdjacent(a, b);
}

function addDays(isoDate: string, days: number): string {
	const date = new Date(`${isoDate}T00:00:00.000Z`);
	date.setUTCDate(date.getUTCDate() + days);
	return date.toISOString().slice(0, 10);
}

/**
 * Suggests crossings from a list of stays (one row per person per trip/place
 * - the caller derives these from trips, not raw entries, since trips are
 * what actually carry a date range). Groups transitively: if A overlaps B
 * and B overlaps C at the same place, all three land in one crossing even if
 * A and C don't directly overlap each other.
 */
export function suggestCrossings(stays: Stay[]): CrossingSuggestion[] {
	const suggestions: CrossingSuggestion[] = [];

	const byPlace = new Map<number, Stay[]>();
	for (const stay of stays) {
		const list = byPlace.get(stay.placeId) ?? [];
		list.push(stay);
		byPlace.set(stay.placeId, list);
	}

	for (const [placeId, placeStays] of byPlace) {
		const sorted = [...placeStays].sort((a, b) => (a.startsOn < b.startsOn ? -1 : a.startsOn > b.startsOn ? 1 : 0));
		const used = new Array(sorted.length).fill(false);

		for (let i = 0; i < sorted.length; i++) {
			if (used[i]) continue;
			const group: Stay[] = [sorted[i]];
			used[i] = true;

			// Keep absorbing any not-yet-used stay that overlaps/is-adjacent to
			// anything already in the group, until a full pass adds nothing new.
			let grew = true;
			while (grew) {
				grew = false;
				for (let j = 0; j < sorted.length; j++) {
					if (used[j]) continue;
					if (group.some((member) => datesOverlapOrAdjacent(member, sorted[j]))) {
						group.push(sorted[j]);
						used[j] = true;
						grew = true;
					}
				}
			}

			const personIds = [...new Set(group.map((s) => s.personId))];
			if (personIds.length < 2) continue; // one person alone is not a crossing

			suggestions.push({
				placeId,
				personIds: personIds.sort((a, b) => a - b),
				startsOn: group.reduce((min, s) => (s.startsOn < min ? s.startsOn : min), group[0].startsOn),
				endsOn: group.reduce((max, s) => (s.endsOn > max ? s.endsOn : max), group[0].endsOn)
			});
		}
	}

	return suggestions.sort((a, b) => (a.startsOn < b.startsOn ? -1 : a.startsOn > b.startsOn ? 1 : a.placeId - b.placeId));
}
