import { describe, expect, it } from 'vitest';
import { initialsFor } from '../../src/lib/initials';

describe('initialsFor', () => {
	it('takes the first letter of up to three words', () => {
		expect(initialsFor('Anna Hansen')).toBe('AH');
	});

	it('caps at three letters for a long name', () => {
		expect(initialsFor('Anna Marie Hansen Søndergaard')).toBe('AMH');
	});

	it('handles a single-word name', () => {
		expect(initialsFor('Madonna')).toBe('M');
	});

	it('ignores a parenthetical that does not start with a letter', () => {
		expect(initialsFor('Lucas (fixture)')).toBe('L');
	});

	it('uppercases lowercase input', () => {
		expect(initialsFor('anna hansen')).toBe('AH');
	});

	it('collapses repeated whitespace', () => {
		expect(initialsFor('Anna   Hansen')).toBe('AH');
	});
});
