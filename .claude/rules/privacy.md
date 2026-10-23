---
paths:
  - "src/worker/**"
  - "src/pages/api/**"
  - "src/db/**"
  - "src/lib/privacy*"
  - "src/pages/**/rss*"
  - "migrations/**"
---

# Privacy rules for server code

- Every query that returns entries, media, places or legs takes a viewer (`public`, `family`, `studio`) and filters by audience, status and `publish_after` in SQL.
- Responses to `public` and `family` viewers never include `lat_private`, `lon_private`, raw EXIF, original filenames, consent notes or inbox items.
- Public coordinates are derived on the server from the entry's precision. Never send exact coordinates and blur them in the browser.
- Detailed paths have their first and last part trimmed when near home. Legs dated after now are never returned to public or family viewers.
- Studio and write routes verify the Cloudflare Access JWT in the Worker, even though Access also sits in front.
- Add or update a test in `tests/privacy/` for every change here.
