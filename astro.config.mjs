import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://cenakin.cl',
  output: 'static',
  integrations: [sitemap()],
});
