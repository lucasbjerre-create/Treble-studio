# Exchange year site. Master project file
Version 1.0, 23 Oct 2026. AI helpers still to merge.

## 0. Status and how to use this file

**Merged**
01 vision, 01 and 02 inspiration, 02 features, 03 and 10 design, 03 story structure, 04 fun stories, 04 and 12 multiple people, 05 capture, 05 shared vs split, 06 content workflow, 06 upload portal, 07 school assignments, 08 map and slider, 08 and 13 tech stack, 09 entry types, 09 and 14 privacy, 10 long term, 11 viewers, 15 afterlife

**Missing**
07 AI helpers. A placeholder with the rules everything else already agrees on is in section 15.

**How to use it**
This is the single source of truth for building the site. Paste it into a coding session as the project brief, and update it whenever a decision in section 14 gets made. The research files stay as background, but where they disagree with this file, this file wins.

---

## 1. What this is

**Purpose**
To help the people close to me follow what my exchange year actually feels like, while creating an honest, lasting record for my future self.

**The year**
Fall 2026 at UNC Chapel Hill, travel in between, spring 2027 at SMU Singapore, then home to Denmark. Part of the CBS TREBLE program with 15 scholars.

**Audiences, in order**
1. Parents and close family. Want reassurance, continuity and the latest update in one tap.
2. Grandparents and older relatives. Same needs, plus large type, high contrast, big tap targets, no drag only controls, no autoplay, and as little login friction as possible.
3. Friends. Browse selectively, want funny incidents, people and atmosphere.
4. Future me. Wants chronology, names, details, quiet weeks and exportable data.
5. Other TREBLE scholars. Secondary now, possible contributors later.
6. Future employers. Incidental. Served by a quiet Study or Work page later, never by changing the voice of the site.

**Five minute test**
After five minutes a visitor should say "I understand where Lucas is, what this part of the year feels like, and I can hear his voice in it."

**Success criteria**
1. A first time visitor finds the current chapter, latest update and broad route within 30 seconds without touching the map.
2. Family can point to at least one detail that feels personal, not like a generic travel recap.
3. A worthwhile update takes at most two hours a week, and the site still feels alive in a week with no trip.

**It should never become**
A live location tracker. A country counting scoreboard. An influencer blog. A weekly obligation that makes me live the year through the site. A career branding exercise. A TREBLE platform with accounts and moderation before anyone has asked for one. A media dump with no selection.

---

## 2. Core decisions

| Area | Decision |
|---|---|
| Concept | Editorial photo diary with a map that supports it. Map, timeline and entries are three views of the same data and always move together. |
| Homepage | Latest entry, current chapter and a small whole year route. The full map is one tap away, never a gate. |
| Structure | Four chapters. UNC, In Between, Singapore, Homecoming. The slider still runs on real dates. |
| Cadence | Capture all week, one review session a week, publish when there is a real scene. Monthly recap. Chapter closing essay. No promise of weekly episodes. |
| Voice | First person, close, observant, lightly self deprecating. Humour aimed at myself, never at locals. |
| Language | Danish and English throughout, with a toggle for visitors. I write in whichever language the moment happened in, AI drafts the other version, I approve it before it goes live. |
| Routes | Generated from the places of my entries. When the city changes, the studio proposes a leg and I only pick how I travelled. Hand drawn or GPX paths only for special trips. |
| Audience model | Two layers. Family layer behind Cloudflare Access with email codes, which is where new entries land by default. Public layer for entries I deliberately promote. Private drafts never reach production. |
| Reaching people | A Sunday email digest that is readable on its own, so nobody has to log in just to keep up. Link pasted into the family chat. RSS for anyone who wants it. |
| Interaction | Three aggregate reactions and a private "Ask Lucas" box. No public comments. |
| Design | Contemporary exchange magazine on warm off white. Film diary treatment for at most six feature chapters. Real scans of tickets and notes allowed as content, never as fake texture. |
| Type | Source Serif 4 for titles and text, Schibsted Grotesk for headings/UI (dates, captions, controls), IBM Plex Mono for data. Self hosted via the TREBLE brand kit, see section 6. |
| Map | MapLibre GL JS with a muted custom style. Hosted vector tiles (OpenFreeMap first), swappable through one config file. Flat and north up by default. |
| Slider | Real calendar time with snapping to entries and chapters, plus previous and next buttons and chapter jumps. |
| Data | D1 is the source of truth for inbox, drafts and entries from day one. Every publish also exports Markdown and JSON to R2. |
| Media | Browser resizes photos and strips metadata before upload. Files go straight to R2 with short lived signed URLs. Originals stay in the phone photo library. |
| Admin | One private /studio behind its own, narrower Cloudflare Access policy. |
| Privacy | Audience set per entry, never per photo. Locations at city or area level, published after I leave plus a minimum delay. |
| Other people | Schema ready for many authors now. Pilot with two scholars before anyone else gets a login. |
| End state | Archive mode about three months after returning, plus a tested export package and optionally a printed book. |

