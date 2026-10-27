import { describe, expect, it } from 'vitest';
import { daysUntilDraftExpiry, isDraftExpired } from '../../src/lib/draftExpiry';

describe('daysUntilDraftExpiry', () => {
	it('counts down from 8 on the day a draft is created', () => {
		expect(daysUntilDraftExpiry('2026-10-01T12:00:00.000Z', '2026-10-01T23:59:00.000Z')).toBe(8);
	});

	it('ignores hours and minutes within the same elapsed day', () => {
		expect(daysUntilDraftExpiry('2026-10-01T00:05:00.000Z', '2026-10-01T23:55:00.000Z')).toBe(8);
	});

	it('counts down by whole days as time passes', () => {
		expect(daysUntilDraftExpiry('2026-10-01T12:00:00.000Z', '2026-10-04T12:00:00.000Z')).toBe(5);
	});

	it('floors at zero once the window has fully passed', () => {
		expect(daysUntilDraftExpiry('2026-10-01T12:00:00.000Z', '2026-10-20T12:00:00.000Z')).toBe(0);
	});

	it('reaches zero exactly at the 8 day mark', () => {
		expect(daysUntilDraftExpiry('2026-10-01T12:00:00.000Z', '2026-10-09T12:00:00.000Z')).toBe(0);
	});
});

describe('isDraftExpired', () => {
	it('is false right after creation', () => {
		expect(isDraftExpired('2026-10-01T12:00:00.000Z', '2026-10-01T12:00:00.000Z')).toBe(false);
	});

	it('is true once 8 days have passed', () => {
		expect(isDraftExpired('2026-10-01T12:00:00.000Z', '2026-10-09T12:01:00.000Z')).toBe(true);
	});
});
