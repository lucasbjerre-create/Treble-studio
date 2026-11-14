# Decisions

Calls made on this site without checking with Lucas first, newest at the top. Each entry says what was decided and why, so Lucas can accept it or reverse it.

Anything that costs money, deletes something for good or reaches real people is asked about first, so it never appears here as already done.

## 14 November 2026: UI and UX pass

Branch `ui-ux-fixes`, three commits on top of milestone 6. It adds no dependency and no migration, and nothing was deployed.

### Calls that step away from what was there

1. **Small text is one pixel larger than the brand kit.** `--text-small` went from 13px to 14px and `--text-micro` from 12px to 13px, because dates, captions and labels at 12px were hard to read on a phone. This is a judgement about the kit's values, so it is the first thing to look at. To reverse it, restore the two values in `src/styles/tokens.css`.
2. **Form controls use the site font.** Buttons, inputs, selects and textareas now inherit the font, because browsers give them a system font by default and they stood out from the text around them. Range sliders take the link colour, where they used the browser's default.
3. **The header text is larger and every link is at least 44px wide**, because the 44px tap target rule applies to the nav too. The header fits one row from 336px up in both languages. At 320px it takes two rows, as it did before.
4. **A missing page now gets a real 404 page** in Danish and English, where the public pages used to answer with the bare text "Not found". The page carries no link-preview tags (`og:` and `twitter:`), because a private entry's address answers with this same page and the privacy test requires that response to carry no preview title. The Danish wording is provisional and needs Lucas's read: see `notFound` in `src/i18n/da.ts`.
5. **Explore on desktop puts the journal on the left and the map on the right.** From 1024px the map and slider stay fixed while the journal scrolls, so the slider is reachable without scrolling back up. On a phone the open sheet stacks the bar, the map and the slider.
6. **Clicking a cluster of markers steps to the latest earlier entry behind it**, so a reader can move back through entries that sit close together. The active entry also has its own marker that never joins a cluster, so it stays visible at every zoom.
7. **The slideshow viewer is one window tall on a tablet and wider**, so a portrait photo is fitted to the screen and the controls stay visible.
8. **Removing a photo in the studio takes a second, confirming tap**, because one mistaken tap used to remove it at once. A failed delete is now reported where it used to fail silently.

### Calls about how things are built

9. **Entry dates are shown on the entry page, home, journal, archive and explore**, written as "30 Oct 2026" in English and "30. okt. 2026" in Danish. Each date is worked out in the entry's own timezone, following the rule that times are displayed in local time. As a result, an entry made at 03:30 UTC on 1 September in New York time is listed under August as 31 Aug.
10. **Month names are written out in `src/lib/entryDate.ts`** and not read from the runtime's language data, because the Workers runtime is only certain to carry English and prints English without warning when it lacks Danish.
11. **A date never breaks a page.** If an entry's timezone is not recognised, the date falls back to UTC.
12. **Captions and alt text save through a new route, `PATCH /api/studio/media/:id`.** It only changes a photo that belongs to the signed-in contributor, and anyone else's photo answers 404. Each text is limited to 400 characters. That limit is a guess at a sensible length and is easy to change in the route's validation.
13. **One existing test was changed.** The explore test that clicks a marker after zooming out used a fixed camera position that assumed a full-width map. With the map now in a narrower column on desktop, Copenhagen fell outside it. The test now fits the camera to the two entries' places and waits for the marker to be drawn. What it proves is unchanged.
14. **No test was added under `tests/privacy/`.** The 404 page is covered by the existing test for a private entry's link preview, and the new route's ownership tests are in `tests/studio/media-text.test.ts`.

### Found and left alone

These were seen during the pass and not changed, because each is either outside a UI pass or needs Lucas's view first.

- Saving an existing entry in the studio shifts its time by the browser's offset from UTC (`src/components/EntryEditor.tsx`). The new on-page dates make this visible.
- Where a campus tile sits on the same spot as an entry, the tile covers the entry's marker at the default zoom.
- Some screen-reader labels in the explorer and studio are English only, which breaks the rule that every string exists in both languages.
- Three tap targets are still under 44px: the Retry button in bulk upload (36px), the crossing marker on the map (22px) and the title link in the home page's latest entry when that entry has no summary or photo (28px).