---

## 3. Conflicts between the research files and how they were settled

**Git files or a database**
08_tech_stack wanted Markdown in Git and no database until someone else joined. Capture, upload portal, content workflow and the later 13_tech_stack all need an inbox, drafts and a review queue from a phone.
Settled on D1 from day one, with Markdown and JSON exports to R2 on every publish so nothing gets trapped.

**Public site or login**
This is the biggest one. 01_vision wanted a public documentary. 09_privacy wanted public plus a family layer. 14_privacy wanted the whole site behind a login. 11_viewers and 12_multiple_people assume people can open links without an account.
Settled on a family first model with an opt in public layer. New entries default to family. I promote the ones that work publicly. The Sunday digest carries the actual photo and text, so grandparents who struggle with email codes still get the update. This stays decision 1 in section 14 because it shapes the whole build.

**Where images get processed**
08_tech_stack said Sharp on a laptop. Everything later said the browser.
Settled on the browser so the whole flow works from a phone. Sharp is only for a one time bulk import if ever needed.

**Image sizes**
06 files said 1920 px display plus a 480 px thumbnail. 13_tech_stack said 480, 1280 and 2048.
Settled on 480 thumb, 1280 display and 2048 large for full screen viewing.

**Per photo or per entry privacy**
09_privacy allowed single photos to be stricter than their entry. 14_privacy said that creates too much work.
Settled on per entry only. To keep a photo private, leave it out of the entry.

**Location delay**
09_privacy said 48 to 72 hours. 14_privacy said after leaving, maybe plus 24 to 48 hours.
Settled on after leaving the place plus at least 48 hours for everyday entries. Final number in section 14.

**Shared site, copies, or hybrid**
04_multiple_people wanted one shared site with contributor logins. 05_shared_vs_split and 10_long_term wanted separate copies under a thin overview. 12_multiple_people landed on a hybrid in one deployment, piloted with two scholars first.
Settled on the staged path in section 10, which follows 12.

**Two design directions**
03_design picked a warm field journal with Newsreader and rust. 10_design picked a contemporary magazine with Source Serif 4 and route red.
Merged into a magazine grid on warm paper tones. Source Serif 4 wins for readability. Accent color still open.

**Map width on desktop**
40 to 45 percent versus one third. Settled on roughly 40 percent, collapsible.

**Entry types**
Four files each had their own list.
Settled with two fields. Format controls how an entry looks. Category controls what it is about. Fun formats like Firsts become tags. See section 5.

**Weekly entry or flexible publishing**
06_content_workflow wanted one weekly entry. 03_story_structure warned against promising episodes.
Settled on a fixed weekly review session but flexible publishing.

**No likes, or reactions**
02_features said skip likes. 11_viewers wanted three lightweight reactions.
Settled on aggregate counts only, no names, no rankings, no popularity feed.

---

## 4. Story and content system

**Chapters and arc**
UNC, In Between, Singapore, Homecoming. Inside UNC and Singapore the same loose arc repeats. Arrival, disorientation, routine, belonging, leaving. Each chapter gets a short opening note about expectations and a closing note about what actually happened.

