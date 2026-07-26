# WooCommerce Course Loader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static `src/content/curso/*.json` course collection with an Astro Content Layer loader that fetches course data live from WooCommerce (`https://cenakin.cl/otec`) at every build, combined with a small editorial overrides file for content WooCommerce doesn't have.

**Architecture:** `src/content/config.ts` defines the `curso` collection with a custom `loader` function. For each product ID listed in `src/data/courseOverrides.json`, the loader calls the WooCommerce REST API (`GET /wp-json/wc/v3/products/{id}`, Basic Auth from `.env`), parses the ACF rich-text fields with `cheerio`, looks up teacher bios in `src/data/teachers.json`, and merges everything into an object validated against the existing zod schema. No JSON files are checked in for course content — WooCommerce is the source of truth for structural/live fields (price, ACF lists, teacher credentials), and `courseOverrides.json` is the source of truth for curated editorial copy WooCommerce has no field for (URLs, page titles, schedule copy, images).

**Tech Stack:** Astro 5 Content Layer API, `cheerio` (HTML fragment parsing), native `fetch` (Node 25), `node --test` (unit tests, matches existing project convention).

## Global Constraints

- `output: 'static'` stays unchanged — no runtime revalidation, content updates only on rebuild (spec: Fuera de alcance).
- Build fails explicit (throws, stops the build) on: missing WooCommerce product for an ID in `courseOverrides.json`, non-2xx HTTP response from WooCommerce, or a teacher name parsed from ACF with no entry in `teachers.json`. No silent fallback to stale data (spec: Manejo de errores en build).
- WordPress/WooCommerce and its ACF fields are never modified by this work (spec: Fuera de alcance).
- `src/data/categoryGroups.json` is unchanged and stays the source of truth for group titles/descriptions (spec: Se mantiene sin cambios).
- Presentation components (`FactsBar`, `TeacherCard`, `IntroSection`, `PriceSection`, `IncludeSection`, `Accreditation`, `Testimonial`) are unchanged — only `ScheduleGrid.astro` changes, to drop the `availability` sub-field (spec: Se mantiene sin cambios).
- Images are never sourced from WooCommerce — 12 of 37 real products have zero images via the API, and local filenames don't derive cleanly from slug in 15 of 37 cases. Images stay 100% editorial, copied into `courseOverrides.json` from the current local JSON (spec Addendum 2026-07-26).
- Current site URLs (`/curso/{slug}/`) are preserved exactly — WooCommerce's native slug differs from the current URL in 27 of 37 products and is never used for routing (spec Addendum 2026-07-26).
- `.env` (`WOOCOMMERCE_URL`, `WOOCOMMERCE_CONSUMER_KEY`, `WOOCOMMERCE_CONSUMER_SECRET`) already exists and is gitignored — never print its values, never commit it.

---

## Task 1: WooCommerce API client

**Files:**
- Create: `src/lib/woocommerce/client.ts`
- Test: `src/lib/woocommerce/client.test.ts`

**Interfaces:**
- Produces: `fetchProduct(id: string): Promise<WooCommerceProduct>` — later tasks (transform, loader) call this. `WooCommerceProduct` type is exported from this file.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/woocommerce/client.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchProduct } from './client.ts';

test('fetchProduct throws with the HTTP status on a non-2xx response', async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response('{"code":"woocommerce_rest_product_invalid_id"}', { status: 404 });
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  await assert.rejects(() => fetchProduct('999999'), /HTTP 404/);
});

test('fetchProduct returns the parsed product on a 200 response', async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ id: 5571, name: 'Test' }), { status: 200 });
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const product = await fetchProduct('5571');
  assert.equal(product.id, 5571);
  assert.equal(product.name, 'Test');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/lib/woocommerce/client.test.ts`
Expected: FAIL — `Cannot find module './client.ts'` (or similar), since `client.ts` doesn't exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/woocommerce/client.ts
export interface WooCommerceProduct {
  id: number;
  name: string;
  regular_price: string;
  sale_price: string;
  on_sale: boolean;
  date_on_sale_to: string | null;
  acf: {
    horas: string;
    incluye: string;
    dirigido: string;
    formato: string;
    profesores: string[];
    objetivo: string;
  };
}

export async function fetchProduct(id: string): Promise<WooCommerceProduct> {
  const baseUrl = import.meta.env.WOOCOMMERCE_URL;
  const key = import.meta.env.WOOCOMMERCE_CONSUMER_KEY;
  const secret = import.meta.env.WOOCOMMERCE_CONSUMER_SECRET;
  const auth = Buffer.from(`${key}:${secret}`).toString('base64');

  const response = await fetch(`${baseUrl}/wp-json/wc/v3/products/${id}`, {
    headers: { Authorization: `Basic ${auth}` },
  });

  if (!response.ok) {
    throw new Error(`WooCommerce product ${id} fetch failed: HTTP ${response.status}`);
  }

  return response.json();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/lib/woocommerce/client.test.ts`
Expected: PASS (2 tests). Note: `import.meta.env` is `undefined` outside Vite, but the test replaces `globalThis.fetch` before those values are read, so this only matters once real requests are made (Task 8 wires this into the Astro-run loader, where `import.meta.env` is populated).

- [ ] **Step 5: Commit**

```bash
git add src/lib/woocommerce/client.ts src/lib/woocommerce/client.test.ts
git commit -m "feat: add WooCommerce REST API client"
```

---

## Task 2: ACF rich-text parsers

