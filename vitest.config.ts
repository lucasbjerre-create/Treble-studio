import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

const migrations = await readD1Migrations('./migrations');

export default defineConfig({
	test: {
		include: ['tests/unit/**/*.test.ts', 'tests/privacy/**/*.test.ts', 'tests/studio/**/*.test.ts'],
		setupFiles: ['./tests/apply-migrations.ts']
	},
	plugins: [
		cloudflareTest({
			main: './tests/test-worker.ts',
			miniflare: {
				compatibilityDate: '2026-10-23',
				d1Databases: ['DB'],
				r2Buckets: { MEDIA: 'exchange-site-media-test' },
				bindings: { TEST_MIGRATIONS: migrations }
			}
		})
	]
});
