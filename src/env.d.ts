declare namespace App {
	interface Locals {
		/** Set by src/middleware.ts once the Cloudflare Access JWT verifies. */
		accessEmail: string;
	}
}

// Real secrets, set via `wrangler secret put` once Lucas completes the
// Cloudflare Access + R2 API token dashboard steps - never committed, so
// wrangler.jsonc/types can't see them. R2_ACCOUNT_ID is a plain var instead
// (not sensitive), already typed by the generated worker-configuration.d.ts.
//
// Augments Cloudflare.Env specifically, not the plain global Env: the
// `env` import from "cloudflare:workers" is typed against Cloudflare.Env
// (confirmed by tracing worker-configuration.d.ts - this bit us once
// already in milestone 1/2, augmenting the wrong one silently no-ops).
//
// No `declare global` wrapper, same as the App namespace above: this file
// has no top-level import/export, so it's already a global script, not a
// module - `declare global` only does anything inside a module, and
// silently no-ops here otherwise (confirmed by it not working with one).
declare namespace Cloudflare {
	interface Env {
		TEAM_DOMAIN?: string;
		POLICY_AUD?: string;
		R2_ACCESS_KEY_ID?: string;
		R2_SECRET_ACCESS_KEY?: string;
	}
}
