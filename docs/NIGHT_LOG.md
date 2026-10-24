# Night log, 24 Oct 2026

Morning summary goes here when the run finishes. Task sections below are written live, in order, as the run happens.

---

## Flagged immediately: unrelated uncommitted work already in this working tree

Before touching anything, `git status` at the very start of this run was clean except `OVERNIGHT.md` and `treble-brand-kit.zip` (both untracked). Partway through Task 1, `git status` showed substantial *other* uncommitted changes I did not make: `src/db/queries.ts`, `src/db/schema.ts`, `src/env.d.ts`, `src/middleware.ts`, `src/worker/api.ts`, `src/worker/api/studio.ts` modified, plus new `migrations/0002_windy_morlocks.sql` (+ its snapshot/journal), `src/worker/api/viewer.ts`, `src/worker/email.ts`, `src/worker/viewerSession.ts` - what looks like an in-progress email-code viewer login / "followers" feature (milestone 5 territory), not anything OVERNIGHT.md asked for tonight.

`ListAgents` shows a peer session, "Overview of exchange site kit", idle, started about a day ago - almost certainly the source of this (same checkout, not a worktree). All those files' mtimes cluster tightly (11:42-11:46), well before most of tonight's work.

This is not mine to commit, revert, or discard - it may be real in-progress work from that other session. I've left every one of those files completely untouched and excluded them from every `git add` tonight by listing paths explicitly instead of using `-A`. This means `git status` will **not** be fully clean at the end of the run through no fault of tonight's work; see the morning summary for what I did about that.

---

## Task 1. Install the brand kit and redesign the site

Status: done.

What I did
- Unzipped `treble-brand-kit.zip` into `docs/brand/` (reference copy, including `tailwind.config.js` and `treble-theme.css` which are explicitly not wired into the build), then deleted the zip. Excluded `docs/brand` from `tsconfig.json` so `astro check`/`tsc` don't lint the kit's own CommonJS config file.
- Installed `@fontsource/schibsted-grotesk`, `@fontsource-variable/source-serif-4`, `@fontsource/ibm-plex-mono`, `pica`, `@turf/distance` (all pre-approved). Removed `@fontsource/inter` and the non-variable `@fontsource/source-serif-4`, which the kit's fonts replace.
- Rewrote `src/styles/tokens.css` to the kit's full token set (raw palette, light/dark role tokens, scholar-seat helpers, `.photo`/`.t-prose`/`.t-eyebrow`/`.t-data` classes), with the kit's Google Fonts `@import` replaced by the three self-hosted fontsource imports (ground rule: visitors' browsers must never call Google). Kept a small box-sizing/margin reset the kit assumes Tailwind preflight provides, since this project has none.
- Copied favicons/icons/og-image from the kit's `public/` into `public/`, and added the icon links, theme-color metas and og:image tag from the kit README to `BaseLayout.astro` and `StudioLayout.astro`. Added `SITE_URL` (`https://treble.cordoza.dk`, the settled spec-14 domain) to `src/config/site.ts` for the absolute og:image URL - this is just a string literal, nothing deploys or touches DNS.
- Built `src/components/Logo.astro` wrapping the kit's lockup/mark/descriptor SVGs (copied into `public/brand/logos/`), auto-swapping to the "paper" variant in dark mode via the same `prefers-color-scheme`/`data-theme` pattern as tokens.css. Wired into `BaseLayout.astro` (lockup on screens ≥480px, mark alone below that, descriptor in the footer) and `StudioLayout.astro` (mark + "Studio" wordmark).
- Built `src/components/VisibilityBadge.astro` (word + icon, never colour alone, per the kit's own rule) and added `visibility.public/family/private` strings to both `src/i18n/en.ts` and `da.ts` ("Public/Offentlig", "Followers only/Kun følgere", "Only me/Kun mig"). Not wired into any page yet - that's Task 5's studio editor.
- Migrated every component/page off the old placeholder tokens (`--color-paper/ink/muted/accent`, `--text-xs..2xl`, `--motion-*`, `--tap-target-min`) onto the kit's role tokens, choosing `--color-surface` vs `--color-bg` and `--color-link` vs `--color-primary` by context (e.g. filled buttons now use `--color-primary`/`--color-on-primary` instead of a bare `#fff`; the one hardcoded `#a33` error colour is now `--color-error`). Added `class="photo"` to published images for the kit's shared light grade/metadata-adjacent treatment.
- Updated `CLAUDE.md` (Stack section) and spec sections 2, 6 and 14, plus `BUILD_PLAN.md`'s provisional-defaults table, to point at the brand kit as source of truth and mark the route-accent-colour open decision (spec 14 item 4) as settled.

Bug caught and fixed before committing: Astro scopes a component's `<style>` block only to the elements *it* renders directly, not to a child component's internal markup - so passing `class="site-title-logo"` into `<Logo>` and styling `.site-title-logo { height: 1.5rem }` from `BaseLayout.astro` silently did nothing (confirmed via the rendered HTML: the span only carried Logo.astro's own `data-astro-cid-*`, not BaseLayout's), and the logo didn't render at all. Fixed by giving `Logo` its own `height` prop (set via an inline custom property, which isn't scoped) and, for the responsive lockup/mark swap, wrapping each `<Logo>` in a plain `<span>` written directly in `BaseLayout.astro` so the show/hide media query has something it actually owns to target. Caught by actually looking at the first screenshot rather than assuming the CSS worked.

Verified: `npm run check` and `npm run test` pass. Playwright screenshots at 375px/1280px × light/dark × en/da saved to `review/task1/` (gitignored) - home, journal, archive, explore. Spot-checked contrast and logo swapping by eye in both themes; no issues found worth a follow-up fix tonight.

`npm run test:e2e`: 11/12 pass. `tests/e2e/explore.spec.ts`'s "the slider and a marker click stay in sync via the URL" fails consistently (not flaky - reproduced 4/4 runs), but this is **pre-existing and unrelated to tonight's changes**: `git diff HEAD -- src/components/TimelineExplorer.tsx` shows only two CSS-variable-name renames (`--color-accent`→`--color-link`, `--color-muted`→`--color-text-muted`), no logic or layout change, and the failure reproduces identically with those two lines reverted. The click lands somewhere that doesn't fire the `marker-point` layer's click handler after `fitBounds` - likely a clustering/zoom interaction (`clusterMaxZoom` and the fitBounds `maxZoom` cap are both 8) rather than anything brand-related. Logging this here rather than spending Task 1's budget on Task 3's territory (the map rebuild). See "Needs Lucas" below.

Needs Lucas
- Pre-existing map e2e failure above - worth a close look when milestone 3 (Task 3 tonight) is reworked; I'll note whatever I learn there too.
- The wordmark in the kit is a stand-in typeface (Jost, outlined to paths) per the kit's own README - replace when the programme office confirms the real face. Not something I can resolve tonight.
- `docs/brand/brand-guide.html`'s full component gallery (cards, forms, etc. beyond what today's pages needed) wasn't exhaustively cross-checked pixel-for-pixel - I matched it by token/pattern (spacing scale, radii, type scale) rather than recreating every example. Worth a look in daylight against the actual guide.

