// Pure ingest logic from BUILD_PLAN.md milestone 9 ("Smart ingest") / spec
// section 8's "Days and moments" and "Routes" steps. No UI tonight
// (OVERNIGHT.md task 6) - these just group/propose, a studio screen built
// later calls them and lets Lucas confirm or change everything.
import { distance } from '@turf/distance';

export interface IngestItem {
	id: number;
	/** ISO instant the photo/clip/note was captured or written. */
	capturedAt: string;
	/** Known place at capture time, or null if not yet resolved (e.g. no GPS). */
	placeId: number | null;
}

export interface Moment<T extends IngestItem = IngestItem> {
	items: T[];
	startedAt: string;
	endedAt: string;
	/** The first known placeId among this moment's items, if any. */
	placeId: number | null;
}

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

/**
 * Splits items into moments, starting a new one whenever there's a gap of
 * about two hours or a real change of place (spec section 8, step 4) -
 * "real" meaning both sides have a known place and it's actually different.
 * An item with no known place (no GPS yet) never itself triggers a split on
 * place grounds; it inherits the current moment unless the gap alone splits it.
 */
export function groupIntoMoments<T extends IngestItem>(items: T[], gapMs: number = TWO_HOURS_MS): Moment<T>[] {
	const sorted = [...items].sort((a, b) => (a.capturedAt < b.capturedAt ? -1 : a.capturedAt > b.capturedAt ? 1 : 0));
	const moments: Moment<T>[] = [];

	for (const item of sorted) {
		const current = moments.at(-1);
		const last = current?.items.at(-1);

		const gapTooLarge = last ? new Date(item.capturedAt).getTime() - new Date(last.capturedAt).getTime() > gapMs : false;
		const realPlaceChange =
			last && last.placeId !== null && item.placeId !== null && last.placeId !== item.placeId;

		if (!current || gapTooLarge || realPlaceChange) {
			moments.push({ items: [item], startedAt: item.capturedAt, endedAt: item.capturedAt, placeId: item.placeId });
		} else {
			current.items.push(item);
			current.endedAt = item.capturedAt;
			if (current.placeId === null) current.placeId = item.placeId;
		}
	}

	return moments;
}

export interface LegStop {
	placeId: number;
	/** [lon, lat] - GeoJSON order, never a bare pair without this comment (CLAUDE.md). */
	coordinates: [number, number];
}

export type ProposedMode = 'car' | 'flight';

export interface ProposedLeg {
	fromPlaceId: number;
	toPlaceId: number;
	mode: ProposedMode;
	distanceKm: number;
}

/** Over this distance the guess is a flight; under it, a car (spec section 8, step 3). */
const FLIGHT_DISTANCE_KM = 800;

/**
 * Proposes a leg whenever consecutive stops are in a different place,
 * guessing the mode from great-circle distance. Moving around inside one
 * place proposes nothing (spec section 8, step 5) - consecutive stops at the
 * same placeId are simply skipped, not turned into a zero-distance leg.
 * Lucas confirms or changes the mode with one tap in the studio either way -
 * this only picks a starting guess, per spec.
 */
export function proposeLegs(stops: LegStop[]): ProposedLeg[] {
	const legs: ProposedLeg[] = [];

	for (let i = 1; i < stops.length; i++) {
		const from = stops[i - 1];
		const to = stops[i];
		if (from.placeId === to.placeId) continue;

		const distanceKm = distance(from.coordinates, to.coordinates, { units: 'kilometers' });
		legs.push({
			fromPlaceId: from.placeId,
			toPlaceId: to.placeId,
			mode: distanceKm > FLIGHT_DISTANCE_KM ? 'flight' : 'car',
			distanceKm
		});
	}

	return legs;
}
