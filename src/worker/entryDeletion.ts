// Shared by the delete/bulk-delete routes below and the lazy stale-draft
// sweep in src/pages/studio/index.astro, so there's exactly one place that
// knows every table a row in `entries` touches (media.ts.0401's DELETE
// /media/:id handler is the model: R2 objects first, then child rows, then
// the entry itself).
import { env } from 'cloudflare:workers';
import { and, eq, inArray, isNull, lt } from 'drizzle-orm';
import { DRAFT_EXPIRY_DAYS } from '../config/site';
import type { getDb } from '../db/client';
import * as schema from '../db/schema';

type Database = ReturnType<typeof getDb>;

export async function deleteEntryCascade(db: Database, entryId: number): Promise<void> {
	const mediaRows = await db.select().from(schema.media).where(eq(schema.media.entryId, entryId));
	const mediaIds = mediaRows.map((m) => m.id);
	const keys = mediaRows.flatMap((m) => [m.keyThumb, m.keyDisplay, m.keyLarge].filter((k): k is string => k !== null));
	await Promise.all(keys.map((key) => env.MEDIA.delete(key)));

	if (mediaIds.length > 0) {
		await db.delete(schema.mediaPeople).where(inArray(schema.mediaPeople.mediaId, mediaIds));
		await db.delete(schema.media).where(eq(schema.media.entryId, entryId));
	}
	await db.delete(schema.entryTags).where(eq(schema.entryTags.entryId, entryId));
	await db.delete(schema.assignments).where(eq(schema.assignments.entryId, entryId));
	await db.delete(schema.reactions).where(eq(schema.reactions.entryId, entryId));
	await db.delete(schema.questions).where(eq(schema.questions.entryId, entryId));
	await db.delete(schema.reviewEvents).where(eq(schema.reviewEvents.entryId, entryId));
	await db.delete(schema.entryTexts).where(eq(schema.entryTexts.entryId, entryId));
	await db.delete(schema.entries).where(eq(schema.entries.id, entryId));
}

/**
 * Deletes this person's own drafts older than DRAFT_EXPIRY_DAYS - the one
 * named exception to studio.md's "automation never deletes" (see that file's
 * history for the amendment). Never touches a published entry, and - just as
 * importantly - never touches an entry that WAS published and has since been
 * taken back to draft via /unpublish: publishedAt is left as-is by that
 * route specifically so this isNull check excludes it. Without that, an old
 * entry's original createdAt (correctly never touched by unpublish) would
 * already be past the expiry window the moment it's unpublished, and the
 * very next studio page load would auto-delete it for real - caught live
 * while building /unpublish, see its own comment. Runs lazily, the next
 * time the studio entries list loads after the window passes - deliberately
 * no background cron, since nothing needs deleting when nobody is looking at
 * the site either.
 */
export async function sweepStaleDrafts(db: Database, personId: number, now: string): Promise<number> {
	const cutoff = new Date(new Date(now).getTime() - DRAFT_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
	const stale = await db
		.select({ id: schema.entries.id })
		.from(schema.entries)
		.where(
			and(
				eq(schema.entries.personId, personId),
				eq(schema.entries.status, 'draft'),
				isNull(schema.entries.publishedAt),
				lt(schema.entries.createdAt, cutoff)
			)
		);
	for (const row of stale) {
		await deleteEntryCascade(db, row.id);
	}
	return stale.length;
}
