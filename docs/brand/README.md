# TREBLE brand kit

Everything the exchange site needs to look like one thing. Built on the official TREBLE mark, the three school blues and the decisions in the build file v2 and the logo spec. Open `brand-guide.html` to see all of it rendered.

## Put it in the project

```
src/treble/tokens.css
src/treble/treble-theme.css      (Tailwind v4 only)
tailwind.config.js               (Tailwind v3, or v4 through @config)
public/                          copy the contents of public/ here
```

Tailwind v4, in your main CSS file, in this order:

```css
@import "tailwindcss";
@import "./treble/treble-theme.css";
@import "./treble/tokens.css";
```

Tailwind v3 or plain CSS. Import `tokens.css` once at the root and use `tailwind.config.js` as it is. With v3, opacity modifiers like `bg-surface/50` will not work because the colours are CSS variables. Use `color-mix()` or a dedicated token instead.

In the document head:

```html
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta property="og:image" content="https://YOUR-DOMAIN/og-image.png">
<meta name="theme-color" content="#F4F2ED" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#10142A" media="(prefers-color-scheme: dark)">
```

## How the tokens work

Raw palette tokens (`--treble-cbs`, `--neutral-bone`, `--adj-chambray`) never change. Role tokens (`--color-bg`, `--color-text`, `--color-link`) switch between light and dark. Components only use role tokens.

Theme. Leave `data-theme` off the html element to follow the system, or set `data-theme="light"` or `"dark"` to force one.

Scholars. Put `data-seat="1"` to `"16"` on an element. Inside it, `var(--scholar)` is the colour, `var(--scholar-text)` is the right colour for initials on top of it, and `var(--scholar-dash)` is `none` or `6 4`. Seats 1 to 8 are solid, 9 to 16 dashed with the same hues. Assign seats alphabetically by surname at launch and never reshuffle.

Map. `map-theme.json` holds the base map colours for both modes, trail widths as MapLibre expressions, marker sizes, the three campus points and the crossing rule. Read colours from it when building the MapLibre style, or read the CSS variables at runtime with `getComputedStyle(document.documentElement).getPropertyValue('--map-land')` and rebuild the style when the theme changes.

Classes included in `tokens.css`. `.t-prose` for reading text, `.t-eyebrow` for small caps labels, `.t-data` for mono figures, `.photo` for uploaded images with the shared light grade.

## Logo files

Named `[owner]_[asset]_[variant]_[colourspace].svg`, as in the build file.

| Asset | Use |
|---|---|
| `treble_lockup-h` | Nav on wide screens, footer |
| `treble_mark` | Nav on phones, anything under 160 px wide |
| `treble_wordmark` | When the bars already appear nearby |
| `treble_lockup-stacked` | Proposed, not official. Square spaces |
| `treble_lockup-descriptor` | About page, footer |
| `treble_favicon_tile` | Favicon source |
| `treble_social_1200x630` | og-image source |

Variants. `fullcolour` on light only. `paper` (#F4F2ED) on dark. `navy`, `black`, `white` for single colour use. There is no full colour version for dark backgrounds because the navy bar disappears, see the open questions.

Clear space is one bar width on every side, about 15 percent of the lockup height. Minimum sizes on screen, lockup 160 px wide, bars 24 px, wordmark 120 px.

The wordmark is a stand in. It is Jost Regular (SIL Open Font License, free for any use), outlined to paths and spaced to the measured letter gap. The real typeface was never identified. Replace the wordmark paths when the programme office confirms the face. The mark itself is rebuilt from pixel measurements of the supplied PNG.

## Fonts

All free from Google Fonts under the SIL Open Font License, all with full Danish support. `tokens.css` loads them with one `@import`. For production, self host with `@fontsource/schibsted-grotesk`, `@fontsource-variable/source-serif-4` and `@fontsource/ibm-plex-mono` and remove the import line.

| Role | Face | Weights |
|---|---|---|
| Headings and UI | Schibsted Grotesk | 400, 500, 600 |
| Reading text | Source Serif 4 | 400, 500, italic 400 |
| Data | IBM Plex Mono | 400, 500 |

## Rules that are easy to break

* Carolina Blue is never text on a light background. It fails contrast at 2.68 to 1.
* Subtle text and links never sit on the sunken surface in light mode. Both fail.
* Institutional blues are ink. Large areas use adjacent blues or neutrals.
* Colour is never the only signal. Scholars also have initials and line pattern, visibility badges have a word and an icon.
* Never animate the logo, the language switch or a scholar colour.
* Strip EXIF from served photos. Store date and location server side first.

## Changing things

Edit `tokens.css` first, then update the matching value in `tailwind.config.js` only if you added a token. `treble-theme.css` repeats the light values so Tailwind v4 can generate utilities, so change it too when a light value changes.