**Rhythm**
1. During the week, capture fragments.
2. Most weeks, publish one or two small entries if there is a scene.
3. End of month, a recap with five to eight fragments, optionally a song, three small counters and a short clip montage.
4. Roughly monthly, a postcard to everyone at home.
5. End of chapter, a 400 to 800 word reflection.

**Entry shape**
Scene, then the turn, then an afterthought. Start inside one concrete moment, show what went wrong or surprised me, end on an image or small realization. Never end on "it was amazing".

**Lengths**
Remark up to 180 characters. Postcard 40 to 80 words. Moment 40 to 100 words. Note 100 to 250 words. Feature 400 to 800 words.

**Fun formats to launch with**
Firsts, Tiny notes in the margin, Behind the photo, Weekly three (best moment, strangest detail, thing I learned). Running jokes are tags that build up over time. Rule from 04_fun_stories. If it takes more than two minutes to capture, it belongs in a normal entry or a recap.

**Recurring labels, max four**
Weekly three, Lost in translation, Class notes, Worth the detour.

**Viewer questions as fuel**
Good questions from the Ask Lucas box get answered inside the next entry under a small "You asked" heading.

**School**
Five to eight academic moments across the whole year, not every deliverable. Each reads as a short case study. The situation, my part, the work (one to three preview images), what happened, what I learned, link to that week. Grades hidden. Full files private by default until course rules, teammates and copyrighted material are checked. A generated Study index regroups the same entries by school and course. A /work view comes near graduation with the best three to five projects.

---

## 5. Entry model and data

**format** decides the layout
remark, moment, clip, note, feature, recap, postcard, milestone

**category** decides the filter
life, school, trip

**tags** carry the personality
first, behind_the_photo, lost_in_translation, class_notes, weekly_three, worth_the_detour, plus running joke tags

Trips are containers. Their child entries hold the stories.

```sql
people(id, slug UNIQUE, display_name, email, role, route_color, created_at)
chapters(id, person_id, slug, title, starts_on, ends_on, sort_order)
places(id, label, country_code, lat_private, lon_private,
       lat_public, lon_public, precision)
trips(id, person_id, title, starts_on, ends_on, summary, cover_media_id)
trip_participants(trip_id, person_id)
legs(id, trip_id, person_id, from_place_id, to_place_id,
     starts_at, ends_at, mode, geometry_json)
entries(id, person_id, chapter_id, trip_id, place_id, slug,
        format, category, arc_stage, status, audience,
        original_lang, title, dek, body_md, occurred_at, ended_at, timezone,
        publish_after, consent_status, featured, group_map_opt_in,
        camera_json, created_at, updated_at, published_at)
media(id, entry_id, owner_id, kind, key_thumb, key_display, key_large,
      poster_key, mime, width, height, duration_ms, bytes,
      captured_at, caption, alt_text, sha256, phash, sort_order)
tags(id, slug UNIQUE, label)
entry_tags(entry_id, tag_id)
assignments(entry_id PRIMARY KEY, institution, course, role, team,
            public_summary, document_key, artifact_audience)
inbox_items(id, owner_id, created_at, source, text,
            lat_private, lon_private, media_keys_json, status)
reactions(entry_id, kind, count)
questions(id, entry_id, name, text, created_at, status)
review_events(id, entry_id, actor_id, from_status, to_status, note, created_at)
entry_texts(entry_id, lang, title, dek, body_md, status)
media_texts(media_id, lang, caption, alt_text, status)
```

The fields on entries and media hold the original language. entry_texts and media_texts hold the other language.

**Allowed values**
- status. inbox, draft, uploading, ready, published, archived
- audience. private, family, public
- precision. exact (public landmarks only), area, city, hidden
- consent_status. not_needed, asked, yes_family, yes_public, declined
- arc_stage. arrival, disorientation, routine, belonging, leaving
- mode. walk, car, bus, train, ferry, flight
- kind. photo, clip, audio, pdf
- lang. da, en
- translation status. draft, approved

**Indexes**
(person_id, occurred_at), (status, published_at), chapter_id, and every foreign key.

---

## 6. The experience

**Desktop**
Sticky map on roughly 40 percent of the screen, scrolling journal beside it. The entry in view drives the map. "Explore map" hands control to the reader, "Resume story" hands it back.

