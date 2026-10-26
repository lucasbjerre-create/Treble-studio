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

test('the RSS feed never includes a private, delayed or family-only entry, in either language', async ({ page }) => {
	for (const lang of ['en', 'da']) {
		const response = await page.goto(`/${lang}/rss.xml`);
		expect(response?.status()).toBe(200);
		const xml = await response!.text();
		expect(xml).not.toContain('private-draft-thoughts');
		expect(xml).not.toContain('still-settling-in');
		expect(xml).not.toContain('remark-grocery-store');
		// Still a genuine feed, not just an empty shell that happens to pass by omission.
		expect(xml).toContain('leaving-copenhagen');
	}
});

test('the sitemap never includes a private, delayed or family-only entry URL, in either language', async ({ page }) => {
	const response = await page.goto('/sitemap.xml');
	expect(response?.status()).toBe(200);
	const xml = await response!.text();
	expect(xml).not.toContain('private-draft-thoughts');
	expect(xml).not.toContain('still-settling-in');
	expect(xml).not.toContain('remark-grocery-store');
	expect(xml).toContain('/en/lucas/leaving-copenhagen');
	expect(xml).toContain('/da/lucas/leaving-copenhagen');
});

test('a 404d private/delayed/family entry carries no link-preview meta tags for it to leak through', async ({ page }) => {
	for (const slug of ['private-draft-thoughts', 'still-settling-in', 'remark-grocery-store']) {
		const response = await page.goto(`/en/lucas/${slug}`);
		expect(response?.status()).toBe(404);
		const ogTitle = await page.locator('meta[property="og:title"]').count();
		expect(ogTitle).toBe(0);
	}
});

test('an eligible public entry carries its own link-preview meta tags, with no coordinates in them', async ({ page }) => {
	await page.goto('/en/lucas/leaving-copenhagen');
	await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', 'Thanks for now, Copenhagen');
	const description = await page.locator('meta[property="og:description"]').getAttribute('content');
	expect(description).toBe('Last day at home.');
	expect(description).not.toMatch(/-?\d{1,3}\.\d+,\s*-?\d{1,3}\.\d+/); // no "lat, lon"-shaped text
	await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
		'content',
		'https://treble.cordoza.dk/en/lucas/leaving-copenhagen'
	);
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
