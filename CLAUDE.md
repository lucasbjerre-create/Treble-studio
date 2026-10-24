# Exchange year site

A personal journal for Lucas's exchange year (UNC Chapel Hill fall 2026, SMU Singapore spring 2027). Editorial photo diary with a synced map and time slider, Danish and English, plus a private /studio where Lucas publishes once a week. One person maintains it in about two hours a week, so simple and boring beats clever every time.

## Where the truth lives
- Product spec: `docs/00_master_project.md`. Read the relevant section before starting any feature. If code and spec disagree, ask Lucas before changing either.
- Build order: `docs/BUILD_PLAN.md`. Work on one milestone at a time and never start the next one unprompted.
- When Lucas settles a decision from section 14 of the spec, update the spec in the same change.

## Stack
- Astro with TypeScript in strict mode. Plain CSS with design tokens in `src/styles/tokens.css`, sourced from the TREBLE brand kit (`docs/brand/`, reference only - never add `docs/brand/tailwind.config.js` or `docs/brand/treble-theme.css` to the build). The kit's palette, fonts, radii and shadows replace the old placeholders; see spec section 6. Fonts are self-hosted via `@fontsource/schibsted-grotesk`, `@fontsource-variable/source-serif-4` and `@fontsource/ibm-plex-mono` - never the kit's own Google Fonts `@import`. No Tailwind, no CSS frameworks.
- The `Logo` component (`src/components/Logo.astro`) wraps the kit's SVG files (`public/brand/logos/`). Never edit the SVG geometry or animate the logo.
- React only for islands. `TimelineExplorer` owns map, slider, active entry and camera. `/studio` is its own React app.
- One Cloudflare Worker with static assets. Hono handles `/api/*`, mounted through a single Astro catch-all endpoint.
- D1 through Drizzle. Schema in `src/db/schema.ts`, SQL migrations in `migrations/`. Zod validates every API input.
- R2 for media. Browsers upload directly with short lived signed PUT URLs, then call a commit endpoint.
- MapLibre GL JS with hosted vector tiles. The tile provider is configured only in `src/config/map.ts`.
- Cloudflare Access protects `/studio` and the family layer. Turnstile protects public forms.

## Commands
Set these up in milestone 0 and keep this list accurate.
- `npm run dev` local dev server with D1 and R2 bindings
- `npm run check` astro check plus tsc with no emit
- `npm run test` vitest unit tests
- `npm run test:e2e` Playwright tests
- `npm run db:migrate:local` and `npm run db:migrate:remote` apply D1 migrations
- `npm run db:seed` load the fictional fixture journey into local D1
- `npm run deploy` build and deploy the Worker

## Hard rules

Runtime
- This is the Cloudflare Workers runtime, not Node. No `fs`, no native modules, no Sharp, no long CPU work inside a request. All image processing happens in the browser.
- Never import `maplibre-gl` in server code. Load it inside a client island and call `map.remove()` on unmount.
- Prefer Workers bindings for R2. Use S3 style signing only for the presigned upload URLs.

Data
- Every schema change is a new migration file. Never edit an applied migration and never drop or recreate tables to fix something.
- Keep local, preview and production bindings separate in `wrangler.jsonc`.
- Store times as UTC ISO strings plus a separate IANA timezone. Display in local time.
- GeoJSON order is [lon, lat]. Always name variables `lon` and `lat`, never `x`, `y` or a bare array.

Privacy, spec section 9, never negotiable
- Audience filtering happens in SQL and in the Worker. A private or unpublished entry must never appear in a public response, page, RSS item, sitemap or link preview.
- `lat_private` and `lon_private` never leave the server except inside authenticated `/studio` responses.
- `publish_after` is enforced on the server, not hidden in the UI.
- Published media is always a re-encoded copy with all metadata stripped. Originals are never served publicly.
- R2 buckets stay private and `r2.dev` stays off. Family media goes through a Worker route that checks the viewer.
- Any change touching these rules needs a test in `tests/privacy/`.

Content
- AI never writes diary text, reflections, jokes or quotes. AI may only draft translations and suggestions that Lucas approves in `/studio`.
- Every user facing string exists in both Danish and English in `src/i18n/`.
- Real personal content never goes into seeds, fixtures or tests. Use the fictional fixture journey.

Experience
- Every map or slider interaction has a non map alternative. `/journal` must work fully without the map island.
- Respect `prefers-reduced-motion`. Tap targets at least 44 px. No autoplay, no sound unless the viewer starts it.
- Test layouts at 375 px wide and at desktop width, in both languages.

Code style
- Small modules with named exports. No `any`. Pure logic (timeline state, moment grouping, leg proposals, privacy rounding) lives in `src/lib/` as plain functions with unit tests.
- Ask before adding a dependency. Explain in one line why it is needed.

## Before saying something is done
1. `npm run check` and `npm run test` pass.
2. For UI work, run the dev server and look at it at 375 px and desktop, in DA and EN, with reduced motion on and off.
3. For anything near privacy, run `tests/privacy` and say so.
4. Say plainly what you could not verify.

## Working with Lucas
- He is a business student with a design background, not a full time developer. Explain choices briefly in plain words.
- Stop and ask before anything that costs money, touches production data, deletes R2 objects, changes Access policies or applies a migration remotely.
- Steps that need the Cloudflare dashboard (Access policies, domains) are his to do. Write them as short numbered steps instead of guessing.
- Commit at the end of each working step with a clear message.
