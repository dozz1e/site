import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { readFileSync } from 'node:fs';

// Las redirecciones de cursos que cambiaron de URL se generan desde previousSlugs
// en src/data/courseOverrides.json (ver src/pages/cursos/[slug].astro).
// Esas páginas de redirección no deben aparecer en el sitemap.
function isRedirectPage(pageUrl) {
  try {
    const html = readFileSync(new URL(`./dist${new URL(pageUrl).pathname}index.html`, import.meta.url), 'utf8');
    return html.startsWith('<!doctype html><title>Redirecting');
  } catch {
    return false;
  }
}

export default defineConfig({
  site: 'https://cenakin.cl',
  output: 'static',
  integrations: [sitemap({ filter: (page) => !isRedirectPage(page) })],
});