---

## Task 2. Make the build group ready

Status: done.

Most of this task was already done by git history, exactly as the task note expected - I checked each bullet against the current code before touching anything:
- `src/lib/timeline.ts` already takes `personId` on both `TimelineEntry` and `TimelineLeg`, and `computeTimelineState` already computes independent per-person active entries/routes/markers at a shared date. `tests/unit/timeline.test.ts` already has a full "several people at once" describe block (two people, overlapping schedules, proving no cross-person leakage). Nothing to add here.
- `src/pages/[lang]/[person]/explore.astro` already takes the person from the URL (`Astro.params.person`) and scopes every query to that person.
- `docs/BUILD_PLAN.md` already has the solo/group decision point, "Viewers and followers" (milestone 5) and "Second trebler" (milestone 6) inserted after milestone 4, with the rest renumbered. Spec sections 10 and 14 already reflect it (section 10 points at the two milestones by name; section 14 already has the "family -> followers of this person" note scoped to "before milestone 5"). Nothing to add here either.

What was actually left, and what I did:
- Added a `seat` integer column to `people` (`migrations/0003_people_seat.sql`, `src/db/schema.ts`), applied to local D1 only (`npm run db:migrate:local`). Lucas is seat 1, a new fictional second scholar "Anna" is seat 2 - both are provisional until Lucas settles real seat order (spec section 14 already says this).
- Seeded Anna in `src/db/seed.sql`: her own chapter, two trips (arrival + the Asheville weekend), legs, and 3 entries - including `anna-weekend-in-asheville`, which shares a place (Asheville) and overlapping dates (2026-09-19/20) with Lucas's existing `weekend-in-asheville` entry, exactly as asked, so task 4's crossing-suggestion logic has something real to find tonight. Reused the existing Asheville fixture image for her matching photo rather than inventing a new placeholder file. Ran the seed twice locally to confirm it stays idempotent (`INSERT OR IGNORE` + idempotent `UPDATE ... SET seat` for databases seeded before the column existed).
- Anna's email is a non-resolvable placeholder (`anna.fixture@example.test`) - unlike Lucas's row, which intentionally keeps his real email since that's how studio auth resolves the signed-in writer to a person row (existing comment in seed.sql).

A note on the migration number: the working tree already had an uncommitted `migrations/0002_windy_morlocks.sql` from the other session (see the flagged note above) by the time I needed one. I read it (a `follows`/`login_codes` pair, nothing touching `people`) to make sure there was no real collision, then numbered mine `0003` and left their file and `migrations/meta/_journal.json` completely alone - I did not add my migration to that journal, since it already carries their uncommitted entry and editing it would mean committing a pointer to their file, not just mine. `wrangler d1 migrations apply` doesn't read that journal (it reads the `migrations/*.sql` files directly against its own tracking table in D1), so this doesn't block applying either migration; it only means drizzle-kit's own journal is out of sync until someone reconciles it - noted under "Needs Lucas" below.

For `src/db/schema.ts`, which the other session had also already modified (adding its `follows`/`loginCodes` tables), I staged only my own four-line hunk with a hand-built patch (`git apply --cached`) rather than the whole file, so my commit carries just the `seat` column and nothing of theirs.

Verified: `npm run check`, `npm run test` pass. `npm run test:e2e`: same 11/12 as task 1, the one pre-existing map-click failure, now re-confirmed unaffected by the extra fixture data (the explore page is still correctly scoped to one person at a time, so Anna's entries don't change what's on `/en/lucas/explore`).

Needs Lucas
- `migrations/meta/_journal.json` (drizzle-kit's own bookkeeping) doesn't know about `0003_people_seat.sql`, on purpose, to avoid touching the other session's uncommitted `0002` entry there. Once that other work is committed (or abandoned), run `npx drizzle-kit generate` once, or regenerate the journal by hand, so drizzle-kit's own tooling (not `wrangler d1 migrations apply`, which is unaffected) sees the real migration history again.
- Final seat order (Lucas=1, Anna=2) is a placeholder, same as the fixture names - confirm the real alphabetical-by-surname order before this means anything outside fixtures.

---
