import type { D1Migration } from '@cloudflare/vitest-plugin';

// Test-only binding carrying the D1 migrations read at vitest.config.ts
// config-time (Node) into the Worker test runtime, applied by
// tests/apply-migrations.ts.
declare global {
	namespace Cloudflare {
		interface Env {
			TEST_MIGRATIONS: D1Migration[];
		}
	}
}