**Files:**
- Create: `src/lib/woocommerce/parseAcf.ts`
- Test: `src/lib/woocommerce/parseAcf.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `parseIncludes(html: string): string[]`, `parseRequirements(html: string): string[]`, `parseFormatoOptions(html: string): ScheduleOption[]` (`{ title: string; items: string[] }`), `parseProfesores(blocks: string[]): ParsedTeacher[]` (`{ name: string; credentials: string[] }`). Task 3 (transform) imports all four plus the two types.

These fixtures are the real `acf.incluye` / `acf.dirigido` / `acf.formato` / `acf.profesores` values from WooCommerce product 5571 (`masoterapia-deportiva`, mapped to the site's `diplomado-masoterapia-deportiva` course — see Task 6), fetched directly from the live API. `acf.formato` includes the exact structure that makes this parser non-trivial: a `<h2>` intro (must be ignored — only `<h4>` blocks matter) followed by three `<h4>`/`<ul>` pairs.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/woocommerce/parseAcf.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIncludes, parseRequirements, parseFormatoOptions, parseProfesores } from './parseAcf.ts';

const INCLUYE_HTML = `<ul>
<li>Acceso a aula virtual.</li>
<li>Material de estudio digital.</li>
<li>Certificado digital de aprobación.</li>
<li>Diploma Impreso.</li>
</ul>
`;

const DIRIGIDO_HTML = `<ul>\r\n<li>Masoterapeuta certificado.</li>\r\n<li>Kinesiólogo (a).</li>\r\n<li>Profesional de salud.</li>\r\n<li>Técnico deportivo, tecnólogo deportivo, preparador físico.</li>\r\n<li>Pedagogía en educación física. </li>\r\n<li>Para otros requisitos, consulta en admisión.</li>\r\n</ul>`;

const FORMATO_HTML = `<h2>Formato semi presencial con clases teóricas online asincrónicas y prácticas presenciales.</h2>
<p>El inicio de clases será el día Martes 11 de agosto 2026.</p>
<h4>Opción 1</h4>
<ul>
<li>Horario: Miércoles de 19:30 a 22:30 horas y Jueves de 10:30 a 13:30 horas.</li>
<li>Inicio prácticas presenciales: Miércoles 12 de agosto 2026</li>
<li>Finalización: Jueves 17 diciembre 2026</li>
<li>Clases 2 veces por semana</li>
<li>Inscripciones hasta el viernes 07 de agosto 2026</li>
<li>Observación: 150 horas totales distribuidas en: prácticas presenciales (108 horas), evaluaciones, actividades académicas y contenido grabado (42 horas)</li>
</ul>
<h4>Opción 2</h4>
<ul>
<li>Horario: Jueves de 10:30 a 13:30 horas y Sábados de 15:30 a 19:30 horas.</li>
<li>Inicio prácticas presenciales: Jueves 13 de agosto 2026</li>
<li>Finalización: Sábado 19 diciembre 2026</li>
<li>Clases 2 veces por semana</li>
<li>Inscripciones hasta el viernes 07 de agosto 2026</li>
<li>Observación: 150 horas totales distribuidas en: prácticas presenciales (108 horas), evaluaciones, actividades académicas y contenido grabado (42 horas)</li>
</ul>
<h4>Opción 3</h4>
<ul>
<li>Horario: Miércoles de 19:30 a 22:30 horas y Sábados de 15:30 a 19:30 horas.</li>
<li>Inicio prácticas presenciales: Miércoles 12 de agosto 2026</li>
<li>Finalización: Sábado 19 diciembre 2026</li>
<li>Clases 2 veces por semana</li>
<li>Inscripciones hasta el viernes 07 de agosto 2026</li>
<li>Observación: 150 horas totales distribuidas en: prácticas presenciales (108 horas), evaluaciones, actividades académicas y contenido grabado (42 horas)</li>
</ul>
`;

const PROFESORES_BLOCKS = [
  '<div><h4>Jorge Rojas</h4><ul><li>Licenciado en Kinesiología de la P.U.C.V.</li><li>Diplomado en pedagogía U mayor.</li><li>Certificado en masaje tailandés.</li></ul></div>',
  '<div><h4>Guillermo Leiva</h4><ul><li>Licenciado en Kinesiología UNAB.</li><li>Diplomado en masoterapia OTEC Cenakin.</li></ul></div>',
];

test('parseIncludes returns trimmed leaf list items in order', () => {
  assert.deepEqual(parseIncludes(INCLUYE_HTML), [
    'Acceso a aula virtual.',
    'Material de estudio digital.',
    'Certificado digital de aprobación.',
    'Diploma Impreso.',
  ]);
});

test('parseRequirements strips \\r\\n and trailing whitespace from each item', () => {
  assert.deepEqual(parseRequirements(DIRIGIDO_HTML), [
    'Masoterapeuta certificado.',
    'Kinesiólogo (a).',
    'Profesional de salud.',
    'Técnico deportivo, tecnólogo deportivo, preparador físico.',
    'Pedagogía en educación física.',
    'Para otros requisitos, consulta en admisión.',
  ]);
});

test('parseFormatoOptions ignores the leading h2/p and groups by h4', () => {
  const options = parseFormatoOptions(FORMATO_HTML);
  assert.equal(options.length, 3);
  assert.equal(options[0].title, 'Opción 1');
  assert.equal(options[1].title, 'Opción 2');
  assert.equal(options[2].title, 'Opción 3');
  assert.equal(options[0].items.length, 6);
  assert.equal(
    options[0].items[0],
    'Horario: Miércoles de 19:30 a 22:30 horas y Jueves de 10:30 a 13:30 horas.',
  );
  assert.equal(options[2].items[1], 'Inicio prácticas presenciales: Miércoles 12 de agosto 2026');
});

test('parseProfesores extracts name and credentials per teacher block', () => {
  const teachers = parseProfesores(PROFESORES_BLOCKS);
  assert.equal(teachers.length, 2);
  assert.equal(teachers[0].name, 'Jorge Rojas');
  assert.deepEqual(teachers[0].credentials, [
    'Licenciado en Kinesiología de la P.U.C.V.',
    'Diplomado en pedagogía U mayor.',
    'Certificado en masaje tailandés.',
  ]);
  assert.equal(teachers[1].name, 'Guillermo Leiva');
  assert.equal(teachers[1].credentials.length, 2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/lib/woocommerce/parseAcf.test.ts`
Expected: FAIL — `Cannot find module './parseAcf.ts'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/woocommerce/parseAcf.ts
import { load } from 'cheerio';

function cleanText(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

function leafListItems($: ReturnType<typeof load>, scope: string): string[] {
  return $(scope)
    .find('li')
    .filter((_, li) => $(li).find('ul, ol').length === 0)
    .map((_, li) => cleanText($(li).text()))
    .get()
    .filter((text) => text.length > 0);
}

export function parseIncludes(html: string): string[] {
  const $ = load(`<div>${html}</div>`);
  return leafListItems($, 'div');
}

export function parseRequirements(html: string): string[] {
  const $ = load(`<div>${html}</div>`);
  return leafListItems($, 'div');
}

export interface ScheduleOption {
  title: string;
  items: string[];
}

export function parseFormatoOptions(html: string): ScheduleOption[] {
  const $ = load(`<div>${html}</div>`);
  return $('h4')
    .map((_, h4) => {
      const title = cleanText($(h4).text());
      const ul = $(h4).nextAll('ul').first();
      const items = ul
        .find('li')
        .filter((_, li) => $(li).find('ul, ol').length === 0)
        .map((_, li) => cleanText($(li).text()))
        .get()
        .filter((text) => text.length > 0);
      return { title, items };
    })
    .get();
}

export interface ParsedTeacher {
  name: string;
  credentials: string[];
}

export function parseProfesores(blocks: string[]): ParsedTeacher[] {
  return blocks.map((block) => {
    const $ = load(block);
    const name = cleanText($('h4').first().text());
    const credentials = leafListItems($, 'body');
    return { name, credentials };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/lib/woocommerce/parseAcf.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/woocommerce/parseAcf.ts src/lib/woocommerce/parseAcf.test.ts
git commit -m "feat: add ACF rich-text parsers for WooCommerce course fields"
```

