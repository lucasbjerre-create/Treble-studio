// Single source for the few values docs/BUILD_PLAN.md's provisional-defaults
// table says should live in one place so they're easy to change later. Only
// what the current milestone needs - more get added as their features land.

/** The person this site currently reads as - schema is multi-author ready, but there's one author for now. */
export const PRIMARY_PERSON_SLUG = 'lucas';

/** Default audience for a new entry (BUILD_PLAN.md's provisional default: "family first, public is opt in"). */
export const DEFAULT_AUDIENCE = 'family';

/** publish_after default for a new public entry: occurred_at plus this many hours (BUILD_PLAN.md's provisional default). */
export const LOCATION_DELAY_HOURS = 48;

/** Must match wrangler.jsonc's r2_buckets bucket_name - the R2 binding itself doesn't expose this for S3-API URL construction. */
export const R2_BUCKET_NAME = 'exchange-site-media';
