import { describe, expect, it } from 'vitest';
import { isEntryVisible, isLegVisible, type EntryVisibilityInput } from '../../src/lib/visibility';

const now = '2026-10-23T12:00:00.000Z';
const past = '2026-10-01T00:00:00.000Z';
const future = '2026-11-01T00:00:00.000Z';

describe('isEntryVisible', () => {
	it('studio sees everything regardless of status or audience', () => {
		expect(isEntryVisible({ status: 'draft', audience: 'private', publishAfter: null }, 'studio', now)).toBe(
			true
		);
	});

	it('nobody but studio sees an unpublished entry', () => {
		const draft: EntryVisibilityInput = { status: 'draft', audience: 'public', publishAfter: null };
		expect(isEntryVisible(draft, 'public', now)).toBe(false);
		expect(isEntryVisible(draft, 'family', now)).toBe(false);
	});

	it('public never sees a private or family-only entry', () => {
		expect(isEntryVisible({ status: 'published', audience: 'private', publishAfter: null }, 'public', now)).toBe(
			false
		);
		expect(isEntryVisible({ status: 'published', audience: 'family', publishAfter: null }, 'public', now)).toBe(
			false
		);
	});

	it('family never sees a private entry', () => {
		expect(isEntryVisible({ status: 'published', audience: 'private', publishAfter: null }, 'family', now)).toBe(
			false
		);
	});

	it('family sees a published family or public entry regardless of delay', () => {
		const delayed: EntryVisibilityInput = { status: 'published', audience: 'family', publishAfter: future };
		expect(isEntryVisible(delayed, 'family', now)).toBe(true);
	});

	it('public sees a published public entry with no delay', () => {
		expect(isEntryVisible({ status: 'published', audience: 'public', publishAfter: null }, 'public', now)).toBe(
			true
		);
	});

	it('public never sees a published public entry still inside its delay', () => {
		expect(isEntryVisible({ status: 'published', audience: 'public', publishAfter: future }, 'public', now)).toBe(
			false
		);
	});

	it('public sees a published public entry once its delay has passed', () => {
		expect(isEntryVisible({ status: 'published', audience: 'public', publishAfter: past }, 'public', now)).toBe(
			true
		);
	});
});

describe('isLegVisible', () => {
	it('studio sees future legs', () => {
		expect(isLegVisible({ startsAt: future }, 'studio', now)).toBe(true);
	});

	it('public and family never see a future-dated leg', () => {
		expect(isLegVisible({ startsAt: future }, 'public', now)).toBe(false);
		expect(isLegVisible({ startsAt: future }, 'family', now)).toBe(false);
	});

	it('public and family see a past leg', () => {
		expect(isLegVisible({ startsAt: past }, 'public', now)).toBe(true);
		expect(isLegVisible({ startsAt: past }, 'family', now)).toBe(true);
	});
});
