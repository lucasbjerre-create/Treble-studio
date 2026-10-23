import { test, expect } from '@playwright/test';

test('redirects to /en/ by default', async ({ page }) => {
	await page.goto('/');
	await expect(page).toHaveURL(/\/en\/$/);
});

test('serves the Danish placeholder at /da/', async ({ page }) => {
	await page.goto('/da/');
	await expect(page.locator('html')).toHaveAttribute('lang', 'da');
});

test('/api/health returns ok', async ({ request }) => {
	const response = await request.get('/api/health');
	expect(response.ok()).toBeTruthy();
	expect(await response.json()).toEqual({ ok: true });
});
