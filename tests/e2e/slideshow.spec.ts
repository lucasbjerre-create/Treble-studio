import { test, expect } from '@playwright/test';

// Runs against the seeded fixture journey (src/db/seed.sql). Lucas's public
// photos: "The Copenhagen harbor on an overcast morning." (oldest) then
// "The UNC quad in late summer light." (newest). Anna has one public photo:
// "A mountain overlook near Asheville, Anna's photo."

test('launches from the explore page for the person in the URL, in both languages', async ({ page }) => {
	await page.goto('/en/lucas/explore');
	await page.getByRole('link', { name: 'Slideshow' }).click();
	await expect(page).toHaveURL('/en/lucas/slideshow');
	await expect(page.getByText('1 of 2')).toBeVisible();

	await page.goto('/da/lucas/explore');
	await page.getByRole('link', { name: 'Diasshow' }).click();
	await expect(page).toHaveURL('/da/lucas/slideshow');
	await expect(page.getByRole('button', { name: 'Afspil' })).toBeVisible();
});

test('does not autoplay before the visitor presses Play', async ({ page }) => {
	await page.goto('/en/lucas/slideshow');
	await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
	await page.waitForTimeout(1500);
	// Still on the first (oldest) composition - nothing advanced on its own.
	await expect(page.getByText('1 of 2')).toBeVisible();
});

test('Play/Pause toggles, and Previous/Next move between compositions and pause playback', async ({ page }) => {
	await page.goto('/en/lucas/slideshow');

	await page.getByRole('button', { name: 'Play' }).click();
	await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();

	await page.getByRole('button', { name: 'Next' }).click();
	await expect(page.getByText('2 of 2')).toBeVisible();
	// Manual navigation pauses - back to a "Play" button, not "Pause".
	await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();

	await page.getByRole('button', { name: 'Next' }).click();
	await expect(page.getByText('1 of 2')).toBeVisible(); // wraps

	await page.getByRole('button', { name: 'Previous' }).click();
	await expect(page.getByText('2 of 2')).toBeVisible(); // wraps the other way
});

test('changing speed and collage size takes effect and pauses playback', async ({ page }) => {
	await page.goto('/en/lucas/slideshow');

	await page.getByRole('button', { name: 'Play' }).click();
	await page.getByLabel('Speed').selectOption('fast');
	await expect(page.getByRole('button', { name: 'Play' })).toBeVisible(); // paused by the change

	// Lucas has exactly two photos - grouping both into one composition of 2
	// collapses "1 of 2" into "1 of 1".
	await page.getByLabel('Photos per slide').selectOption('2');
	await expect(page.getByText('1 of 1')).toBeVisible();
});

test('keyboard: arrow keys navigate, space toggles play, Escape closes', async ({ page }) => {
	await page.goto('/en/lucas/slideshow');
	await expect(page.getByRole('button', { name: 'Play' })).toBeVisible(); // wait for the island to hydrate before sending keys

	await page.keyboard.press('ArrowRight');
	await expect(page.getByText('2 of 2')).toBeVisible();

	await page.keyboard.press('ArrowLeft');
	await expect(page.getByText('1 of 2')).toBeVisible();

	await page.keyboard.press(' ');
	await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();

	await page.keyboard.press('Escape');
	await expect(page).toHaveURL('/en/lucas/explore');
});

test('the Close link and browser Back both return to the person\'s explore page', async ({ page }) => {
	await page.goto('/en/lucas/explore');
	await page.getByRole('link', { name: 'Slideshow' }).click();
	await expect(page).toHaveURL('/en/lucas/slideshow');

	await page.goBack();
	await expect(page).toHaveURL(/\/en\/lucas\/explore/);

	await page.goto('/en/lucas/slideshow');
	await page.getByRole('link', { name: 'Close' }).click();
	await expect(page).toHaveURL('/en/lucas/explore');
});

test('switching between people never shows a stale photo from the previous person', async ({ page }) => {
	await page.goto('/en/lucas/slideshow');
	await expect(page.getByAltText('The Copenhagen harbor on an overcast morning.')).toBeVisible();

	await page.goto('/en/anna/slideshow');
	await expect(page.getByAltText('The Copenhagen harbor on an overcast morning.')).not.toBeVisible();
	await expect(page.getByAltText("A mountain overlook near Asheville, Anna's photo.")).toBeVisible();
});

test('a nonexistent person 404s, same as every other person route', async ({ page }) => {
	const response = await page.goto('/en/nobody-here/slideshow');
	expect(response?.status()).toBe(404);
});

test('never loads MapLibre on the slideshow route', async ({ page }) => {
	const mapLibreRequests: string[] = [];
	page.on('request', (req) => {
		if (req.url().includes('maplibre')) mapLibreRequests.push(req.url());
	});

	await page.goto('/en/lucas/slideshow');
	await page.waitForTimeout(500);

	expect(mapLibreRequests).toEqual([]);
	await expect(page.locator('canvas')).toHaveCount(0);
});

test('reduced motion drops the slide transition to instant', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/en/lucas/slideshow');
	await expect(page.getByRole('button', { name: 'Play' })).toBeVisible(); // wait for the island to hydrate

	const animationDuration = await page.locator('.slideshow-slot').first().evaluate((el) => getComputedStyle(el).animationDuration);
	expect(animationDuration).toBe('0s');
});

test('the dark viewer frame stays consistent whether the site theme is light or dark', async ({ page }) => {
	for (const colorScheme of ['light', 'dark'] as const) {
		await page.emulateMedia({ colorScheme });
		await page.goto('/en/lucas/slideshow');
		await expect(page.getByRole('button', { name: 'Play' })).toBeVisible(); // wait for the island to hydrate
		const background = await page.locator('.slideshow').evaluate((el) => getComputedStyle(el).backgroundColor);
		// adj-navy (#1c2340) regardless of site theme - see Slideshow.css's note
		// on why this can't use the theme-relative surface-inverse token.
		expect(background).toBe('rgb(28, 35, 64)');
	}
});

test('works at 375px and at desktop width', async ({ page }) => {
	await page.setViewportSize({ width: 375, height: 812 });
	await page.goto('/en/lucas/slideshow');
	await expect(page.getByRole('button', { name: 'Play' })).toBeVisible(); // wait for the island to hydrate
	// Phone drops the 3/4 collage options.
	const phoneOptions = await page.getByLabel('Photos per slide').locator('option').allTextContents();
	expect(phoneOptions).toEqual(['1', '2', 'Auto']);

	await page.setViewportSize({ width: 1280, height: 800 });
	await page.goto('/en/lucas/slideshow');
	await expect(page.getByRole('button', { name: 'Play' })).toBeVisible(); // wait for the island to hydrate
	const desktopOptions = await page.getByLabel('Photos per slide').locator('option').allTextContents();
	expect(desktopOptions).toEqual(['1', '2', '3', '4', 'Auto']);
});

test('fullscreen control only appears when the Fullscreen API is actually available', async ({ page }) => {
	await page.goto('/en/lucas/slideshow');
	const enabled = await page.evaluate(() => document.fullscreenEnabled);
	const button = page.getByRole('button', { name: /fullscreen/i });
	if (enabled) {
		await expect(button).toBeVisible();
	} else {
		await expect(button).toHaveCount(0);
	}
});