**Phone**
Story first. A 30 to 40 percent tall map at chapter openings, then a slim sticky bar with place, date and a Map button that opens a bottom sheet. Embedded map needs two finger gestures so normal swiping keeps scrolling.

**Simple view at /journal**
Latest update first, big Older and Newer buttons, 18 to 20 px text, 44 px controls, location as a text label instead of a map, captions on every clip. A "Simple view" toggle on every page, remembered on that device. Fully usable without the map or heavy JavaScript.

**Language toggle**
DA and EN switch in the header on every page, including /journal and the studio preview. URLs under /da and /en so a link always opens in the language it was shared in. First visit follows the browser language, after that the choice is remembered. If a translation is not approved yet, the original shows with a small note saying so. Dates, map labels and interface text are translated too.

**Map rules**
One marker per entry, never per photo. Built in clustering at low zoom. Past route solid and muted, current leg stronger, future hidden. Flights drawn as arcs. Only two cinematic transitions in version 1, Denmark to Chapel Hill and the US to Singapore, each about 1 to 1.5 seconds. Normal camera moves 800 to 1200 ms. Camera stops moving on its own as soon as the reader touches the map.

**Slider**
Value is calendar time. Snaps to entries and trip edges. Labels like "Week 9 · Chapel Hill · 12 to 18 Oct". Arrow keys move entry by entry, Shift plus arrow moves chapter by chapter. Every state has its own URL.

