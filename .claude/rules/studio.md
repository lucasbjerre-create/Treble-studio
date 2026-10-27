---
paths:
  - "src/components/studio/**"
  - "src/pages/**/studio/**"
  - "src/lib/media*"
  - "src/lib/ingest*"
---

# Studio rules

- Read EXIF with exifr before resizing or converting anything. Store the result on the media row, privately.
- Fix orientation first, then resize to 480, 1280 and 2048 px WebP in the browser. Process files one at a time or in a Web Worker so phones do not run out of memory.
- Uploads go straight to R2 with signed PUT URLs, then a commit call. Show progress and a retry button per file. A failed file never fails the whole batch.
- Automation can sort, group and suggest. It never deletes and never publishes - except a draft nobody finished, which auto-deletes DRAFT_EXPIRY_DAYS (src/config/site.ts) after it was created. Never a published entry, and never anything Lucas has to notice or approve first; see src/worker/entryDeletion.ts.
- Nothing is published without an explicit Publish click, and the publish step shows audience, precision, consent and a preview in both languages.
- Upload, cull and route cards must work one handed on a phone at 375 px.
