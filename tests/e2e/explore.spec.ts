import { test, expect, type Locator } from '@playwright/test';

// Runs against the seeded fixture: entry 1 = leaving-copenhagen (2026-08-15,
// Copenhagen), entry 2 = arriving-in-chapel-hill (2026-08-16, Chapel Hill) -
// the only two entries visible to a public viewer.

// locator.fill() does not reliably fire a range input's native 'input' event
// across browsers/versions (confirmed by instrumenting the app directly -
// the onChange handler simply never ran for some fill() calls). Setting the
// value through the native setter and dispatching 'input' ourselves,
// mirroring exactly what manual browser testing confirmed works, is reliable.
async function setSlider(slider: Locator, value: string) {
	await slider.evaluate((el: HTMLInputElement, v: string) => {
		const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
		setter.call(el, v);
		el.dispatchEvent(new Event('input', { bubbles: true }));
	}, value);
}

test('the slider and a marker click stay in sync via the URL', async ({ page }) => {
	await page.goto('/en/lucas/explore');

	await page.waitForFunction(() => {
		const map = (window as unknown as { __explorerMap?: { isStyleLoaded(): boolean } }).__explorerMap;
		return Boolean(map?.isStyleLoaded());
	});

	// Opens on the latest entry.
	await expect(page).toHaveURL(/at=2026-08-16/);

	const slider = page.locator('input[type="range"]');
	const max = await slider.getAttribute('max');

	// Drag the slider to the earliest entry.
	await setSlider(slider, '0');
	await expect(page).toHaveURL(/at=2026-08-15/);

	// Back to the latest, so both markers are visible (fitBounds frames every revealed marker).
	await setSlider(slider, max ?? '1');
	await expect(page).toHaveURL(/at=2026-08-16/);
	// Waits for the camera to actually stop, not a fixed delay: the Denmark->
	// Chapel Hill hop gets the longer cinematic duration (CAMERA_CINEMATIC_MS,
	// src/config/map.ts), longer than a fixed wait here used to assume.
	await page.waitForFunction(() => {
		const map = (window as unknown as { __explorerMap?: { isMoving(): boolean } }).__explorerMap;
		return Boolean(map && !map.isMoving());
	});

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
