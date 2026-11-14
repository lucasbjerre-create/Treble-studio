import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { beforeAll, describe, expect, it } from 'vitest';
import { updateMediaTextForOwner } from '../../src/db/queries';
import * as schema from '../../src/db/schema';

const now = '2026-10-23T12:00:00.000Z';

// Lucas's photo and Anna's photo - the ids are fixed so each test can name
// the row it means.
const LUCAS_MEDIA_ID = 1;
const ANNA_MEDIA_ID = 2;

function db() {
	return drizzle(env.DB, { schema });
}

async function readText(mediaId: number) {
	const rows = await db()
		.select({ caption: schema.media.caption, altText: schema.media.altText })
		.from(schema.media)
		.where(eq(schema.media.id, mediaId));
	return rows[0];
}

beforeAll(async () => {
	const d = db();
	await d.insert(schema.people).values([
		{ id: 1, slug: 'lucas', displayName: 'Lucas', role: 'scholar', createdAt: now },
		{ id: 2, slug: 'anna', displayName: 'Anna', role: 'scholar', createdAt: now }
	]);
	await d.insert(schema.places).values({ id: 1, label: 'Asheville', latPublic: 35.6, lonPublic: -82.55, precision: 'city' });

	const baseEntry = {
		placeId: 1,
		format: 'moment' as const,
		category: 'trip' as const,
		status: 'draft' as const,
		audience: 'private' as const,
		originalLang: 'en' as const,
		title: 'Untitled',
		timezone: 'America/New_York',
		occurredAt: now,
		createdAt: now,
		updatedAt: now
	};
	await d.insert(schema.entries).values([
		{ ...baseEntry, id: 1, personId: 1, slug: 'lucas-entry' },
		{ ...baseEntry, id: 2, personId: 2, slug: 'anna-entry' }
	]);

	await d.insert(schema.media).values([
		{ id: LUCAS_MEDIA_ID, entryId: 1, ownerId: 1, kind: 'photo', sortOrder: 0 },
		{ id: ANNA_MEDIA_ID, entryId: 2, ownerId: 2, kind: 'photo', sortOrder: 0 }
	]);
});

// Every test writes the starting values it needs itself, so none of them
// depends on what an earlier test left behind.
describe('updateMediaTextForOwner', () => {
	it('lets the owner set a caption and alt text', async () => {
		const updated = await updateMediaTextForOwner(db(), LUCAS_MEDIA_ID, 1, {
			caption: 'Fog over the ridge',
			altText: 'A mountain ridge half hidden by low cloud'
		});

		expect(updated).toBe(true);
		expect(await readText(LUCAS_MEDIA_ID)).toEqual({
			caption: 'Fog over the ridge',
			altText: 'A mountain ridge half hidden by low cloud'
		});
	});

	it('lets the owner clear both again with null', async () => {
		await updateMediaTextForOwner(db(), LUCAS_MEDIA_ID, 1, { caption: 'To be cleared', altText: 'To be cleared' });

		const updated = await updateMediaTextForOwner(db(), LUCAS_MEDIA_ID, 1, { caption: null, altText: null });

		expect(updated).toBe(true);
		expect(await readText(LUCAS_MEDIA_ID)).toEqual({ caption: null, altText: null });
	});

	it('returns false for a different person and leaves the row unchanged', async () => {
		await updateMediaTextForOwner(db(), LUCAS_MEDIA_ID, 1, { caption: 'Lucas wrote this', altText: 'Lucas described this' });

		// Anna is a real person with a photo of her own - she just does not own this one.
		const updated = await updateMediaTextForOwner(db(), LUCAS_MEDIA_ID, 2, {
			caption: 'Anna was here',
			altText: 'Anna was here'
		});

		expect(updated).toBe(false);
		expect(await readText(LUCAS_MEDIA_ID)).toEqual({ caption: 'Lucas wrote this', altText: 'Lucas described this' });
	});

	it('returns false for a different person trying to clear the text, too', async () => {
		await updateMediaTextForOwner(db(), LUCAS_MEDIA_ID, 1, { caption: 'Still here', altText: 'Still here' });

		expect(await updateMediaTextForOwner(db(), LUCAS_MEDIA_ID, 2, { caption: null, altText: null })).toBe(false);
		expect(await readText(LUCAS_MEDIA_ID)).toEqual({ caption: 'Still here', altText: 'Still here' });
	});

	it('never touches another photo, only the one named', async () => {
		await updateMediaTextForOwner(db(), ANNA_MEDIA_ID, 2, { caption: 'Anna caption', altText: 'Anna alt text' });

		await updateMediaTextForOwner(db(), LUCAS_MEDIA_ID, 1, { caption: 'Lucas caption', altText: 'Lucas alt text' });

		expect(await readText(ANNA_MEDIA_ID)).toEqual({ caption: 'Anna caption', altText: 'Anna alt text' });
	});

	it('updating only the caption leaves the alt text untouched', async () => {
		await updateMediaTextForOwner(db(), LUCAS_MEDIA_ID, 1, { caption: 'First caption', altText: 'Alt text to keep' });

		const updated = await updateMediaTextForOwner(db(), LUCAS_MEDIA_ID, 1, { caption: 'Second caption' });

		expect(updated).toBe(true);
		expect(await readText(LUCAS_MEDIA_ID)).toEqual({ caption: 'Second caption', altText: 'Alt text to keep' });
	});

	it('updating only the alt text leaves the caption untouched', async () => {
		await updateMediaTextForOwner(db(), LUCAS_MEDIA_ID, 1, { caption: 'Caption to keep', altText: 'First alt text' });

		const updated = await updateMediaTextForOwner(db(), LUCAS_MEDIA_ID, 1, { altText: 'Second alt text' });

		expect(updated).toBe(true);
		expect(await readText(LUCAS_MEDIA_ID)).toEqual({ caption: 'Caption to keep', altText: 'Second alt text' });
	});

	it('clearing one field with null leaves the other untouched', async () => {
		await updateMediaTextForOwner(db(), LUCAS_MEDIA_ID, 1, { caption: 'Caption to clear', altText: 'Alt text to keep' });

		const updated = await updateMediaTextForOwner(db(), LUCAS_MEDIA_ID, 1, { caption: null });

		expect(updated).toBe(true);
		expect(await readText(LUCAS_MEDIA_ID)).toEqual({ caption: null, altText: 'Alt text to keep' });
	});

	it('returns false for a media id that does not exist', async () => {
		expect(await updateMediaTextForOwner(db(), 9999, 1, { caption: 'Nobody home' })).toBe(false);
	});

	it('returns false and writes nothing for a patch with neither field', async () => {
		await updateMediaTextForOwner(db(), LUCAS_MEDIA_ID, 1, { caption: 'Unchanged caption', altText: 'Unchanged alt text' });

		expect(await updateMediaTextForOwner(db(), LUCAS_MEDIA_ID, 1, {})).toBe(false);
		expect(await readText(LUCAS_MEDIA_ID)).toEqual({ caption: 'Unchanged caption', altText: 'Unchanged alt text' });
	});
});
