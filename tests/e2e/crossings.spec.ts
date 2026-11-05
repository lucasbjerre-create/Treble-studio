import { expect, test } from '@playwright/test';

// Runs against the seeded fixture: a confirmed crossing at Asheville between
// Lucas (person 1, family-only entry there) and Anna (person 2, public
// entry there) - src/db/seed.sql. A public viewer (no login, the default
// here) must see the marker (Anna's entry makes the crossing visible at
// all) but its popup must only ever link Anna's entry, never Lucas's
// family-only one - the same per-person-family rule src/db/queries.ts
// enforces server-side, now checked live in the browser too.

test('a confirmed crossing shows a marker on the map, and its popup links only the participant whose entry is actually visible', async ({
	page
}) => {
	await page.goto('/en/lucas/explore');

	await page.waitForFunction(() => {
		const map = (window as unknown as { __explorerMap?: { isStyleLoaded(): boolean } }).__explorerMap;
		return Boolean(map?.isStyleLoaded());
	});

	await expect(page.locator('.crossing-marker')).toHaveCount(1);

	// Asheville isn't either visible entry for a public viewer on this page
	// (Lucas's own entry there is family-only, so it's never in the active
	// slider), so the automatic camera never points at it - zooming out by
	// hand first, same as explore.spec.ts's "revealed by zooming out" test.
	await page.evaluate(() => {
		(window as unknown as { __explorerMap: { jumpTo(opts: { center: [number, number]; zoom: number }): void } }).__explorerMap.jumpTo({
			center: [-80.8, 35.75],
			zoom: 6
		});
	});

	const point = await page.evaluate(() => {
		const map = (window as unknown as { __explorerMap: { project(c: [number, number]): { x: number; y: number } } }).__explorerMap;
		return map.project([-82.55, 35.6]);
	});
	const box = await page.locator('.map-container canvas').boundingBox();
	if (!box) throw new Error('map canvas not found');
	await page.mouse.click(box.x + point.x, box.y + point.y - 10);

	const popup = page.locator('.crossing-popup-card');
	await expect(popup).toBeVisible();
	await expect(popup).toContainText('Anna');

	const links = popup.locator('a.crossing-popup-entry');
	await expect(links).toHaveCount(1);
	await expect(links.first()).toHaveAttribute('href', '/en/anna/anna-weekend-in-asheville');
});
