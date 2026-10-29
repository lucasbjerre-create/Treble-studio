import { test, expect } from '@playwright/test';

// Separate file (not just a separate test) deliberately: Playwright's
// test.use() applies to every test in a file regardless of declaration
// order, so it can't share a file with a test that needs the default
// viewport. A shorter-than-default viewport keeps the page taller than one
// screenful even with only two short fixture cards, so centering each card
// in turn (centerCard below) produces genuinely different scroll positions
// rather than both landing at the same clamped scrollY=0. Not pixel-tuned
// the way an exact scrollHeight match would need to be - centerCard computes
// its target from the card's own measured position, not a fixed number.
test.use({ viewport: { width: 800, height: 400 } });

// Centers a specific journal card in the viewport, rather than scrolling to
// the literal document top/bottom - that used to work here, but is brittle
// by construction (this spec's own viewport is already pixel-tuned once,
// see the test.use() comment above) since it depends on the exact total
// page height staying within a narrow band forever. Centering the actual
// card under test instead directly exercises "nearest to viewport center"
// (TimelineExplorer.tsx's updateActiveFromScroll) regardless of how tall
// anything above or below the journal list happens to be.
async function centerCard(page: import('@playwright/test').Page, index: number) {
	await page.evaluate((i) => {
		const card = document.querySelectorAll<HTMLElement>('.journal-card')[i];
		const rect = card.getBoundingClientRect();
		const targetY = window.scrollY + rect.top + rect.height / 2 - window.innerHeight / 2;
		window.scrollTo(0, targetY);
	}, index);
}

test('scrolling the journal moves state and the URL the same way as the slider/marker', async ({ page }) => {
	await page.goto('/en/lucas/explore');
	await page.waitForFunction(() => {
		const map = (window as unknown as { __explorerMap?: { isStyleLoaded(): boolean } }).__explorerMap;
		return Boolean(map?.isStyleLoaded());
	});

	const cards = page.locator('.journal-card');
	await expect(cards).toHaveCount(2);

	await centerCard(page, 0);
	await page.waitForTimeout(300);
	await expect(page).toHaveURL(/at=2026-08-16/); // entry-2, the topmost card

	await centerCard(page, 1);
	await page.waitForTimeout(300);
	await expect(page).toHaveURL(/at=2026-08-15/); // entry-1, the bottommost card
});
