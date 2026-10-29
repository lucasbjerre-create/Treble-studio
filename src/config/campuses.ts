// Fixed campus points, from docs/brand/map-theme.json's "campuses" list -
// these never move, so they're a plain constant rather than data from D1.
export interface Campus {
	id: string;
	nameEn: string;
	nameDa: string;
	code: string;
	lon: number;
	lat: number;
	glyph: string;
}

export const CAMPUSES: Campus[] = [
	{
		id: 'chapel-hill',
		nameEn: 'Chapel Hill',
		nameDa: 'Chapel Hill',
		code: 'RDU',
		lon: -79.0469,
		lat: 35.9049,
		glyph: '/brand/icons/campus_chapel-hill.png'
	},
	{
		id: 'copenhagen',
		nameEn: 'Copenhagen',
		nameDa: 'København',
		code: 'CPH',
		lon: 12.5292,
		lat: 55.6814,
		glyph: '/brand/icons/campus_copenhagen.png'
	},
	{
		id: 'singapore',
		nameEn: 'Singapore',
		nameDa: 'Singapore',
		code: 'SIN',
		lon: 103.85,
		lat: 1.2966,
		glyph: '/brand/icons/campus_singapore.png'
	}
];
