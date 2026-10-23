import { test, expect } from '@playwright/test';

// Runs against the seeded fixture: entry 1 = leaving-copenhagen (2026-08-15,
// Copenhagen), entry 2 = arriving-in-chapel-hill (2026-08-16, Chapel Hill) -
// the only two entries visible to a public viewer.

test('the slider and a marker click stay in sync via the URL', async ({ page }) => {
	await page.goto('/en/explore');

	await page.waitForFunction(() => {
		const map = (window as unknown as { __explorerMap?: { isStyleLoaded(): boolean } }).__explorerMap;
		return Boolean(map?.isStyleLoaded());
	});

	// Opens on the latest entry.
	await expect(page).toHaveURL(/at=2026-08-16/);

	const slider = page.locator('input[type="range"]');
	const max = await slider.getAttribute('max');

	// Drag the slider to the earliest entry.
	await slider.fill('0');
	await expect(page).toHaveURL(/at=2026-08-15/);

	// Back to the latest, so both markers are visible (fitBounds frames every revealed marker).
	await slider.fill(max ?? '1');
	await expect(page).toHaveURL(/at=2026-08-16/);
	await page.waitForTimeout(1200); // let the camera settle

	// Click the Copenhagen marker directly on the map canvas.
	const point = await page.evaluate(() => {
		const map = (window as unknown as { __explorerMap: { project(c: [number, number]): { x: number; y: number } } })
			.__explorerMap;
		return map.project([12.5683, 55.6761]);
	});
	const box = await page.locator('.map-container canvas').boundingBox();
	if (!box) throw new Error('map canvas not found');
	await page.mouse.click(box.x + point.x, box.y + point.y);

	await expect(page).toHaveURL(/at=2026-08-15/);
	await expect(page.locator('#entry-1')).toBeInViewport();
});

// Separate test, short viewport: with only two fixture cards, a default
// 1280x720 viewport leaves barely any scroll range (the page is ~940px
// tall), so the two cards' positions are too close to tell apart by
// scrolling. A short viewport gives an unambiguous amount of scroll room.
test.use({ viewport: { width: 800, height: 400 } });

test('scrolling the journal moves state and the URL the same way as the slider/marker', async ({ page }) => {
	await page.goto('/en/explore');
	await page.waitForFunction(() => {
		const map = (window as unknown as { __explorerMap?: { isStyleLoaded(): boolean } }).__explorerMap;
		return Boolean(map?.isStyleLoaded());
	});

	await page.evaluate(() => window.scrollTo(0, 0));
	await page.waitForTimeout(300);
	await expect(page).toHaveURL(/at=2026-08-16/); // entry-2, the topmost card

	await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
	await page.waitForTimeout(300);
	await expect(page).toHaveURL(/at=2026-08-15/); // entry-1, the bottommost card
});

test('/journal never loads MapLibre', async ({ page }) => {
	const mapLibreRequests: string[] = [];
	page.on('request', (req) => {
		if (req.url().includes('maplibre')) mapLibreRequests.push(req.url());
	});

	await page.goto('/en/journal');
	await page.waitForTimeout(500);

	expect(mapLibreRequests).toEqual([]);
	await expect(page.locator('canvas')).toHaveCount(0);
});
