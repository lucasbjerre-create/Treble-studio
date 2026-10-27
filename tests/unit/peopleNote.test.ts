import { describe, expect, it } from 'vitest';
import { peopleNoteFor } from '../../src/lib/peopleNote';

describe('peopleNoteFor', () => {
	it('returns null for no names, so callers can skip rendering', () => {
		expect(peopleNoteFor([], 'With')).toBeNull();
	});

	it('joins one name with the label', () => {
		expect(peopleNoteFor(['Anna'], 'With')).toBe('With Anna');
	});

	it('joins several names with commas', () => {
		expect(peopleNoteFor(['Anna', 'Erik', 'Mia'], 'With')).toBe('With Anna, Erik, Mia');
	});

	it('uses whatever label the caller passes, for Danish', () => {
		expect(peopleNoteFor(['Anna'], 'Med')).toBe('Med Anna');
	});
});
