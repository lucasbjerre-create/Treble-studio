export type Viewer = 'public' | 'family' | 'studio';

export interface EntryVisibilityInput {
	status: string;
	audience: 'private' | 'family' | 'public';
	publishAfter: string | null;
}

/**
 * publish_after gates the public tier only: family already knows where Lucas
 * is, so the delay exists to protect against strangers, not family.
 */
export function isEntryVisible(entry: EntryVisibilityInput, viewer: Viewer, now: string): boolean {
	if (viewer === 'studio') return true;
	if (entry.status !== 'published') return false;

	if (viewer === 'family') {
		return entry.audience === 'family' || entry.audience === 'public';
	}

	if (entry.audience !== 'public') return false;
	return entry.publishAfter === null || now >= entry.publishAfter;
}

export interface LegVisibilityInput {
	startsAt: string;
}

/** Legs dated after now are never returned to public or family viewers. */
export function isLegVisible(leg: LegVisibilityInput, viewer: Viewer, now: string): boolean {
	if (viewer === 'studio') return true;
	return leg.startsAt <= now;
}
