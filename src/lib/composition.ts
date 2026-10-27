export type Composition = 'short_dispatch' | 'standard_story' | 'photo_sequence' | 'feature_chapter';

// Spec section 5 lists 8 entry formats but section 6 wants only 4
// compositions. This mapping is the design decision bridging them - see
// the milestone 2 plan for the reasoning behind each grouping.
const COMPOSITION_BY_FORMAT: Record<string, Composition> = {
	remark: 'short_dispatch',
	postcard: 'short_dispatch',
	moment: 'standard_story',
	note: 'standard_story',
	clip: 'photo_sequence',
	feature: 'feature_chapter',
	recap: 'feature_chapter',
	milestone: 'feature_chapter'
};

export function compositionForFormat(format: string): Composition {
	return COMPOSITION_BY_FORMAT[format] ?? 'standard_story';
}

export interface MediaForDisplay {
	id: number;
	kind: 'photo' | 'clip' | 'audio' | 'pdf';
	keyThumb: string | null;
	keyDisplay: string | null;
	keyLarge: string | null;
	posterKey: string | null;
	width: number | null;
	height: number | null;
	caption: string | null;
	altText: string | null;
	/** Pre-resolved "With Anna, Erik" line (src/lib/peopleNote.ts), or null when nobody's tagged. Not the box geometry - that stays studio-only. */
	peopleNote: string | null;
}

export interface EntryForDisplay {
	title: string;
	dek: string | null;
	bodyMd: string | null;
	occurredAt: string;
	timezone: string;
	format: string;
	translationNote: string | null;
}