**Design system**
The TREBLE brand kit (`docs/brand/`, decided 2026-10-24) is now the source of truth for palette, type, radius and shadow, replacing the warm-off-white/near-black/muted-grey-blue/route-accent placeholder this section used to describe. Role tokens in `src/styles/tokens.css`: warm paper background, near-black ink text, the three institutional blues (CBS, Carolina, SMU) as ink and interactive colour only, never large fills - adjacent chambray/steel/periwinkle/slate tones carry large areas instead. Radii are small on purpose (hairline to 12px, pill for badges and the language toggle), not strictly zero - the old "no rounded corners" rule is relaxed to what the kit specifies. Shadows stay warm, low and rare, used only where the kit calls for them (the studio review panel's modal layer). Four compositions only. Short dispatch, standard story, photo sequence, feature chapter. Original aspect ratios. Captions always visible. Motion 140 to 360 ms, none at all when reduced motion is on. Video starts muted on tap, captions expected, no soundtrack. Contrast at least 4.5 to 1 for text - the kit's own rule that Carolina Blue is never text on a light background is part of this. Tap targets 44px (the kit's `--touch-min`).

Scholar colours come from a `seat` integer (1-16) on `people`, not a freeform `route_color` string - eight hues, two line patterns (solid for seats 1-8, dashed for 9-16), assigned alphabetically by surname at launch and never reshuffled. Visibility badges always carry both a word and an icon, never colour alone: `public` shows as Public/Offentlig, `family` as Followers only/Kun følgere, `private` as Only me/Kun mig - the underlying audience values are unchanged. The `Logo` component wraps the kit's SVG lockup/mark/descriptor files; the lockup shows on wide screens, the mark alone on phones, the paper variant on dark backgrounds (there is no full-colour variant for dark - the navy bar disappears). The wordmark in the kit is a stand-in typeface (Jost, outlined), noted here per the kit's own README until the programme office confirms the real face.

**Small touches worth keeping**
Transport glyph changes by leg. Chapter stamps like "UNC · Fall 2026". A "Where was Lucas then?" date picker. Margin notes from remarks. An end of year replay in version 3.

---

## 7. Viewers and family

**The loop**
Notification, direct link, short entry, one tap response.

**Sunday digest**
MailerLite free plan, invitation only list. One lead image, two sentences, links to the new entries, and one question like "What should I explain next?". The digest must make sense on its own, without logging in. Subscribers pick Danish or English when signing up and get that version. Weekly or fortnightly is still open. Same link pasted by hand into the family chat. RSS feed generated for free.

**Reactions**
Three buttons per entry, labels still open. Counts only. No names, no ranking, no popular feed.

**Ask Lucas**
One short field, name optional, never published automatically. Protected by Cloudflare Turnstile, a honeypot and rate limiting. Read only during the Sunday session. No promise of individual replies.

**Postcards**
One image, place, date, 40 to 80 words, a clean share preview. Addressed by first name at most and only with permission.

**Boundaries**
No direct messages, live chat, follower counts or reply deadlines. No email after every small upload. Unsubscribe in every email. Only measure what helps editorial choices, like digest clicks and which entries get reactions.

---

## 8. Content pipeline

**During the week, under five minutes total**
1. Normal Camera app, tap the heart on anything that might belong.
2. "Save moment" Shortcut on the Action button. Dictate one sentence, it adds time and optional coarse location, sends it to the private inbox, confirms with a haptic. Target under 20 seconds. Falls back to saving offline and retrying.
3. "Send to travel inbox" Shortcut in the Photos share sheet for media plus an optional caption.
4. Voice Memos only for longer reflections.
Before building the Shortcut backend, test the habit for one week with an Apple Note called Travel Inbox.

**Sunday in /studio, 60 to 100 minutes**
1. Add this week. Drop photos, clips, voice memos, notes and PDFs at once.
2. Upload desk. Tiles move through preparing, uploading, ready. Retry per file, safe to close and reopen.
3. Import report. Counts, date range, places found, missing GPS, duplicates, oversized clips.
4. Days and moments. Grouped by day, split when there is a gap of about two hours or a real change of place. Inbox fragments placed by timestamp. Merge, split, rename.
5. Cull. Contact sheet per moment. Use, Maybe, Skip. Near duplicates stacked with a suggested keeper. Blur is a hint, never a verdict.
6. Write. Title, place label, short text. Captions only where context is not obvious.
7. Translate. AI drafts the other language, I read it and fix anything that doesn't sound like me. About ten minutes.
8. Route. For every change of city since last week, one card asks how I travelled. One tap each.
9. Tag and set audience, precision and consent. Check backgrounds for room numbers, IDs, screens and street signs.
10. Clear the Ask Lucas box and glance at reactions. Five minutes.
11. Preview on phone and desktop in both languages, check the map, publish.
12. Write the digest blurb and send.
Hard rule. If the session passes 100 minutes, publish less rather than postpone.

**Automation rules**
Automation orders and shrinks the queue. It never deletes and never publishes.

**Routes**
No GPS tracking and no typing in trips by hand. The route is built from places I already have.
1. Every published entry already has a place with a rounded public point.
2. When two entries in a row sit in different cities, the studio proposes a leg between them and shows one card, like "Chapel Hill to Asheville, how?" with chips for plane, train, bus, car, ferry, walk.
3. It pre picks a guess. Over roughly 800 km suggests plane, under suggests car. I confirm or change it with one tap.
4. Flights become great circle arcs between cities, never airports. Ground legs become a simple line or gentle curve.
5. Moving around inside one city creates no legs, only points.
6. For trips where the path itself is the story, like a hike or a road trip, a "show the path" switch on the trip uses the rounded photo locations from that trip, in time order, as waypoints. A GPX file from a watch or hiking app can replace them when it exists.
7. Start and end of any detailed path are trimmed when they sit near where someone lives.
8. The same logic runs for the backfill of August to October, where the studio proposes all past legs at once.
Not doing. Live tracking, location history imports, parsing booking emails, road snapping through a routing service.

**Media rules**
Photos have orientation fixed first, then get resized in the browser to 480, 1280 and 2048 px WebP. Metadata is read before resizing and stored privately, then stripped from everything published while keeping the colour profile. Clips are one per entry, trimmed on the phone, H.264 MP4, up to about 30 seconds and 50 MB, with a poster frame made in the browser. Longer video goes to YouTube as unlisted. Rejected uploads expire after 30 days.

**Storage estimate**
About 0.9 MB per photo across three sizes. Ten photos plus one 40 MB clip is about 50 MB a week, or around 2.6 GB for the year. Comfortably inside the 10 GB R2 free tier as long as originals stay on the phone. With other scholars, budget quotas from the start, since 10 GB split across 15 people is under 700 MB each.

---

## 9. Privacy rules

- Audience on every entry. Private never reaches production. Enforced in SQL and in the Worker, never just hidden in the interface.
- Family layer uses an explicit email allowlist in Cloudflare Access. Never "anyone with an email", never a whole university domain. /studio gets its own narrower policy. Test with an unapproved email after every policy change.
- Family media served through the Worker or short lived signed URLs. R2 stays private, r2.dev off.
- Public points at city or area level. Never my home, dorm, regular study spot, gym, a friend's home or any hotel.
- Coordinates rounded on the server before they reach the browser. No exact coordinates in page source, JSON, filenames, RSS or link previews.
- Published after leaving the place plus at least 48 hours for everyday entries. No future route segments in public.
- First and last part of routes hidden when they point to where someone lives. Intercity routes drawn between safe waypoints, never as a GPS replay.
- All EXIF, IPTC and XMP stripped from published copies, then checked on a sample.
- Ask before publishing an identifiable friend. A yes for family is not a yes for public. Removal link on every entry, requests honoured without discussion. Blur, crop or initials as options.
- No identifiable minors without a parent's clear yes.
- School files private by default. No grades, student numbers, restricted prompts or classmates' work without consent.
- Cloudflare, domain and recovery codes tied to my personal email, not the university one. Strong authentication on both. One named backup administrator.

---

## 10. Other people, staged

**Stage 0, now**
person_id, trip_participants, group_map_opt_in and quotas exist in the schema. Nothing visible.

**Stage 1, someone shows interest**
A thin TREBLE overview. One card per scholar who opts in, broad location, link to whatever they already use. Updates collected through a short form and published in one weekly batch.

**Stage 2, after several months of my own real use**
Pilot with two scholars in the same deployment. Routes like /lucas, /anna and /treble. Same upload flow, separate media folders, own content only. Shared trips as one canonical entry with each person's contribution attributed. People switcher, simplified routes at world scale, same date kept when switching. Crossings suggested automatically from matching city and overlapping dates, shown as confirmed only once both people say yes - nothing about a crossing is asserted without both people's say-so, only the suggestion itself is computed rather than purely manual. Group map opt in per entry.
Stop rule. If the pilot costs more than about 15 minutes of my admin time per contributor per week, stop growing and offer a template instead.

docs/BUILD_PLAN.md's milestones 5 ("Viewers and followers") and 6 ("Second trebler") cover this stage - viewers/followers, contributor onboarding, quotas, the trebler picker and crossings.

**Stage 3, only if the pilot works**
Open to more scholars. Compare mode capped at four detailed routes, using name plus color plus line pattern. Inactive people show their last update and "updates paused". No leaderboards of any kind.

**What to say whenever someone joins**
Participation is optional. You own your words and photos. Locations are delayed and approximate. You can export or remove everything. I can hide material that creates safety or consent problems. Nobody promises permanent hosting.

---

## 11. Tech stack

**Site**
Astro with TypeScript and plain CSS. One React island, TimelineExplorer, owns map, slider, active entry and camera. A second React area for /studio. Deployed as one Worker with static assets.

**API**
Hono routes under /api inside the same Worker. Zod for request validation. Drizzle for typed D1 schema and migrations, with plain prepared SQL where the timeline queries need it.

**Data**
D1 for everything structured. R2 for media and for the Markdown plus JSON export of every published entry. A one command export bundles the lot.

**Rendering**
Public pages render from D1 through Astro and are cached. Test early that this stays under the 10 ms CPU limit. Fallback is a static rebuild triggered on publish.

**Map**
MapLibre GL JS, loaded only in the browser. Hosted vector tiles with OpenFreeMap first, MapTiler or Stadia as managed backups, Protomaps PMTiles only after the exchange if ever. Never tile.openstreetmap.org. Always show OpenStreetMap attribution. Provider set in one config file. Turf only for arcs and distances.

**Media libraries**
exifr for metadata including HEIC. pica or browser image compression for resizing. Perceptual hashing in version 2.

**Auth and forms**
Cloudflare Access for family viewers and for /studio, as separate policies. The Worker checks the signed identity on every write. Turnstile on public forms.

**Uploads**
Worker hands out short lived, object specific signed PUT URLs with exact content types. Browser uploads directly to R2, multipart for larger clips. Then a commit call where the Worker checks the object exists before saving the media row. CORS limited to the site origin. Orphan uploads cleaned up.

**Email**
MailerLite free plan for the digest.

**Free tier numbers from the research, check again before building**
- Workers. 100,000 requests a day, 10 ms CPU and 128 MB memory per request, 100 MB request body
- Static assets. Free and unlimited requests, 20,000 files per version, 25 MiB per file
- R2. 10 GB a month storage, 1 million Class A and 10 million Class B operations, free egress
- D1. 5 million rows read and 100,000 written per day, 5 GB storage, 500 MB per database
- Access. Free up to 50 users
- Turnstile. Free plan with unlimited verifications
- MailerLite. Free up to 250 subscribers and 2,500 emails a month

**Folder sketch**
```
/
├─ src/
│  ├─ pages/            index, [person]/[slug], journal, archive, study, studio/*
│  ├─ components/       TimelineExplorer.tsx, studio/*
│  ├─ layouts/          EntryLayout.astro
│  ├─ worker/api/       entries, uploads, review, inbox, reactions, questions
│  ├─ worker/           auth.ts, db.ts
│  ├─ lib/              dates, map, media, visibility, privacy (rounding and delay)
│  ├─ content/          schema.ts
│  └─ styles/
├─ migrations/          D1 schema
├─ public/              fonts, icons, map-style.json
├─ shortcuts/           notes on the two iPhone Shortcuts
├─ scripts/export.ts    export package with checksums
├─ tests/               unit, integration, Playwright for map, slider and URL sync
├─ astro.config.mjs
└─ wrangler.jsonc
```

**Rules to give any AI coding tool**
- This runs on the Cloudflare Workers runtime, not a Node server. No fs, no long CPU jobs, no native packages, no AWS SDK patterns unless asked.
- Never import MapLibre during server rendering. Load it in the browser and destroy the map on unmount.
- One shared timeline state that map, slider, scroll and URL all read from.
- Always use migrations. Never recreate tables to "fix" production.
- Test longitude and latitude order, local time versus UTC, daylight saving changes and the date line.
- Keep local, staging and production D1 and R2 bindings separate.
- Pin major versions and check current Cloudflare docs, since examples online often mix old Pages Functions and old Wrangler syntax.

---

## 12. Build plan

**Version 1, the core**
- Astro site with homepage, entry pages, archive and the /journal simple view
- MapLibre map with entry points and legs, snapping slider with previous and next, chapter jumps, shareable URLs
- D1 schema and R2 buckets
- Family layer and /studio behind separate Access policies
- /studio with batch upload, EXIF read, browser resize and stripping, direct uploads, day grouping, Use Maybe Skip, write, audience, precision, consent, publish
- Save moment Shortcut into the inbox
- Formats remark, moment, note and clip, plus trip containers and school fields
- Privacy defaults for rounding, delay and hidden route ends
- Digest signup and RSS
- Two plane hop transitions

**Version 2, after four real Sunday sessions**
- Perceptual duplicate stacks, cached reverse geocoding, blur hints
- Reactions and the Ask Lucas box
- Postcard, recap and Weekly three templates
- Study index for school entries
- Small stats panel with days abroad, cities, trips and approximate distance
- Measure average session time, GB uploaded and how often metadata needs fixing

**Version 3, when the archive is big enough**
On this day, replay mode, search, TREBLE overview and pilot, end of year review in the Feltron spirit, print export

**Not building**
Live tracking, full GPS trails, public comments, follower counts, badges and streaks, 3D globe as default, autoplay sound, AI written diary text, automatic video transcoding, per photo permissions

---

## 13. After the exchange

**Archive mode, about three months after returning**
Final edits to captions, dates and routes. Replace "latest" and "current location" wording with the completed date range. Add an epilogue and a last updated date. Remove /studio, uploads, reactions, questions, Shortcut endpoints and unused secrets. Keep the map and slider read only, with plain date and place index pages as a fallback.

**Export package**
/source, /site (runs from plain file hosting), /content (Markdown and JSON), /data (GeoJSON routes, places, people), /media-originals and /media-web with stable filenames, /exports (chronological HTML, print PDF, CSV index), README_ARCHIVE, LICENSE, PRIVACY and a SHA256 checksum manifest. Three copies, cloud, external drive, a second cloud or family member. Test once offline and test a restore into an empty folder.

**Hosting and domain**
Keep it on Cloudflare while it stays free. Renew a custom domain only if it becomes my broader personal domain. Otherwise redirect it for one more year and let the archive live at its Cloudflare address.

**Book**
A separate curated print layout from the same entries, about one spread per big week or trip, split into the four chapters. HTML and CSS print styles exported to PDF, then printed through a service like Blurb. QR codes for a few videos.

**Template**
Only if at least two students actually want it. Separate repo, fictional sample content, one config file, clear setup guide, no personal data, marked as self service.

---

## 14. Open decisions

**Settled**
- Custom domain: `treble.cordoza.dk`, a subdomain of Lucas's existing `cordoza.dk`. Decided 2026-10-23, not for branding but because Cloudflare Access's path-scoped applications require a DNS zone the account owns, which the shared `workers.dev` domain isn't - /studio couldn't be gated without it. The Worker's `workers.dev` URL is now disabled (Wrangler's default once a custom domain route is set).
- Route accent colour (item 4 below): settled by the TREBLE brand kit, decided 2026-10-24. There is no single bespoke "route accent" any more - interactive colour is the kit's `--color-link` (CBS blue, ink only), and routes/trails on the map use each scholar's seat colour (section 6) rather than one shared accent. The "muted red placeholder" token this item used to point at is gone.

**Needed before building**
1. Audience model. Family first with opt in public entries (this file's default), or public first with a family layer on top.
2. Who goes on the family allowlist, and whether grandparents can manage email codes or rely on the digest.
3. Which language a first time visitor lands on when the browser gives no clear signal.
4. ~~Route accent color.~~ Settled, see above.
5. Does the whole Sunday flow have to work on the phone, or is a laptop fine for parts of it.
6. Exact delay for everyday entries, and whether area level is ever allowed.
7. Max clip length and size.
8. Does the site start with leaving Denmark or with arriving in Chapel Hill.
9. Which hosted tile provider's current terms are acceptable.

**Needed during the first month**
10. Digest weekly or fortnightly.
11. The three reaction labels.
12. Which three fun formats I really expect to keep for a whole year.
13. Default consent rule when a friend just says "yes".
14. How candid to be about loneliness, money, grades and relationships, and the rule for party and dating content.
15. Planned future destinations shown faintly, or only places already visited.
16. Should links sent to grandparents open in simple view by default.

**Needed before milestone 5**
- Whether "family" becomes "followers of this person" if the site goes group - a per-person follow relationship instead of one shared family list. Decide before milestone 5 (Viewers and followers).

**Can wait**
17. Grades ever visible.
18. Study index public from launch or only for job applications.
19. TREBLE overview public, link only or invite only.
20. Printed book, and which format.
21. Whether the template shares only code or also the design.
22. Who is backup administrator and gets the recovery instructions.
23. Whether originals are kept privately anywhere besides the phone library, and for how long.

---

## 15. Still to merge

**07 AI helpers**
Placeholder. Rules already agreed across the other files.
- AI may transcribe voice memos, group fragments, suggest titles, tags, alt text, digest subject lines and camera bounds.
- AI drafts the Danish or English version of each entry, caption and digest. I approve every translation, and unapproved ones never go live.
- AI must not write reflections or diary text, invent jokes, quotes, coordinates, dates or routes, describe teammates' contributions, or blend different authors' voices.
- Private originals, faces, exact locations and captions are not sent to an AI service unless I turn it on deliberately.
- Every AI suggestion is approved by me before anything is published or sent.
- The live site never depends on an AI service, so the archive keeps working without one.
