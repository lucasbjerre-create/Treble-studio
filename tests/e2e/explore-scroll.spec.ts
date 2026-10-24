import { test, expect } from '@playwright/test';

// Separate file (not just a separate test) deliberately: Playwright's
// test.use() applies to every test in a file regardless of declaration
// order, so it can't share a file with a test that needs the default
// viewport (confirmed directly - that was the actual cause of this test
// suite's flakiness, not the app). A short viewport is needed here: with
// only two short fixture cards, "nearest to viewport center" can only ever
// select the last card if there's enough scroll range below it to actually
// bring its center up to the viewport's center line. Measured directly:
// at 800x400 there isn't quite enough (maxScroll falls just short of the
// threshold); at 800x220 there reliably is.
test.use({ viewport: { width: 800, height: 220 } });

test('scrolling the journal moves state and the URL the same way as the slider/marker', async ({ page }) => {
	await page.goto('/en/lucas/explore');
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
