import { test, expect } from '@playwright/test';

// Runs against the seeded fixture journey (src/db/seed.sql). Locks in the
// milestone 2 done-when requirement: delayed and private seed entries never
// appear anywhere public.

test('a private draft entry 404s for a public viewer', async ({ page }) => {
	const response = await page.goto('/en/lucas/private-draft-thoughts');
	expect(response?.status()).toBe(404);
});

test('a still-delayed public entry 404s for a public viewer', async ({ page }) => {
	const response = await page.goto('/en/lucas/still-settling-in');
	expect(response?.status()).toBe(404);
});

test('a family-only entry 404s for a public viewer', async ({ page }) => {
	const response = await page.goto('/en/lucas/remark-grocery-store');
	expect(response?.status()).toBe(404);
});

test('the homepage never links to a private, delayed or family-only entry', async ({ page }) => {
	await page.goto('/en/');
	const links = await page.locator('a[href^="/en/lucas/"]').all();
	const hrefs = await Promise.all(links.map((link) => link.getAttribute('href')));
	expect(hrefs).not.toContain('/en/lucas/private-draft-thoughts');
	expect(hrefs).not.toContain('/en/lucas/still-settling-in');
	expect(hrefs).not.toContain('/en/lucas/remark-grocery-store');
});

test('the archive never lists a private, delayed or family-only entry, in any category filter', async ({ page }) => {
	for (const category of [undefined, 'life', 'school', 'trip']) {
		await page.goto(category ? `/en/archive?category=${category}` : '/en/archive');
		const links = await page.locator('a[href^="/en/lucas/"]').all();
		const hrefs = await Promise.all(links.map((link) => link.getAttribute('href')));
		expect(hrefs).not.toContain('/en/lucas/private-draft-thoughts');
		expect(hrefs).not.toContain('/en/lucas/still-settling-in');
		expect(hrefs).not.toContain('/en/lucas/remark-grocery-store');
	}
});

test('a genuinely eligible public entry renders in both languages', async ({ page }) => {
	const en = await page.goto('/en/lucas/leaving-copenhagen');
	expect(en?.status()).toBe(200);
	// Scoped to main: Astro's dev toolbar also injects its own <h1>s into the page.
	await expect(page.locator('main h1')).toHaveText('Thanks for now, Copenhagen');

	const da = await page.goto('/da/lucas/leaving-copenhagen');
	expect(da?.status()).toBe(200);
	await expect(page.locator('main h1')).toHaveText('Tak for nu, København');
});
