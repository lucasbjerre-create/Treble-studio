import { DRAFT_EXPIRY_DAYS } from '../config/site';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whole days left before a draft auto-deletes - a simple day countdown, not
 * precise to the hour or minute, per Lucas's own instruction. Floors the
 * elapsed time so "created 2 minutes ago" and "created 23 hours ago" both
 * read as day 0, not off-by-one from a fractional day.
 */
export function daysUntilDraftExpiry(createdAt: string, now: string): number {
	const elapsedDays = Math.floor((new Date(now).getTime() - new Date(createdAt).getTime()) / DAY_MS);
	return Math.max(0, DRAFT_EXPIRY_DAYS - elapsedDays);
}

/** Whether a draft is old enough to auto-delete - the cutoff daysUntilDraftExpiry counts down to zero. */
export function isDraftExpired(createdAt: string, now: string): boolean {
	return daysUntilDraftExpiry(createdAt, now) <= 0;
}
