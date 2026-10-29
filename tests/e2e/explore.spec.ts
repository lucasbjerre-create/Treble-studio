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

async function waitForCameraToStop(page: import('@playwright/test').Page) {
	// Not a fixed delay: the Denmark->Chapel Hill hop gets the longer
	// cinematic duration (CAMERA_CINEMATIC_MS, src/config/map.ts), longer
	// than a fixed wait here used to assume.
	await page.waitForFunction(() => {
		const map = (window as unknown as { __explorerMap?: { isMoving(): boolean } }).__explorerMap;
		return Boolean(map && !map.isMoving());
	});
}

test('the slider moves the URL and zooms the camera in on each entry', async ({ page }) => {
	await page.goto('/en/lucas/explore');

	await page.waitForFunction(() => {
		const map = (window as unknown as { __explorerMap?: { isStyleLoaded(): boolean } }).__explorerMap;
		return Boolean(map?.isStyleLoaded());
	});

	// Opens on the latest entry (Chapel Hill), already zoomed in tightly on it
	// rather than fitted to the whole revealed route - the slider points at
	// one day at a time (TimelineExplorer.tsx's syncMapToState).
	await expect(page).toHaveURL(/at=2026-08-16/);
	await waitForCameraToStop(page);
	const chapelHillZoom = await page.evaluate(() => (window as unknown as { __explorerMap: { getZoom(): number } }).__explorerMap.getZoom());
	expect(chapelHillZoom).toBeGreaterThan(6); // MAP_DEFAULT_ZOOM (2) + 5

	const slider = page.locator('input[type="range"]');
	const max = await slider.getAttribute('max');

	// Drag the slider to the earliest entry - the camera flies across the
	// Atlantic to Copenhagen instead of just widening to fit both.
	await setSlider(slider, '0');
	await expect(page).toHaveURL(/at=2026-08-15/);
	await waitForCameraToStop(page);
	const copenhagenCenter = await page.evaluate(() => {
		const c = (window as unknown as { __explorerMap: { getCenter(): { lng: number; lat: number } } }).__explorerMap.getCenter();
		return [c.lng, c.lat];
	});
	expect(copenhagenCenter[0]).toBeCloseTo(12.56, 0);
	expect(copenhagenCenter[1]).toBeCloseTo(55.67, 0);

	// Back to the latest.
	await setSlider(slider, max ?? '1');
	await expect(page).toHaveURL(/at=2026-08-16/);
	await waitForCameraToStop(page);
});

test('clicking a marker revealed by zooming out navigates, then the camera zooms back in on it', async ({ page }) => {
	await page.goto('/en/lucas/explore');
	await page.waitForFunction(() => {
		const map = (window as unknown as { __explorerMap?: { isStyleLoaded(): boolean } }).__explorerMap;
		return Boolean(map?.isStyleLoaded());
	});
	await expect(page).toHaveURL(/at=2026-08-16/);
	await waitForCameraToStop(page);

	// The automatic camera only shows the active entry now, so seeing a
	// different entry's marker to click it means zooming out by hand first -
	// exactly what a reader exploring the map themselves would do.
	await page.evaluate(() => {
		(window as unknown as { __explorerMap: { jumpTo(opts: { center: [number, number]; zoom: number }): void } }).__explorerMap.jumpTo({
			center: [-33, 45],
			zoom: 2
		});
	});

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

	// The click's own navigation re-triggers the tight per-entry zoom.
	await waitForCameraToStop(page);
	const zoomAfterClick = await page.evaluate(() => (window as unknown as { __explorerMap: { getZoom(): number } }).__explorerMap.getZoom());
	expect(zoomAfterClick).toBeGreaterThan(6);
});

test('shows the active entry as a photo+title popup card, and date-stamps the slider', async ({ page }) => {
	await page.goto('/en/lucas/explore');
	await page.waitForFunction(() => {
		const map = (window as unknown as { __explorerMap?: { isStyleLoaded(): boolean } }).__explorerMap;
		return Boolean(map?.isStyleLoaded());
	});

	await expect(page.locator('.entry-popup-title')).toHaveText('Landed in Chapel Hill');
	await expect(page.locator('.entry-popup-card')).toHaveAttribute('href', '/en/lucas/arriving-in-chapel-hill');

	// Exact wording is timezone-sensitive (Intl.DateTimeFormat on a UTC
	// timestamp) - just prove a real date rendered, one tick per entry, and
	// the active one marked.
	await expect(page.locator('.slider-date-stamp')).toContainText(/\d/);
	await expect(page.locator('.slider-tick')).toHaveCount(2);
	await expect(page.locator('.slider-tick--active')).toHaveCount(1);
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
