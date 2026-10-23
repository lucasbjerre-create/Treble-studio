---
paths:
  - "src/components/TimelineExplorer*"
  - "src/components/map/**"
  - "src/lib/timeline*"
  - "src/lib/map*"
  - "src/config/map.ts"
---

# Map and timeline rules

- `src/lib/timeline.ts` is the single source of state. Map, slider, scroll and URL all read from it and write back through it. No component keeps its own copy of the active entry.
- Import `maplibre-gl` only inside the client island. Call `map.remove()` on unmount.
- GeoJSON is [lon, lat]. Name variables `lon` and `lat`.
- One marker per entry, never per photo. Load thumbnails only for the selected marker or an opened cluster.
- Camera moves 800 to 1200 ms. Only the Denmark to Chapel Hill and US to Singapore hops get a cinematic sequence. Stop automatic camera movement as soon as the reader touches the map.
- With `prefers-reduced-motion`, jump straight to the end state.
- Every action has a keyboard and non drag alternative.
