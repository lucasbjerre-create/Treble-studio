export type Precision = 'exact' | 'area' | 'city' | 'hidden';

export interface Coordinates {
	lat: number;
	lon: number;
}

// Rounding granularity per precision tier. Spec says "city or area level"
// without a number - this is my own reasonable reading, not a spec-given
// figure: city ~1 decimal degree (~11km grid), area ~2 decimals (~1.1km).
const CITY_DECIMALS = 1;
const AREA_DECIMALS = 2;

function round(value: number, decimals: number): number {
	const factor = 10 ** decimals;
	return Math.round(value * factor) / factor;
}

/**
 * Public coordinates derived from private ones by rounding to the chosen
 * precision (spec: "public point derived on the server by rounding").
 * `hidden` returns no public point at all. `exact` passes through unrounded -
 * the spec restricts this tier to public landmarks only, which is Lucas's
 * judgement when picking it in the studio, not something this function
 * enforces.
 */
export function publicCoordinatesForPrecision(coords: Coordinates, precision: Precision): Coordinates | null {
	switch (precision) {
		case 'hidden':
			return null;
		case 'city':
			return { lat: round(coords.lat, CITY_DECIMALS), lon: round(coords.lon, CITY_DECIMALS) };
		case 'area':
			return { lat: round(coords.lat, AREA_DECIMALS), lon: round(coords.lon, AREA_DECIMALS) };
		case 'exact':
			return { lat: coords.lat, lon: coords.lon };
	}
}
