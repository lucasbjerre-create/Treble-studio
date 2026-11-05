# Build plan

One milestone per session. Start each session in plan mode, paste the prompt for that milestone, read the plan Claude proposes, then let it build. Commit when the milestone's "done when" list is true.

Time estimates are rough and assume focused vibe coding sessions with Claude Code.

---

## Provisional defaults

The spec lists open decisions in section 14. Until Lucas decides, build with these defaults and keep each one easy to change in a single place.

| Decision | Default for now | Lives in |
|---|---|---|
| Audience model | Settled 2026-10-27: public first. New entries default to `public`, private/family is opt in per entry | `src/config/site.ts` |
| First visit language | Always English | `src/i18n/detect.ts` |
| Route accent color | Settled 2026-10-24 by the TREBLE brand kit: `--color-link` (CBS blue) for interactive colour, scholar seat colours for routes/trails. No longer a placeholder. | `src/styles/tokens.css` |
| Studio on phone | Upload and cull work on a phone. Writing can assume a laptop | design of `/studio` |
| Location delay | After leaving the place plus 48 hours | `src/config/site.ts` |
| Clip limit | 30 seconds and 50 MB | `src/config/site.ts` |
| Where the story starts | A milestone entry for leaving Denmark | fixture journey |
| Tiles | OpenFreeMap | `src/config/map.ts` |

---

## Version 0. Live with real content

Milestones 0 to 4. After milestone 4 Lucas can publish real entries from his phone. Everything after that makes Sunday faster or adds polish.

### Milestone 0. Foundations
About half a day.

Goal. An empty but correctly wired project deployed to Cloudflare.

Tasks
- Scaffold Astro with the Cloudflare adapter, React integration and strict TypeScript.
- `wrangler.jsonc` with D1 and R2 bindings, separate local and production config.
- Hono mounted through one Astro catch-all at `src/pages/api/[...path].ts`, with `GET /api/health`.
- `src/styles/tokens.css` with the palette, type scale and spacing from spec section 6. Self hosted Source Serif 4 and Inter, only the weights used.
- `src/i18n/` with `da.ts`, `en.ts`, a typed `t()` helper and `/da` and `/en` routing.
- Vitest and Playwright set up. All npm scripts from CLAUDE.md working.
- Deploy to a workers.dev address.

Done when
- The deployed URL shows a placeholder page in Danish and English.
- `/api/health` returns ok.
- `npm run check` and `npm run test` pass.

Prompt
```
Start milestone 0 from docs/BUILD_PLAN.md. Read CLAUDE.md and spec sections 2, 6 and 11 first. Show me a short plan before writing code. Check the current Astro Cloudflare adapter and Wrangler docs instead of relying on memory, and tell me which Cloudflare steps I need to do myself.
```

### Milestone 1. Data model
About half a day.

Goal. The full schema from spec section 5, plus a fictional journey to build against.

Tasks
- Drizzle schema for every table in spec section 5, first migration, indexes.
- `npm run db:seed` loads a fictional fixture journey. Leaving Copenhagen, arriving in Chapel Hill, a weekend trip, one school entry, two remarks, one entry still inside its publish delay, one private draft. Fictional text and placeholder images only.
- `src/db/queries.ts`. Every read function takes a viewer argument (`public`, `family` or `studio`) and filters by audience, status and `publish_after` in SQL.
- Unit tests proving a public viewer never gets family, private, unpublished or delayed entries, and never receives private coordinates.

Done when
- Migration applies cleanly to a fresh local D1.
- Seed runs twice without duplicating data.
- Privacy tests pass.

Prompt
```
Start milestone 1 from docs/BUILD_PLAN.md. Read spec sections 5 and 9. Plan the Drizzle schema and the viewer aware query helpers first, show me the plan, then build. Put the privacy tests in tests/privacy.
```

### Milestone 2. Reading site
About a day.

Goal. The site family will read, working from the seed data, without the map yet.

