/** TREBLE Tailwind config
 *  Works as a v3 config, and in Tailwind v4 through `@config "./tailwind.config.js";`
 *  If you are on v4 and prefer the CSS-first setup, use treble-theme.css instead of this file.
 *  Every value points at a variable in tokens.css, so dark mode switches without `dark:` classes.
 */
const v = (name) => `var(--${name})`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx,vue,svelte,astro,html}"],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    screens: { sm: "480px", md: "768px", lg: "1024px", xl: "1280px", "2xl": "1536px" },
    colors: {
      transparent: "transparent",
      current: "currentColor",
      bg: v("color-bg"),
      surface: { DEFAULT: v("color-surface"), sunken: v("color-surface-sunken"), inverse: v("color-surface-inverse") },
      overlay: v("color-overlay"),
      text: { DEFAULT: v("color-text"), muted: v("color-text-muted"), subtle: v("color-text-subtle"), inverse: v("color-text-inverse") },
      heading: v("color-heading"),
      link: { DEFAULT: v("color-link"), hover: v("color-link-hover") },
      border: { DEFAULT: v("color-border"), strong: v("color-border-strong") },
      focus: v("color-focus"),
      primary: { DEFAULT: v("color-primary"), hover: v("color-primary-hover"), on: v("color-on-primary") },
      "accent-area": v("color-accent-area"),
      success: { DEFAULT: v("color-success"), bg: v("color-success-bg") },
      warning: { DEFAULT: v("color-warning"), bg: v("color-warning-bg") },
      error: { DEFAULT: v("color-error"), bg: v("color-error-bg") },
      info: v("color-info"),
      public: v("color-public"),
      private: v("color-private"),
      treble: { cbs: v("treble-cbs"), unc: v("treble-unc"), smu: v("treble-smu"), gold: v("treble-smu-gold") },
      adj: { chambray: v("adj-chambray"), steel: v("adj-steel"), periwinkle: v("adj-periwinkle"), slate: v("adj-slate"), navy: v("adj-navy") },
      neutral: {
        optic: v("neutral-optic"), bone: v("neutral-bone"), oat: v("neutral-oat"), sand: v("neutral-sand"),
        cement: v("neutral-cement"), mid: v("neutral-mid"), charcoal: v("neutral-charcoal"), offblack: v("neutral-offblack"),
      },
      scholar: {
        DEFAULT: "var(--scholar)",
        fjord: v("scholar-fjord"), ochre: v("scholar-ochre"), pine: v("scholar-pine"), rose: v("scholar-rose"),
        sky: v("scholar-sky"), brick: v("scholar-brick"), plum: v("scholar-plum"), ink: v("scholar-ink"), on: v("scholar-on"), "on-alt": v("scholar-on-alt"), text: "var(--scholar-text)",
      },
      map: {
        land: v("map-land"), water: v("map-water"), park: v("map-park"), building: v("map-building"),
        road: v("map-road"), "road-major": v("map-road-major"), boundary: v("map-boundary"),
        label: v("map-label"), halo: v("map-label-halo"), casing: v("map-trail-casing"),
        campus: v("map-campus"), "campus-glyph": v("map-campus-glyph"), dimmed: v("map-dimmed"),
      },
    },
    fontFamily: { sans: v("font-sans"), serif: v("font-serif"), mono: v("font-mono") },
    fontSize: {
      display: [v("text-display"), { lineHeight: v("leading-display"), letterSpacing: v("tracking-display"), fontWeight: "500" }],
      h1: [v("text-h1"), { lineHeight: v("leading-h1"), letterSpacing: v("tracking-h1"), fontWeight: "500" }],
      h2: [v("text-h2"), { lineHeight: v("leading-h2"), letterSpacing: v("tracking-h2"), fontWeight: "500" }],
      h3: [v("text-h3"), { lineHeight: v("leading-h3"), letterSpacing: v("tracking-h3"), fontWeight: "600" }],
      h4: [v("text-h4"), { lineHeight: v("leading-h4"), fontWeight: "600" }],
      "body-lg": [v("text-body-lg"), { lineHeight: v("leading-body") }],
      body: [v("text-body"), { lineHeight: v("leading-body") }],
      ui: [v("text-ui"), { lineHeight: v("leading-ui") }],
      small: [v("text-small"), { lineHeight: v("leading-small") }],
      micro: [v("text-micro"), { lineHeight: v("leading-small") }],
    },
    fontWeight: { regular: "400", medium: "500", semibold: "600" },
    letterSpacing: { display: v("tracking-display"), tight: v("tracking-h2"), normal: "0", mono: v("tracking-mono"), eyebrow: v("tracking-eyebrow") },
    spacing: {
      0: v("space-0"), px: "1px", 0.5: v("space-0-5"), 1: v("space-1"), 2: v("space-2"), 3: v("space-3"), 4: v("space-4"),
      5: v("space-5"), 6: v("space-6"), 8: v("space-8"), 10: v("space-10"), 12: v("space-12"), 16: v("space-16"),
      20: v("space-20"), 24: v("space-24"), 32: v("space-32"), nav: v("nav-height"), touch: v("touch-min"),
    },
    borderRadius: { none: v("radius-none"), xs: v("radius-xs"), sm: v("radius-sm"), DEFAULT: v("radius-sm"), md: v("radius-md"), lg: v("radius-lg"), full: v("radius-pill") },
    boxShadow: { none: "none", sm: v("shadow-sm"), DEFAULT: v("shadow-sm"), md: v("shadow-md"), lg: v("shadow-lg"), focus: v("shadow-focus") },
    transitionDuration: { 0: "0ms", instant: v("duration-instant"), fast: v("duration-fast"), DEFAULT: v("duration-base"), base: v("duration-base"), slow: v("duration-slow"), map: v("duration-map") },
    transitionTimingFunction: { DEFAULT: v("ease-standard"), standard: v("ease-standard"), enter: v("ease-enter"), exit: v("ease-exit"), map: v("ease-map") },
    zIndex: { map: v("z-map"), "map-ui": v("z-map-ui"), sheet: v("z-sheet"), nav: v("z-nav"), popover: v("z-popover"), modal: v("z-modal"), toast: v("z-toast") },
    extend: {
      maxWidth: { content: v("content-max"), measure: v("measure") },
      aspectRatio: { portrait: "4 / 5", landscape: "3 / 2", wide: "16 / 9" },
    },
  },
  plugins: [],
};
