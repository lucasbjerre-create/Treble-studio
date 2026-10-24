import { describe, expect, it } from 'vitest';
import { publicCoordinatesForPrecision } from '../../src/lib/precision';

const chapelHill = { lat: 35.913215, lon: -79.055847 };

describe('publicCoordinatesForPrecision', () => {
	it('returns null for hidden - no public point at all', () => {
		expect(publicCoordinatesForPrecision(chapelHill, 'hidden')).toBeNull();
	});

	it('rounds to a coarser grid for city', () => {
		expect(publicCoordinatesForPrecision(chapelHill, 'city')).toEqual({ lat: 35.9, lon: -79.1 });
	});

	it('rounds to a finer grid for area', () => {
		expect(publicCoordinatesForPrecision(chapelHill, 'area')).toEqual({ lat: 35.91, lon: -79.06 });
	});

	it('passes through unrounded for exact', () => {
		expect(publicCoordinatesForPrecision(chapelHill, 'exact')).toEqual(chapelHill);
	});

	it('area is finer-grained than city for the same point', () => {
		const city = publicCoordinatesForPrecision(chapelHill, 'city')!;
		const area = publicCoordinatesForPrecision(chapelHill, 'area')!;
		// area keeps more decimal precision than city for a non-trivial coordinate.
		expect(String(area.lat).replace('-', '').split('.')[1]?.length ?? 0).toBeGreaterThanOrEqual(
			String(city.lat).replace('-', '').split('.')[1]?.length ?? 0
		);
	});
});