Tasks
- Homepage with latest entry, current chapter and a small static route preview image or SVG.
- Entry pages at `/[lang]/[person]/[slug]` with previous and next links.
- Archive grouped by chapter and month, with life, school and trip filters.
- `/[lang]/journal` simple view per spec section 6. Big text, big Older and Newer buttons, no map.
- The four compositions from spec section 6, chosen by entry format.
- Media component with fixed aspect boxes, `srcset` for the three sizes, captions always visible, clips start muted on tap.
- Language toggle that keeps you on the same entry.

Done when
- Every seed entry renders in both languages.
- Looks right at 375 px and desktop, with reduced motion on.
- Delayed and private seed entries do not appear anywhere public.

Prompt
```
Start milestone 2 from docs/BUILD_PLAN.md. Read spec sections 4 and 6 and load the frontend design guidance if you have it. Propose the page structure and the four compositions first. Keep the design restrained, editorial and warm, no rounded corners or shadows.
```

### Milestone 3. Map and slider
About one to two days. The hardest milestone.

Goal. `TimelineExplorer`, where map, slider, scroll position and URL always agree.

Tasks
- `src/lib/timeline.ts`, a pure state module. Given entries, legs and a date it returns the active entry, chapter, route progress and visible markers. Unit tested before any UI.
- MapLibre island loaded only in the browser, muted style, entry markers with clustering, legs with flights as great circle arcs.
- Slider on real calendar time that snaps to entries and trip edges, with previous and next buttons, keyboard support (arrows per entry, Shift plus arrows per chapter) and chapter jumps.
- URL sync so every state can be shared. Scroll sync on desktop with IntersectionObserver.
- Phone layout per spec section 6, story first with a bottom sheet map and cooperative gestures.
- The two plane hop transitions. Reduced motion skips straight to the end state.

Done when
- A Playwright test drags the slider, clicks a marker and scrolls the journal, and checks all three stay in sync with the URL.
- Map never loads on `/journal`.

Prompt
```
Start milestone 3 from docs/BUILD_PLAN.md. Read spec sections 6 and the Routes part of section 8. Build src/lib/timeline.ts with unit tests first and show me the tests before any map code. Then plan the island.
```

### Milestone 4. Studio, first real publish
About one to two days.

Goal. Lucas publishes a real entry from his phone.

Tasks
- Numbered steps for Lucas to put `/studio` behind Cloudflare Access with only his email. The Worker also verifies the Access JWT on every studio and write request.
- Entry editor with format, category, chapter, place label, audience, precision, consent and body.
- Photo upload. Read EXIF with exifr before anything else, fix orientation, resize in the browser to 480, 1280 and 2048 px WebP. Re-encoding strips metadata. Store the read metadata privately on the media row.
- Signed PUT URLs per object with exact content type and short expiry, then a commit call that checks the object exists.
- Public point derived on the server by rounding to the chosen precision.
- Publish button that respects `publish_after`.

Done when
- Lucas creates and publishes one real entry from his phone.
- A downloaded published photo has no GPS or camera metadata.
- An unauthenticated request to any studio route is rejected by the Worker even if Access were misconfigured.

Prompt
```
Start milestone 4 from docs/BUILD_PLAN.md. Read spec sections 8 and 9. Plan the upload flow end to end first, including what happens when an upload fails halfway on a phone. Give me the Cloudflare Access steps as a short numbered list.
```

---

## Decision point: solo or group

Before continuing past milestone 4, decide whether this stays Lucas's own site or becomes a group site for TREBLE scholars (see spec section 10). Milestone 3's `src/lib/timeline.ts` and the explore view were already built multi-person-ready for this, without building any group feature itself.

**Decided 2026-10-26: group.** Milestones 5 and 6 are both built (see below).

- **If group**: build milestones 5 and 6 below next. Milestone 7 (Family layer and privacy hardening) may end up partly superseded rather than built exactly as originally scoped, since milestone 5 is designed to replace the Access family list.
- **If solo**: skip straight to milestone 7 and the solo path continues exactly as originally planned.

