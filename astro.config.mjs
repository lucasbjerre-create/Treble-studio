// @ts-check
import { defineConfig } from 'astro/config';

import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  // Both auto-provision real Cloudflare resources (an Images binding, a KV
  // namespace) on deploy by default. Neither matches this project's stack:
  // image processing happens in the browser (CLAUDE.md), and there's no
  // session/cookie auth model (Cloudflare Access handles auth instead).
  session: false,
  adapter: cloudflare({
    imageService: 'passthrough'
  }),
  integrations: [react()]
  // No `i18n` config: Astro's built-in i18n routing is folder-based only,
  // which would force every dynamic page (entry, archive, journal) to be
  // duplicated under both en/ and da/ folders. `lang` is instead a plain
  // dynamic route param like any other - same /en/ and /da/ URLs, one
  // file per page. See src/pages/[lang]/.
});