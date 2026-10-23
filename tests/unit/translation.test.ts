import { describe, expect, it } from 'vitest';
import { resolveEntryText } from '../../src/lib/translation';

const entry = {
	originalLang: 'da' as const,
	title: 'Tak for nu',
	dek: 'Sidste dag.',
	bodyMd: 'Dansk tekst.'
};

describe('resolveEntryText', () => {
	it('uses the entry fields directly when the requested language is the original', () => {
		const result = resolveEntryText(entry, undefined, 'da');
		expect(result).toEqual({ title: 'Tak for nu', dek: 'Sidste dag.', bodyMd: 'Dansk tekst.', isFallback: false });
	});

	it('uses the approved translation when the requested language differs', () => {
		const translation = { title: 'Thanks for now', dek: 'Last day.', bodyMd: 'English text.', status: 'approved' as const };
		const result = resolveEntryText(entry, translation, 'en');
		expect(result).toEqual({ title: 'Thanks for now', dek: 'Last day.', bodyMd: 'English text.', isFallback: false });
	});

	it('falls back to the original with isFallback=true when no translation exists', () => {
		const result = resolveEntryText(entry, undefined, 'en');
		expect(result).toEqual({ title: 'Tak for nu', dek: 'Sidste dag.', bodyMd: 'Dansk tekst.', isFallback: true });
	});

	it('falls back to the original when the translation is not yet approved', () => {
		const translation = { title: 'Draft title', dek: null, bodyMd: null, status: 'draft' as const };
		const result = resolveEntryText(entry, translation, 'en');
		expect(result.isFallback).toBe(true);
		expect(result.title).toBe('Tak for nu');
	});
});