### Milestone 5. Viewers and followers
About a day. **Built 2026-10-26.**
- The site's own email-code login (a one-time code or magic link), replacing Cloudflare Access for family-tier viewing. `/studio` keeps using Access.
- A `follows` table: follower identity (email), the person they follow, status, created_at.
- Family-tier entries become follower-only per person - a follower of Anna isn't automatically a follower of Lucas. This is the "family" to "followers of this person" shift flagged in spec section 14.
- If this replaces the Access family list, retire the allowlist-based approach from the original milestone 5 (now 7) rather than running both.

### Milestone 6. Second trebler
About a day. **Built 2026-11-05.**
- Contributor onboarding: invite a second scholar, their own `/studio` access scoped to only their own content. `/studio/people` (gated to the primary person, `PRIMARY_PERSON_SLUG`, not the public `role` column) creates the person row; the Cloudflare Access policy email still has to be added by hand (numbered steps live in the page itself).
- Storage quota per person (R2 usage tracked and capped - spec section 8's budget note: 10 GB split across 15 people is under 700 MB each). `PER_PERSON_QUOTA_BYTES` in `src/config/site.ts`, enforced in both `/media/presign` (pre-check) and `/media/commit` (authoritative, cleans up the just-uploaded R2 objects on rejection), shown as a meter on `/studio`.
- A "choose your trebler" home screen that only appears once two or more people have published; before that, the single-person homepage is unchanged. (Already built 2026-10-26, ahead of this milestone.)
- Crossings suggested automatically when two people's entries share the same city and overlapping dates, shown as confirmed only once both people say yes - nothing about a crossing is asserted without both people's say-so, only the suggestion itself is computed rather than purely manual (updates spec section 10's Stage 2 description). `/studio/crossings` lists live suggestions and lets each participant confirm their own row; the map marker (`src/components/TimelineExplorer.tsx`) only shows once every participant has confirmed, and its popup only ever links the participant(s) whose own entry is actually visible to the current viewer - fixed a real gap along the way, where the crossing queries took one flat viewer tier for a two-person crossing instead of resolving each participant's own per-person family status (`src/db/queries.ts`'s `listConfirmedCrossingsForViewer`/`listEntriesForCrossing`, now keyed by a `Map<personId, Viewer>`).

---

## Version 1. Sunday gets fast

### Milestone 7. Family layer and privacy hardening
About a day. If the group path (milestone 5) was taken, check what's left to build here - some of this may already be done differently.
- Family layer behind its own Access policy with an explicit email allowlist. Check current docs on whether to use a path prefix or a separate hostname.
- Family media served through a Worker route that checks the viewer.
- Hidden first and last part of detailed routes near home, no future legs in public.
- Privacy test suite extended to RSS, sitemap and link preview tags.

### Milestone 8. Inbox and Shortcuts
About half a day.
- `POST /api/capture` authenticated with a Cloudflare Access service token, accepting text, time and optional coarse location.
- Media variant of the same endpoint for the share sheet.
- Inbox list in `/studio`.
- `shortcuts/README.md` with click by click steps for Lucas to build "Save moment" and "Send to travel inbox", including the offline fallback.

### Milestone 9. Smart ingest
About two days.
- Batch upload desk with per file progress, retry and state kept in IndexedDB so a closed tab can resume.
- Import report, then day and moment grouping as a pure, tested function (two hour gap or a real change of place).
- Use, Maybe, Skip culling with sha256 duplicate detection.
- Route cards. A pure, tested function proposes legs whenever the city changes and guesses the mode from distance.
- Story assembly that turns chosen moments into one or more entries.

### Milestone 10. Bilingual workflow
About half a day.
- `entry_texts` and `media_texts` editing side by side in the studio.
- A translation draft button. Ask Lucas before wiring any paid AI API, and keep the key as a Wrangler secret.
- Unapproved translations fall back to the original with a small note.

### Milestone 11. Digest and RSS
About half a day.
- RSS per language, public entries only.
- A digest builder in the studio that produces the week's email in both languages for Lucas to paste into MailerLite. No email API integration yet.
- MailerLite signup form embedded with a language choice.

### Milestone 12. Backfill August to October
One session, mostly Lucas.
- Make sure batch import handles a few hundred files and a date range filter.
- Run the leg proposals across the whole backfill at once.

---

## Shipped outside the milestone sequence

### Slideshow mode
Not a numbered milestone - built from a standalone feature prompt once milestone 5 (viewers and followers) was already in place, since it only needed the per-person audience filter that milestone already provides, not anything from 6 onward.

A "Slideshow/Diasshow" link on `/[lang]/[person]/explore` opens `/[lang]/[person]/slideshow`: every photo that person has published, that the current viewer is authorized to see, as a full-screen, no-autoplay, editorial viewer with play/pause, previous/next, speed, photos-per-composition (1-4 or auto), optional deterministic shuffle, and fullscreen.

- Privacy boundary: `listMediaForPersonViewer` (`src/db/queries.ts`) reuses `entryVisibilityWhere`, the exact filter every public/family query already uses - no parallel rule. Scoped to `kind = 'photo'` only. The paginated `GET /api/slideshow/:personSlug` endpoint (`src/worker/api/slideshow.ts`) resolves the viewer from the session cookie the same way `middleware.ts` does for pages, and never returns a count of photos the viewer can't see - only `hasMore`.
- No-autoplay: playback starts only after Play is pressed, pauses on tab-hide and on any control interaction, and never auto-resumes.
- Pure sequencing/layout logic lives in `src/lib/slideshow.ts` (composition grouping, next/previous with wrap, speed-to-duration, reduced-motion override, stored-preference validation), unit tested independent of the DB and the UI.

### Bulk upload, drafts, face tagging, and timestamp fixes
Not numbered milestones - built as direct studio requests between milestone 5 and now (2026-10-27 to 2026-11-01), ahead of milestone 9's fuller smart-ingest design. This is the minimum that let Lucas publish faster from a real phone, not the resumable-upload/import-report/route-card version milestone 9 describes - that's still to build.

- **Bulk upload** (`src/components/BulkUpload.tsx`): select or drag-and-drop several photos at once, each becoming its own draft entry; opens the first draft immediately and uploads the rest behind it. HEIC/HEIF photos, including 10-bit/HDR iPhone shots, decode via `heic-to` (`src/lib/mediaUpload.ts`) on browsers with no native HEIC support.
- **Drafts**: delete, bulk-delete, and an 8-day auto-expiry (`src/lib/draftExpiry.ts`, `DRAFT_EXPIRY_DAYS` in `src/config/site.ts`) so abandoned drafts don't pile up.
- **Face tagging** (`src/lib/faceDetection.ts`, `src/components/PhotoPeopleTags.tsx`): on-device face detection (BlazeFace full-range model; nothing leaves the device) assists free-text people tags. Tagged names show below a published photo, never overlaid on it. A failed model load retries instead of staying broken for the rest of the session.
- **Photo timestamps**: prefers the photo's own GPS-UTC EXIF timestamp over `CreateDate` (camera local time, which used to drift with the uploading browser's own timezone), falling back and warning when neither is present.
- **Studio UX**: default audience is public (family/private stay opt in per entry, per the section 14 decision above), starred places become one-tap quick-select chips, the entries list's select-all splits by status, and entries can be unpublished (hidden, not deleted).
- **Map/explore polish**: tapping the active marker shows a photo+title popup, the explore camera centers on the photo's own aspect-correct view rather than snapping to the pin, and campus markers use the real UNC/SMU/CBS crests.

---

## Later
Version 2 and 3 items from spec section 12. Reactions and Ask Lucas, postcards, recaps, Study index, stats, perceptual duplicates, reverse geocoding cache, on this day, replay, TREBLE pilot, print export, archive mode. Add each as its own milestone here before building it.
