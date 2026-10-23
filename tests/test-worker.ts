// Minimal worker entry for the Cloudflare vitest plugin's test runtime.
// Deliberately separate from the real app's wrangler.jsonc/Astro entrypoint:
// these tests only need D1/R2 bindings (env.DB, env.MEDIA), never the actual
// Astro worker.
export default {
	fetch() {
		return new Response('test worker');
	}
} satisfies ExportedHandler<Env>;
