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
  integrations: [react()],
  i18n: {
    locales: ['en', 'da'],
    defaultLocale: 'en',
    routing: {
      prefixDefaultLocale: true
    }
  }
});