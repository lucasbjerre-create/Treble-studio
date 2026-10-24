# Overnight run, 24 Oct 2026

Lucas is asleep for about eight hours and cannot answer anything. Work through the tasks below in order without asking questions. When something needs a decision, make the most reasonable call, write it down in the log and keep going.

## Ground rules for tonight

Never do these
- Deploy, run `wrangler deploy`, or run any wrangler command with `--remote`.
- Touch remote D1 or R2, the Cloudflare dashboard, Access policies, DNS or secrets.
- `git push`, change git remotes, or rewrite history.
- Sign up for anything, add paid services, or add API keys.
- Put real personal content into seeds or fixtures.

Dependencies you may add tonight without asking
`@fontsource/schibsted-grotesk`, `@fontsource-variable/source-serif-4`, `@fontsource/ibm-plex-mono`, `@turf/great-circle`, `@turf/distance`, `exifr`, `pica`, `jose`, `zod`. Anything else gets logged as a suggestion and skipped.

How to work
- Keep a running log in `docs/NIGHT_LOG.md`. For every task write what you did, decisions you made, and anything under a "Needs Lucas" heading.
- Commit after each task, only when `npm run check` and `npm run test` pass (and `npm run test:e2e` for UI tasks).
- If a task is still broken after three honest attempts, `git restore` back to the last commit, log what went wrong under "Needs Lucas", and move to the next task. Never leave the repo broken.
- Save review screenshots to `review/` (add it to `.gitignore`) so Lucas can look through them in the morning without them landing in git.
- Use subagents for broad research or doc checks so the main context stays clean. Check current docs for MapLibre, Astro and Cloudflare instead of relying on memory.
- Start by reading `docs/NIGHT_LOG.md` if it exists. If it does, a previous run was interrupted, so resume from the first unfinished task.

## Brand decisions already made

The TREBLE brand kit is now the design source of truth. It replaces the palette, fonts, radius and shadow rules in spec section 6 and in CLAUDE.md. Where the kit and this project disagree, these decisions apply.

1. Plain CSS, no Tailwind. Use the kit's `tokens.css`. Do not add `tailwind.config.js` or `treble-theme.css` to the build. Keep them in `docs/brand/` for reference only.
2. Self host the fonts with the fontsource packages above and remove the Google Fonts `@import` line from the kit's tokens. Visitors' browsers must not call Google.
3. Keep OpenFreeMap as the tile provider during the exchange year, as the spec says. Do not set up Protomaps or PMTiles. Build a TREBLE map style from the colours in `map-theme.json`, for light and dark, applied to the OpenFreeMap vector tiles. Keep the provider swappable in `src/config/map.ts`.
4. Light and dark both follow the system through the tokens. No theme toggle tonight.
5. Scholar colours come from seats. Add a `seat` integer column to `people` in a new local migration. In the fixtures, Lucas is seat 1 as a placeholder and a fictional second scholar is seat 2. Final seat order is an open decision for Lucas.
6. Visibility labels in the UI. `public` shows as Public / Offentlig. `family` shows as Followers only / Kun følgere. `private` shows as Only me / Kun mig. Database values stay the same. Every badge has a word and an icon, never colour alone.
7. One `Logo` component wraps the kit's SVG files so they can be swapped later. Horizontal lockup in the nav on wide screens, the mark alone on phones, the paper variant on dark. Never edit the SVG geometry, never animate the logo. The wordmark is a stand in typeface, so note that in the spec.
8. Follow the kit's "rules that are easy to break" in its README, especially that Carolina Blue is never text on a light background.

Update CLAUDE.md, spec section 6 and spec section 14 to match these decisions as part of task 1.

## Tasks

### Task 1. Install the brand kit and redesign the site
- Unzip `treble-brand-kit.zip` from the project root into `docs/brand/`, then delete the zip.
- Move the kit's tokens into `src/styles/`. Migrate existing components from the old tokens to the kit's role tokens, then delete old tokens nobody uses.
- Copy favicons, icons and the og image from the kit's `public/` into `public/`, and add the head tags from the kit README.
- Redesign every existing page and component (layout, nav, footer, language toggle, homepage, entry page and its four compositions, archive, journal, explore) using the components section of `docs/brand/brand-guide.html` as the reference.
- Check with Playwright screenshots at 375 px and 1280 px, in light and dark, in Danish and English, saved to `review/task1/`. Fix contrast problems you find.