---

## Task 3: Formatting helpers (price + Spanish dates)

**Files:**
- Create: `src/lib/woocommerce/format.ts`
- Test: `src/lib/woocommerce/format.test.ts`

**Interfaces:**
- Produces: `formatCLP(rawPrice: string): string`, `formatSpanishDate(isoDateTime: string): string`. Task 4 (transform) imports both.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/woocommerce/format.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatCLP, formatSpanishDate } from './format.ts';

test('formatCLP adds thousands separators and a peso sign', () => {
  assert.equal(formatCLP('850000'), '$850.000');
  assert.equal(formatCLP('1200000'), '$1.200.000');
  assert.equal(formatCLP('60000'), '$60.000');
});

test('formatSpanishDate renders "D de mes de YYYY" without timezone drift', () => {
  assert.equal(formatSpanishDate('2026-07-31T23:59:59'), '31 de julio de 2026');
  assert.equal(formatSpanishDate('2026-08-10T00:00:00'), '10 de agosto de 2026');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/lib/woocommerce/format.test.ts`
Expected: FAIL — `Cannot find module './format.ts'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/woocommerce/format.ts
const MONTHS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export function formatCLP(rawPrice: string): string {
  const value = Number(rawPrice);
  return `$${value.toLocaleString('es-CL')}`;
}

export function formatSpanishDate(isoDateTime: string): string {
  const [year, month, day] = isoDateTime.slice(0, 10).split('-').map(Number);
  return `${day} de ${MONTHS_ES[month - 1]} de ${year}`;
}
```

Note: `formatSpanishDate` parses the date string with `.slice(0, 10).split('-')` instead of `new Date(...)` deliberately — WooCommerce's `date_on_sale_to` has no timezone offset (e.g. `2026-07-31T23:59:59`), and `Date` parsing of offset-less datetime strings is timezone-dependent (local time), which could shift the displayed day depending on the machine running the build.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/lib/woocommerce/format.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/woocommerce/format.ts src/lib/woocommerce/format.test.ts
git commit -m "feat: add CLP price and Spanish date formatting helpers"
```

---

## Task 4: `teachers.json` registry

**Files:**
- Create: `src/data/teachers.json`
- Test: `src/lib/woocommerce/teachers.test.ts`

**Interfaces:**
- Produces: the on-disk registry shape `Record<string, { photo: string; summary: string; tags: string[] }>`, keyed by the exact name text that appears in each `<h4>` of `acf.profesores`. Task 5 (transform) imports this JSON directly and looks up entries by parsed teacher name.

Real WooCommerce data across all 37 published courses contains exactly 6 distinct name strings for teaching staff, because WordPress's ACF content has 3 spelling variants for the same director académico:

```
Camila González        (2 courses)
Guillermo Leiva         (10 courses)
Jorge Patricio Rojas Sánchez  (5 courses)
Jorge Rojas             (28 courses)
Jorge Rojas S           (3 courses)
Tamara Bahamondes       (6 courses)
```

The last three keys are the same person (verified against course content — same credentials pattern, same role). Since WordPress content is out of scope for this migration, the registry has 3 separate keys pointing at identical data rather than trying to normalize names in code.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/woocommerce/teachers.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import teachers from '../data/teachers.json' with { type: 'json' };

const EXPECTED_NAMES = [
  'Camila González',
  'Guillermo Leiva',
  'Jorge Patricio Rojas Sánchez',
  'Jorge Rojas',
  'Jorge Rojas S',
  'Tamara Bahamondes',
];

test('teachers.json has an entry for every known ACF name variant', () => {
  for (const name of EXPECTED_NAMES) {
    assert.ok(name in teachers, `missing teacher entry: ${name}`);
    assert.ok(teachers[name].photo.startsWith('/images/'));
    assert.ok(teachers[name].summary.length > 0);
    assert.ok(teachers[name].tags.length > 0);
  }
});

test('the three Jorge Rojas name variants share the same photo (same person)', () => {
  assert.equal(teachers['Jorge Rojas'].photo, teachers['Jorge Rojas S'].photo);
  assert.equal(teachers['Jorge Rojas'].photo, teachers['Jorge Patricio Rojas Sánchez'].photo);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/lib/woocommerce/teachers.test.ts`
Expected: FAIL — `Cannot find module '../data/teachers.json'`.

- [ ] **Step 3: Write minimal implementation**

```json
// src/data/teachers.json
{
  "Jorge Patricio Rojas Sánchez": {
    "photo": "/images/docente-jorge.jpg",
    "summary": "Licenciado en Kinesiología por la Pontificia Universidad Católica de Valparaíso, ranking N.º 2 de su generación. Director académico y docente de OTEC Cenakin.",
    "tags": ["Kinesiólogo", "Director académico", "Masoterapia"]
  },
  "Jorge Rojas": {
    "photo": "/images/docente-jorge.jpg",
    "summary": "Licenciado en Kinesiología por la Pontificia Universidad Católica de Valparaíso, ranking N.º 2 de su generación. Director académico y docente de OTEC Cenakin.",
    "tags": ["Kinesiólogo", "Director académico", "Masoterapia"]
  },
  "Jorge Rojas S": {
    "photo": "/images/docente-jorge.jpg",
    "summary": "Licenciado en Kinesiología por la Pontificia Universidad Católica de Valparaíso, ranking N.º 2 de su generación. Director académico y docente de OTEC Cenakin.",
    "tags": ["Kinesiólogo", "Director académico", "Masoterapia"]
  },
  "Guillermo Leiva": {
    "photo": "/images/docente-guillermo.jpg",
    "summary": "Licenciado en Kinesiología por la Universidad Andrés Bello. Docente de OTEC Cenakin.",
    "tags": ["Kinesiólogo", "Masoterapeuta", "Punción seca y ventosas"]
  },
  "Tamara Bahamondes": {
    "photo": "/images/docente-tamara.jpg",
    "summary": "Licenciada en Nutrición por la Universidad de Valparaíso. Docente de OTEC Cenakin.",
    "tags": ["Nutricionista", "Estética corporal", "Drenaje linfático"]
  },
  "Camila González": {
    "photo": "/images/docente-camila.jpg",
    "summary": "Técnico en Educación Diferencial por el CFT Santo Tomás. Docente de OTEC Cenakin.",
    "tags": ["Educación diferencial", "Masoterapia integral", "Reflexología"]
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/lib/woocommerce/teachers.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/teachers.json src/lib/woocommerce/teachers.test.ts
git commit -m "feat: add teachers registry keyed by ACF name variants"
```

---

## Task 5: Course transform (WooCommerce product + override + teachers → schema shape)

**Files:**
- Create: `src/lib/woocommerce/transform.ts`
- Test: `src/lib/woocommerce/transform.test.ts`

**Interfaces:**
- Consumes: `WooCommerceProduct` (Task 1), `parseIncludes`/`parseRequirements`/`parseFormatoOptions`/`parseProfesores` (Task 2), `formatCLP`/`formatSpanishDate` (Task 3), teacher registry shape (Task 4).
- Produces: `transformProduct(product, wcId, override, teachers, groupTitle): CourseData` and the `CourseOverride` type. Task 8 (loader wiring) imports both.

`CourseOverride` is the full editorial-overrides shape, resolved from real WooCommerce inspection (see Addendum in `docs/superpowers/specs/2026-07-23-woocommerce-course-source-design.md`):

```ts
export interface CourseOverride {
  slug: string;
  groupId: string;
  modality: string;
  location: string;
  nextStart: string;
  diploma: boolean;
  title: string;
  introTitle: string;
  introLead: string;
  calloutText: string;
  scheduleEyebrow: string;
  scheduleTitle: string;
  scheduleBody: string;
  planEstudiosBody: string;
  duration: string;
  heroImage: string;
  listingImage: { src: string; srcset: string | null; sizes: string | null };
  reserveText?: string;
  pdfHref?: string;
  calloutLabel?: string;
  listingBadges?: string[];
}
```

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/woocommerce/transform.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transformProduct } from './transform.ts';
import type { WooCommerceProduct } from './client.ts';
import type { CourseOverride } from './transform.ts';

const PRODUCT: WooCommerceProduct = {
  id: 5571,
  name: 'Diplomado en masoterapia deportiva',
  regular_price: '950000',
  sale_price: '850000',
  on_sale: true,
  date_on_sale_to: '2026-07-31T23:59:59',
  acf: {
    horas: '150',
    incluye: '<ul><li>Acceso a aula virtual.</li><li>Material de estudio digital.</li></ul>',
    dirigido: '<ul><li>Masoterapeuta certificado.</li></ul>',
    formato: '<h4>Opción 1</h4><ul><li>Miércoles 19:30 a 22:30.</li></ul>',
    profesores: [
      '<div><h4>Jorge Rojas</h4><ul><li>Licenciado en Kinesiología.</li></ul></div>',
      '<div><h4>Guillermo Leiva</h4><ul><li>Licenciado en Kinesiología UNAB.</li></ul></div>',
    ],
    objetivo: 'Potenciar las habilidades profesionales de los alumnos y alumnas en masofilaxia y masoterapia.',
  },
};

const OVERRIDE: CourseOverride = {
  slug: 'diplomado-masoterapia-deportiva',
  groupId: 'especializaciones',
  modality: 'Semipresencial',
  location: 'Viña del Mar y aula virtual',
  nextStart: '11 de agosto de 2026',
  diploma: true,
  title: 'Diplomado en Masoterapia Deportiva',
  introTitle: 'Diplomado intensivo en masoterapia deportiva',
  introLead: 'Aprende a acompañar a deportistas con técnicas seguras.',
  calloutText: 'Teoría online, práctica presencial y acompañamiento durante todo el proceso.',
  scheduleEyebrow: 'ADMISIÓN 2026',
  scheduleTitle: 'Fechas y horarios',
  scheduleBody: 'Inscripciones hasta el viernes 7 de agosto de 2026.',
  planEstudiosBody: 'El aprendizaje combina contenido teórico asincrónico con jornadas prácticas.',
  duration: '150 horas | 5 meses',
  heroImage: '/images/diplomado-masoterapia-deportiva.webp',
  listingImage: {
    src: '/images/diplomado-masoterapia-deportiva-1200.webp',
    srcset: '/images/diplomado-masoterapia-deportiva-640.webp 640w',
    sizes: '(max-width: 700px) 100vw, (max-width: 1100px) 36vw, 230px',
  },
  reserveText: 'Reserva tu cupo para la admisión de agosto de 2026.',
};

const TEACHERS = {
  'Jorge Rojas': { photo: '/images/docente-jorge.jpg', summary: 'Kinesiólogo.', tags: ['Kinesiólogo'] },
  'Guillermo Leiva': { photo: '/images/docente-guillermo.jpg', summary: 'Kinesiólogo UNAB.', tags: ['Kinesiólogo'] },
};

test('transformProduct maps native, ACF, and override fields into the schema shape', () => {
  const data = transformProduct(PRODUCT, '5571', OVERRIDE, TEACHERS, 'Educación continua o especializaciones');

  assert.equal(data.slug, 'diplomado-masoterapia-deportiva');
  assert.equal(data.groupId, 'especializaciones');
  assert.equal(data.diploma, true);
  assert.equal(data.hero.title, 'Diplomado en Masoterapia Deportiva');
  assert.deepEqual(data.hero.badges, ['DIPLOMADO CERTIFICADO', 'SEMIPRESENCIAL']);
  assert.equal(data.hero.pdfHref, 'https://cenakin.cl/pdfs/5571.pdf');
  assert.equal(data.facts.duration, '150 horas | 5 meses');
  assert.equal(data.facts.modality, 'Semipresencial');
  assert.equal(data.intro.title, 'Diplomado intensivo en masoterapia deportiva');
  assert.equal(data.intro.body, PRODUCT.acf.objetivo);
  assert.equal(data.intro.calloutLabel, 'FORMACIÓN FLEXIBLE');
  assert.deepEqual(data.listing.badges, ['♙ Curso certificado', '◷ 150 horas', '◉ Semipresencial']);
  assert.equal(data.listing.longTitle, false);
  assert.equal(data.schedule[0].eyebrow, 'ADMISIÓN 2026');
  assert.equal(data.schedule[0].options[0].title, 'Opción 1');
  assert.equal(data.schedule[1].title, 'Plan de estudios');
  assert.equal(data.schedule[1].body, OVERRIDE.planEstudiosBody);
  assert.equal(data.teachers.length, 2);
  assert.equal(data.teachers[0].name, 'Jorge Rojas');
  assert.deepEqual(data.teachers[0].credentials, ['Licenciado en Kinesiología.']);
  assert.deepEqual(data.includes, ['Acceso a aula virtual.', 'Material de estudio digital.']);
  assert.deepEqual(data.requirements, ['Masoterapeuta certificado.']);
  assert.equal(data.price.label, 'DESCUENTO VIGENTE');
  assert.equal(data.price.original, '$950.000');
  assert.equal(data.price.current, '$850.000');
  assert.equal(data.price.discountText, 'Válido hasta el 31 de julio de 2026');
  assert.equal(data.price.reserveText, 'Reserva tu cupo para la admisión de agosto de 2026.');
});

test('transformProduct throws when a parsed teacher name has no registry entry', () => {
  const productWithUnknownTeacher = {
    ...PRODUCT,
    acf: {
      ...PRODUCT.acf,
      profesores: ['<div><h4>Nombre Desconocido</h4><ul><li>Algo.</li></ul></div>'],
    },
  };
  assert.throws(
    () => transformProduct(productWithUnknownTeacher, '5571', OVERRIDE, TEACHERS, 'grupo'),
    /Nombre Desconocido/,
  );
});

test('transformProduct falls back to formula defaults when optional overrides are absent', () => {
  const { reserveText, calloutLabel, listingBadges, pdfHref, ...overrideWithoutOptionals } = OVERRIDE;
  const data = transformProduct(PRODUCT, '5571', { ...overrideWithoutOptionals, diploma: false }, TEACHERS, 'grupo');
  assert.equal(data.price.reserveText, 'Reserva tu cupo para Diplomado en Masoterapia Deportiva.');
  assert.equal(data.intro.calloutLabel, 'FORMACIÓN PRÁCTICA');
  assert.deepEqual(data.listing.badges, ['♙ Curso certificado', '◷ 150 horas', '◉ Semipresencial']);
  assert.equal(data.hero.pdfHref, 'https://cenakin.cl/pdfs/5571.pdf');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/lib/woocommerce/transform.test.ts`
Expected: FAIL — `Cannot find module './transform.ts'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/woocommerce/transform.ts
import { parseIncludes, parseRequirements, parseFormatoOptions, parseProfesores } from './parseAcf.ts';
import { formatCLP, formatSpanishDate } from './format.ts';
import type { WooCommerceProduct } from './client.ts';

export interface CourseOverride {
  slug: string;
  groupId: string;
  modality: string;
  location: string;
  nextStart: string;
  diploma: boolean;
  title: string;
  introTitle: string;
  introLead: string;
  calloutText: string;
  scheduleEyebrow: string;
  scheduleTitle: string;
  scheduleBody: string;
  planEstudiosBody: string;
  duration: string;
  heroImage: string;
  listingImage: { src: string; srcset: string | null; sizes: string | null };
  reserveText?: string;
  pdfHref?: string;
  calloutLabel?: string;
  listingBadges?: string[];
}

export interface TeacherRegistryEntry {
  photo: string;
  summary: string;
  tags: string[];
}

export type TeacherRegistry = Record<string, TeacherRegistryEntry>;

export function transformProduct(
  product: WooCommerceProduct,
  wcId: string,
  override: CourseOverride,
  teachers: TeacherRegistry,
  groupTitle: string,
) {
  const modality = override.modality;
  const onSale = product.on_sale;

  const teachersData = parseProfesores(product.acf.profesores).map(({ name, credentials }) => {
    const registryEntry = teachers[name];
    if (!registryEntry) {
      throw new Error(`teachers.json missing entry for "${name}" (WooCommerce product ${wcId})`);
    }
    return {
      name,
      photo: registryEntry.photo,
      summary: registryEntry.summary,
      credentials,
      tags: registryEntry.tags,
    };
  });

  const pdfHref = override.pdfHref ?? `https://cenakin.cl/pdfs/${wcId}.pdf`;
  const reserveText = override.reserveText ?? `Reserva tu cupo para ${override.title}.`;
  const calloutLabel =
    override.calloutLabel ?? (override.diploma ? 'FORMACIÓN FLEXIBLE' : 'FORMACIÓN PRÁCTICA');
  const listingBadges = override.listingBadges ?? [
    '♙ Curso certificado',
    `◷ ${product.acf.horas} horas`,
    `◉ ${modality}`,
  ];

  const priceRaw = onSale ? product.sale_price : product.regular_price;
  const discountText =
    onSale && product.date_on_sale_to
      ? `${override.diploma ? 'Válido' : 'Descuento válido'} hasta el ${formatSpanishDate(product.date_on_sale_to)}`
      : null;

  return {
    slug: override.slug,
    groupId: override.groupId,
    diploma: override.diploma,
    listing: {
      image: override.listingImage,
      badges: listingBadges,
      modality,
      longTitle: override.title.length > 70,
    },
    hero: {
      image: override.heroImage,
      breadcrumbLabel: groupTitle,
      badges: [override.diploma ? 'DIPLOMADO CERTIFICADO' : 'CURSO CERTIFICADO', modality.toUpperCase()],
      title: override.title,
      subtitle: override.introLead,
      pdfHref,
    },
    facts: {
      duration: override.duration,
      modality,
      location: override.location,
      nextStart: override.nextStart,
    },
    intro: {
      eyebrow: 'SOBRE ESTA FORMACIÓN',
      title: override.introTitle,
      lead: override.introLead,
      body: product.acf.objetivo,
      calloutLabel,
      calloutText: override.calloutText,
    },
    schedule: [
      {
        eyebrow: override.scheduleEyebrow,
        title: override.scheduleTitle,
        body: override.scheduleBody,
        options: parseFormatoOptions(product.acf.formato),
      },
      {
        eyebrow: 'CONTENIDOS',
        title: 'Plan de estudios',
        body: override.planEstudiosBody,
        options: [],
      },
    ],
    teachers: teachersData,
    includes: parseIncludes(product.acf.incluye),
    requirements: parseRequirements(product.acf.dirigido),
    price: {
      label: onSale ? 'DESCUENTO VIGENTE' : 'ARANCEL TOTAL',
      original: onSale ? formatCLP(product.regular_price) : null,
      current: formatCLP(priceRaw),
      discountText,
      reserveText,
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/lib/woocommerce/transform.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/woocommerce/transform.ts src/lib/woocommerce/transform.test.ts
git commit -m "feat: add course transform combining WooCommerce, ACF, and overrides"
```

---

## Task 6: Generate `courseOverrides.json` from the current local data

**Files:**
- Create: `scripts/generate-overrides.mjs`
- Test: `scripts/generate-overrides.test.mjs`
- Create (generated, then committed): `src/data/courseOverrides.json`

**Interfaces:**
- Consumes: the 37 existing files in `src/content/curso/*.json` (still present at this point in the plan — Task 9 deletes them).
- Produces: `src/data/courseOverrides.json`, a `Record<string, CourseOverride>` keyed by WooCommerce product ID (string), matching the `CourseOverride` shape from Task 5.

This is a **one-time migration script**, run once in this task and deleted in Task 9 alongside `extract-courses.mjs` — it is not part of the runtime build.

The WooCommerce product ID for each course was resolved by extracting the numeric ID already embedded in each course's current `hero.pdfHref` (`https://cenakin.cl/pdfs/{id}.pdf`) and cross-checking the product name in a live WooCommerce fetch. Three courses don't follow that URL pattern (`marketing-digital`, `masaje-relajante-descontracturante`, `rotulacion-etiquetado-nutricional`) and were resolved by exact slug/URL match instead — those three IDs are hardcoded below.

- [ ] **Step 1: Write the failing test**

```js
// scripts/generate-overrides.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildOverrides } from './generate-overrides.mjs';

const SAMPLE_COURSE = {
  slug: 'diplomado-masoterapia-deportiva',
  groupId: 'especializaciones',
  diploma: true,
  listing: {
    image: {
      src: '/images/diplomado-masoterapia-deportiva-1200.webp',
      srcset: '/images/diplomado-masoterapia-deportiva-640.webp 640w',
      sizes: '(max-width: 700px) 100vw, (max-width: 1100px) 36vw, 230px',
    },
    badges: ['♙ Curso certificado', '◷ 150 horas', '◉ Semipresencial'],
    modality: 'Semipresencial',
    longTitle: false,
  },
  hero: {
    image: '/images/diplomado-masoterapia-deportiva.webp',
    breadcrumbLabel: 'Educación continua o especializaciones',
    badges: ['DIPLOMADO CERTIFICADO', 'SEMIPRESENCIAL'],
    title: 'Diplomado en Masoterapia Deportiva',
    subtitle: 'Especialízate en técnicas de masaje orientadas al bienestar y la recuperación deportiva.',
    pdfHref: 'https://cenakin.cl/pdfs/5571.pdf',
  },
  facts: {
    duration: '150 horas | 5 meses',
    modality: 'Semipresencial',
    location: 'Viña del Mar y aula virtual',
    nextStart: '11 de agosto de 2026',
  },
  intro: {
    eyebrow: 'SOBRE ESTA FORMACIÓN',
    title: 'Diplomado intensivo en masoterapia deportiva',
    lead: 'Aprende a acompañar a deportistas con técnicas seguras y una comprensión funcional del movimiento.',
    body: 'Formación especializada en masaje recovery...',
    calloutLabel: 'FORMACIÓN FLEXIBLE',
    calloutText: 'Teoría online, práctica presencial y acompañamiento durante todo el proceso.',
  },
  schedule: [
    {
      eyebrow: 'ADMISIÓN 2026',
      title: 'Fechas y horarios',
      body: 'Inscripciones hasta el viernes 7 de agosto de 2026.',
      options: [],
    },
    {
      eyebrow: 'CONTENIDOS',
      title: 'Plan de estudios',
      body: 'El aprendizaje combina contenido teórico asincrónico en aula virtual con jornadas prácticas presenciales. Para aprobar debes completar las actividades y evaluaciones programadas.',
      options: [],
    },
  ],
  teachers: [],
  includes: [],
  requirements: [],
  price: {
    label: 'DESCUENTO VIGENTE',
    original: '$950.000',
    current: '$850.000 CLP',
    discountText: 'Válido hasta el 31 de julio de 2026',
    reserveText: 'Reserva tu cupo para la admisión de agosto de 2026.',
  },
};

test('buildOverrides derives the WC id from pdfHref and copies curated fields', () => {
  const overrides = buildOverrides([SAMPLE_COURSE]);
  const entry = overrides['5571'];
  assert.ok(entry, 'expected an entry keyed by WC id 5571');
  assert.equal(entry.slug, 'diplomado-masoterapia-deportiva');
  assert.equal(entry.title, 'Diplomado en Masoterapia Deportiva');
  assert.equal(entry.introTitle, 'Diplomado intensivo en masoterapia deportiva');
  assert.equal(entry.duration, '150 horas | 5 meses');
  assert.equal(entry.heroImage, '/images/diplomado-masoterapia-deportiva.webp');
  assert.deepEqual(entry.listingImage, SAMPLE_COURSE.listing.image);
});

test('buildOverrides only sets reserveText override when it differs from the template', () => {
  const overrides = buildOverrides([SAMPLE_COURSE]);
  assert.equal(overrides['5571'].reserveText, 'Reserva tu cupo para la admisión de agosto de 2026.');

  const templatedCourse = {
    ...SAMPLE_COURSE,
    price: { ...SAMPLE_COURSE.price, reserveText: 'Reserva tu cupo para Diplomado en Masoterapia Deportiva.' },
  };
  const overridesWithTemplate = buildOverrides([templatedCourse]);
  assert.equal(overridesWithTemplate['5571'].reserveText, undefined);
});

test('buildOverrides falls back to the manual ID map when pdfHref has no numeric id', () => {
  const nonStandardCourse = {
    ...SAMPLE_COURSE,
    slug: 'marketing-digital',
    hero: { ...SAMPLE_COURSE.hero, pdfHref: 'https://cenakin.cl/cursos/diplomado-marketing-digital/' },
  };
  const overrides = buildOverrides([nonStandardCourse]);
  assert.ok(overrides['3276']);
  assert.equal(overrides['3276'].pdfHref, 'https://cenakin.cl/cursos/diplomado-marketing-digital/');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/generate-overrides.test.mjs`
Expected: FAIL — `Cannot find module './generate-overrides.mjs'`.

- [ ] **Step 3: Write minimal implementation**

```js
// scripts/generate-overrides.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CURSO_DIR = path.join(__dirname, '..', 'src', 'content', 'curso');
const OUTPUT_PATH = path.join(__dirname, '..', 'src', 'data', 'courseOverrides.json');

// The 3 courses whose current hero.pdfHref isn't a /pdfs/{id}.pdf link, resolved
// by exact slug/URL match against a live WooCommerce products list fetch.
const MANUAL_WC_IDS = {
  'marketing-digital': 3276,
  'masaje-relajante-descontracturante': 4148,
  'rotulacion-etiquetado-nutricional': 5795,
};

function resolveWcId(course) {
  const match = (course.hero.pdfHref || '').match(/\/pdfs\/(\d+)\.pdf/);
  if (match) return Number(match[1]);
  const manual = MANUAL_WC_IDS[course.slug];
  if (!manual) throw new Error(`No WooCommerce id resolvable for slug "${course.slug}"`);
  return manual;
}

export function buildOverrides(courses) {
  const overrides = {};

  for (const course of courses) {
    const wcId = resolveWcId(course);
    const entry = {
      slug: course.slug,
      groupId: course.groupId,
      modality: course.facts.modality,
      location: course.facts.location,
      nextStart: course.facts.nextStart,
      diploma: course.diploma,
      title: course.hero.title,
      introTitle: course.intro.title,
      introLead: course.intro.lead,
      calloutText: course.intro.calloutText,
      scheduleEyebrow: course.schedule[0].eyebrow,
      scheduleTitle: course.schedule[0].title,
      scheduleBody: course.schedule[0].body,
      planEstudiosBody: course.schedule[1]?.body ?? '',
      duration: course.facts.duration,
      heroImage: course.hero.image,
      listingImage: course.listing.image,
    };

    const defaultReserve = `Reserva tu cupo para ${course.hero.title}.`;
    if (course.price.reserveText !== defaultReserve) {
      entry.reserveText = course.price.reserveText;
    }

    const standardPdf = `https://cenakin.cl/pdfs/${wcId}.pdf`;
    if (course.hero.pdfHref !== standardPdf) {
      entry.pdfHref = course.hero.pdfHref;
    }

    const defaultCallout = course.diploma ? 'FORMACIÓN FLEXIBLE' : 'FORMACIÓN PRÁCTICA';
    if (course.intro.calloutLabel !== defaultCallout) {
      entry.calloutLabel = course.intro.calloutLabel;
    }

    const horasGuess = course.facts.duration.split(' ')[0];
    const defaultBadges = ['♙ Curso certificado', `◷ ${horasGuess} horas`, `◉ ${course.facts.modality}`];
    if (JSON.stringify(course.listing.badges) !== JSON.stringify(defaultBadges)) {
      entry.listingBadges = course.listing.badges;
    }

    overrides[String(wcId)] = entry;
  }

  return overrides;
}

function main() {
  const files = readdirSync(CURSO_DIR).filter((name) => name.endsWith('.json'));
  const courses = files.map((name) => JSON.parse(readFileSync(path.join(CURSO_DIR, name), 'utf-8')));
  const overrides = buildOverrides(courses);
  const sortedKeys = Object.keys(overrides).sort((a, b) => Number(a) - Number(b));
  const sorted = Object.fromEntries(sortedKeys.map((key) => [key, overrides[key]]));
  writeFileSync(OUTPUT_PATH, JSON.stringify(sorted, null, 2) + '\n');
  console.log(`Wrote ${sortedKeys.length} entries to ${OUTPUT_PATH}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/generate-overrides.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the script against the real 37 local course files and commit the output**

```bash
node scripts/generate-overrides.mjs
```

Expected output: `Wrote 37 entries to .../src/data/courseOverrides.json`.

Verify the entry count and spot-check one entry:

```bash
node -e "const o = JSON.parse(require('fs').readFileSync('src/data/courseOverrides.json')); console.log(Object.keys(o).length); console.log(o['5571'].slug, o['5571'].title)"
```

Expected: `37` then `diplomado-masoterapia-deportiva Diplomado en Masoterapia Deportiva`.

- [ ] **Step 6: Commit**

```bash
git add scripts/generate-overrides.mjs scripts/generate-overrides.test.mjs src/data/courseOverrides.json
git commit -m "feat: generate courseOverrides.json from current local course data"
```

---

## Task 7: Wire the custom loader into the content collection

**Files:**
- Modify: `src/content/config.ts`

**Interfaces:**
- Consumes: `fetchProduct` (Task 1), `transformProduct`, `CourseOverride` (Task 5), `src/data/courseOverrides.json` (Task 6), `src/data/teachers.json` (Task 4), `src/data/categoryGroups.json` (unchanged).
- Produces: the `curso` collection, consumed unchanged by `src/pages/categorias/index.astro`, `src/pages/curso/[slug].astro`, and `src/components/CourseCard.astro` (all three already read `course.data.*`, not `course.id`, so no changes needed there).

This also removes the `availability` sub-field from `schedule[].options[]` in the zod schema — WooCommerce/ACF has no source for it (Task 8 updates `ScheduleGrid.astro` to match).

- [ ] **Step 1: Modify `src/content/config.ts`**

```ts
import { defineCollection, z } from 'astro:content';
import overridesJson from '../data/courseOverrides.json';
import teachersJson from '../data/teachers.json';
import categoryGroups from '../data/categoryGroups.json';
import { fetchProduct } from '../lib/woocommerce/client.ts';
import { transformProduct } from '../lib/woocommerce/transform.ts';
import type { CourseOverride } from '../lib/woocommerce/transform.ts';

const overrides = overridesJson as Record<string, CourseOverride>;
const groupTitleById = Object.fromEntries(categoryGroups.map((group) => [group.id, group.title]));

const curso = defineCollection({
  loader: async () => {
    const entries = await Promise.all(
      Object.entries(overrides).map(async ([wcId, override]) => {
        const product = await fetchProduct(wcId);
        const groupTitle = groupTitleById[override.groupId];
        if (!groupTitle) {
          throw new Error(`courseOverrides.json entry ${wcId} has unknown groupId "${override.groupId}"`);
        }
        const data = transformProduct(product, wcId, override, teachersJson, groupTitle);
        return { id: wcId, ...data };
      }),
    );
    return entries;
  },
  schema: z.object({
    slug: z.string(),
    groupId: z.string(),
    diploma: z.boolean(),
    listing: z.object({
      image: z.object({
        src: z.string(),
        srcset: z.string().nullable(),
        sizes: z.string().nullable(),
      }),
      badges: z.array(z.string()),
      modality: z.string(),
      longTitle: z.boolean(),
    }),
    hero: z.object({
      image: z.string(),
      breadcrumbLabel: z.string(),
      badges: z.array(z.string()),
      title: z.string(),
      subtitle: z.string(),
      pdfHref: z.string().nullable(),
    }),
    facts: z.object({
      duration: z.string(),
      modality: z.string(),
      location: z.string(),
      nextStart: z.string(),
    }),
    intro: z.object({
      eyebrow: z.string(),
      title: z.string(),
      lead: z.string(),
      body: z.string(),
      calloutLabel: z.string(),
      calloutText: z.string(),
    }),
    schedule: z.array(
      z.object({
        eyebrow: z.string(),
        title: z.string(),
        body: z.string(),
        options: z.array(
          z.object({
            title: z.string(),
            items: z.array(z.string()),
          }),
        ),
      }),
    ),
    teachers: z.array(
      z.object({
        name: z.string(),
        photo: z.string(),
        summary: z.string(),
        credentials: z.array(z.string()),
        tags: z.array(z.string()),
      }),
    ),
    includes: z.array(z.string()),
    requirements: z.array(z.string()),
    price: z.object({
      label: z.string(),
      original: z.string().nullable(),
      current: z.string(),
      discountText: z.string().nullable(),
      reserveText: z.string(),
    }),
  }),
});

export const collections = { curso };
```

- [ ] **Step 2: Verify types**

Run: `npx astro check`
Expected: 0 errors. (This step doesn't hit the network — `astro check` type-checks without running the loader.)

- [ ] **Step 3: Commit**

```bash
git add src/content/config.ts
git commit -m "feat: load curso collection from WooCommerce via custom Content Layer loader"
```

---

## Task 8: Drop `availability` from `ScheduleGrid.astro`

**Files:**
- Modify: `src/components/course/ScheduleGrid.astro`

**Interfaces:**
- Consumes: the `schedule` shape produced by Task 7's schema (no `availability` field).

- [ ] **Step 1: Update the component**

```astro
---
interface Props {
  schedule: Array<{
    eyebrow: string;
    title: string;
    body: string;
    options: Array<{ title: string; items: string[] }>;
  }>;
}
const { schedule } = Astro.props;
---
{schedule.map((block) => (
  <section class="detail-section">
    <p class="eyebrow">{block.eyebrow}</p>
    <h2>{block.title}</h2>
    <p>{block.body}</p>
    <div class="schedule-grid">
      {block.options.map((option) => (
        <article>
          <h3>{option.title}</h3>
          <ul>
            {option.items.map((item) => <li>{item}</li>)}
          </ul>
        </article>
      ))}
    </div>
  </section>
))}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/course/ScheduleGrid.astro
git commit -m "refactor: drop availability badge from ScheduleGrid (no WooCommerce source)"
```

---

## Task 9: Clean up — delete the old static pipeline

**Files:**
- Delete: `src/content/curso/*.json` (37 files)
- Delete: `scripts/extract-courses.mjs`, `scripts/extract-courses.test.mjs`
- Delete: `scripts/generate-overrides.mjs`, `scripts/generate-overrides.test.mjs` (one-time migration script from Task 6 — its output, `src/data/courseOverrides.json`, is already committed)
- Modify: `package.json`

**Interfaces:** none — this is pure deletion once Task 6's output is committed and Task 7's loader no longer reads the old files.

- [ ] **Step 1: Delete the old course JSON files and scripts**

```bash
rm src/content/curso/*.json
rm scripts/extract-courses.mjs scripts/extract-courses.test.mjs
rm scripts/generate-overrides.mjs scripts/generate-overrides.test.mjs
```

- [ ] **Step 2: Update `package.json`**

Move `cheerio` from `devDependencies` to `dependencies` (it now runs at build time via the content loader, not just in a one-off dev script), and drop the `extract:courses` script.

Also fix a pre-existing bug found while writing this plan: `node --test scripts/` (the current `test` script, on this project's Node 25) doesn't glob the directory — Node's test runner treats an explicit directory argument as a single module path to `require`, which fails with `MODULE_NOT_FOUND`. Verified: `node --test scripts/` fails on the current codebase today, before any change in this plan. The bare form `node --test` (no path arguments) auto-discovers `**/*.test.*` recursively from the cwd and does work — verified against both `scripts/extract-courses.test.mjs` and a nested fixture. Use the bare form so it picks up `scripts/*.test.mjs` and every `src/lib/woocommerce/*.test.ts` this plan adds:

```json
{
  "name": "cenakin-astro",
  "type": "module",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "test": "node --test"
  },
  "dependencies": {
    "astro": "^5.0.0",
    "cheerio": "^1.0.0"
  },
  "devDependencies": {
    "@astrojs/check": "^0.9.9",
    "typescript": "^5.9.3"
  }
}
```

- [ ] **Step 3: Reinstall to confirm the lockfile is consistent**

Run: `npm install`
Expected: exits 0, `package-lock.json` updates the `cheerio`/`astro` dependency graph section only.

- [ ] **Step 4: Run the full unit test suite**

Run: `npm test`
Expected: all `src/lib/woocommerce/*.test.ts` tests PASS (the `scripts/` directory now only contains non-test files, so `node --test` finds nothing there — that's expected, not a failure).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove static course JSON pipeline, cheerio is now a runtime dependency"
```

---

## Task 10: End-to-end build verification

**Files:** none (verification only).

- [ ] **Step 1: Run a real build against live WooCommerce**

Run: `npm run build`
Expected: build succeeds, output lists 39 pages total (1 home + 1 categorías + 37 course pages), matching the current site's page count. If any product/teacher/groupId is missing, the build fails with the explicit error message from Task 5/7 naming the exact ID or teacher name — fix the corresponding `courseOverrides.json` entry or `teachers.json` key and re-run.

- [ ] **Step 2: Spot-check generated HTML for live-data correctness**

```bash
grep -o '"price":{[^}]*}' dist/curso/diplomado-masoterapia-deportiva/index.html | head -1
```

Confirm the price reflects the *current* WooCommerce sale state (not the stale `$850.000` from the old local JSON, if the live promo has since changed) — this is expected behavior, not a bug.

- [ ] **Step 3: Confirm the categorías page filters (from the earlier session's work) still function**

```bash
grep -c 'data-modality=' dist/categorias/index.html
```

Expected: 37 (one per course), confirming `CourseCard.astro`'s `data-modality` attribute — which reads `listing.modality` — still populates correctly from the new loader-backed collection.

- [ ] **Step 4: No commit** — this task only verifies Tasks 1–9; nothing to add.

---

## Execution Handoff

Two execution options:

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.
