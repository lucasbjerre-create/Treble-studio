// Single source for the few values docs/BUILD_PLAN.md's provisional-defaults
// table says should live in one place so they're easy to change later. Only
// what the current milestone needs - more get added as their features land.

/** The person this site currently reads as - schema is multi-author ready, but there's one author for now. */
export const PRIMARY_PERSON_SLUG = 'lucas';

/** Default audience for a new entry (spec section 14, settled 2026-10-27: public first, private/family is opt in). */
export const DEFAULT_AUDIENCE = 'public';

/** publish_after default for a new public entry: occurred_at plus this many hours (BUILD_PLAN.md's provisional default). */
export const LOCATION_DELAY_HOURS = 48;

/** Must match wrangler.jsonc's r2_buckets bucket_name - the R2 binding itself doesn't expose this for S3-API URL construction. */
export const R2_BUCKET_NAME = 'exchange-site-media';

/** Settled spec section 14: treble.cordoza.dk, a subdomain of Lucas's own domain. Used for absolute URLs (og:image) only - nothing here deploys or touches DNS. */
export const SITE_URL = 'https://treble.cordoza.dk';

/** How long a viewer login code stays valid (milestone 5). */
export const LOGIN_CODE_EXPIRY_MINUTES = 10;

/** A draft nobody finished auto-deletes this many days after it was created (never a published entry). Day-granularity only, by design - see src/lib/draftExpiry.ts. */
export const DRAFT_EXPIRY_DAYS = 8;

/** Per-person R2 storage cap, milestone 6 (spec section 8: 10 GB split across 15 people is under 700 MB each). Enforced in src/worker/api/studio.ts's media presign/commit routes. */
export const PER_PERSON_QUOTA_BYTES = 700 * 1024 * 1024;