### Task 2. Make the build group ready
Skip whatever git history shows is already done.
- `timeline.ts` takes `personId` on entries and legs and computes state for one or several people at the same date. Add tests with two people.
- The explore view takes the person from the URL.
- Seed a fictional second scholar with a few entries, including a weekend in the same city as Lucas on overlapping dates.
- Update `docs/BUILD_PLAN.md`. After milestone 4 add a decision point, then a "Viewers and followers" milestone (own email code login, a follows table, follower only entries per person, replacing the Access family list if the group version goes ahead) and a "Second trebler" milestone (contributor onboarding, storage quota per person, choose your TREBLEr home screen, confirmed crossings). Renumber the rest. Update spec sections 10 and 14 to match. In the spec, note that `family` will likely become "followers of this person", decided before milestone 5.

### Task 3. Finish milestone 3, map and slider
- Complete phase B from the milestone 3 plan with the TREBLE map style.
- Trails use the scholar seat colour and dash pattern with a casing line. Entry markers show the scholar's initials. Campus markers for Chapel Hill, Copenhagen and Singapore come from `map-theme.json` with the kit's campus glyphs.
- Include the phone layout that was scoped out earlier. Story first, bottom sheet map, cooperative gestures.
- The two plane hops, with reduced motion jumping straight to the end state.
- `tests/e2e/explore.spec.ts` must drag the slider, click a marker and scroll the journal, and check all three stay in sync with the URL. A second test checks that `/journal` never loads MapLibre.
- Run `npm run build` and test the built output locally with `wrangler dev` (local only) to confirm the MapLibre worker loads in a production build, not only in dev.

### Task 4. Group features, hidden until two people have published
- Home screen "Choose your TREBLEr" / "Vælg din TREBLEr" with the scholar picker from the brand guide. It only appears when at least two people have a published entry the viewer can see. Otherwise the homepage stays as it is.
- `src/lib/crossings.ts`, a pure function that suggests crossings when two people have entries in the same city with overlapping dates. Unit tests.
- A `crossings` table in a new local migration, with a confirmation per person. A crossing only shows when every person in it has confirmed.
- Confirmed crossings get the crossing marker from the brand guide on the map. Opening one shows each person's entries from that place and time, each filtered by that person's own audience rules.
- Privacy tests proving a crossing never reveals another person's non public entries, or the existence of an unconfirmed crossing, to a public viewer.

### Task 5. Studio parts that need no Cloudflare setup
- Studio pages styled with the brand guide's upload card, visibility badge, inputs and buttons, in both languages.
- Browser media pipeline in a Web Worker. Read EXIF with exifr first, fix orientation, resize to 480, 1280 and 2048 px WebP. Re encoding strips the metadata. Unit test the pure parts. Add a test that a processed fixture image carries no GPS.
- Uploads go through an `UploadTarget` interface. The local implementation writes through a dev only route using the R2 binding, and that route refuses to run outside local dev, with a test proving it. Write the presigned URL implementation too, but mark it as needing R2 API credentials from Lucas.
- Cloudflare Access JWT verification middleware using jose, tested with a fake signing key. A local bypass works only when an explicit env variable is set, and that variable never appears in production config.
- Server side rounding of public points by precision, with tests.
- Log the exact Cloudflare steps Lucas must do in the morning under "Needs Lucas".

### Task 6. Pure ingest logic from milestone 7
- `groupIntoMoments` (two hour gap or a real change of place) and `proposeLegs` (a leg whenever the city changes, mode guessed from distance, plane over roughly 800 km). Pure functions with unit tests. No UI tonight.

### Task 7. RSS
- RSS per language with public entries only. Privacy tests covering RSS, the sitemap and link preview meta tags.

### Task 8. Review and morning summary
- Run `npm run check`, `npm run test`, `npm run test:e2e` and `npm run build`, and show the output.
- Have a subagent review the whole night's diff against the privacy rules in CLAUDE.md and the decisions in this file. Fix anything that affects correctness or privacy. Ignore style opinions.
- Write a morning summary at the top of `docs/NIGHT_LOG.md`. What is done, what is blocked, decisions you made, where the screenshots are, and a short "Needs Lucas" checklist in order of importance.
- Make sure `git status` is clean.
