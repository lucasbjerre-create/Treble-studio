import { describe, expect, it } from 'vitest';
import { timezoneFromGps } from '../../src/lib/timezoneFromGps';

describe('timezoneFromGps', () => {
	it('returns Europe/Copenhagen for Copenhagen coordinates', () => {
		expect(timezoneFromGps({ latitude: 55.6761, longitude: 12.5683 })).toBe('Europe/Copenhagen');
	});

	it('returns America/New_York for Philadelphia airport coordinates', () => {
		expect(timezoneFromGps({ latitude: 39.8719, longitude: -75.2411 })).toBe('America/New_York');
	});

	it('returns null when there is no GPS', () => {
		expect(timezoneFromGps({ latitude: null, longitude: null })).toBeNull();
	});
});
