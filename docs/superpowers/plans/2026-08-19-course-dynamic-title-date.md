# Cursos: título, fecha de inicio y duración dinámicos desde WooCommerce — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer que `hero.title`/`intro.title`, `facts.nextStart` y `facts.duration` de cada página de curso salgan de WooCommerce (`product.name`, `acf.fecha_inicio`, `acf.horas`) en vez de texto fijo en `courseOverrides.json`, y migrar los datos existentes de las 38 entradas para que dejen de duplicar lo que ya vive en WordPress.

**Architecture:** `src/content/config.ts` ya llama a `fetchProduct()` y `transformProduct()` en cada `astro dev`/`astro build` (ver `src/lib/woocommerce/client.ts` y `src/lib/woocommerce/transform.ts`). Se cambia `transformProduct()` para que calcule `title`/`nextStart`/`duration` a partir del `product` de WooCommerce, cayendo a `courseOverrides.json` solo cuando WordPress no tiene el dato. Una nueva función `parseAcfDate()` en `src/lib/woocommerce/format.ts` convierte el formato de fecha de ACF al formato del sitio. Un script de un solo uso limpia `courseOverrides.json` para que ya no tenga los campos que ahora se derivan.

**Tech Stack:** Astro 5 (content collections/loaders), TypeScript con type-stripping nativo de Node 25 (sin paso de build para los tests/scripts), `node --test` como test runner, WooCommerce REST API v3.

## Global Constraints

- El build debe fallar explícito (nunca silencioso) si un curso no tiene ni override ni dato de WooCommerce para `nextStart` o `duration` — mismo patrón que el error ya existente para `groupId` desconocido en `src/content/config.ts:19`.
- No se toca WordPress ni sus campos ACF.
- No se toca el copy editorial (`introTitle`, `calloutText`, `scheduleEyebrow`, `scheduleTitle`, `scheduleBody`, `planEstudiosBody`, `reserveText`, `calloutLabel`, `introLead`) — sigue siendo manual en `courseOverrides.json`.
- No se agregan `promociones`/`medios_pago`/`descripcion_valor` a la página del curso — fuera de alcance.
- Spec completo en `docs/superpowers/specs/2026-08-19-course-dynamic-title-date-design.md`.

---

### Task 1: `parseAcfDate` en `format.ts`

**Files:**
- Modify: `src/lib/woocommerce/format.ts`
- Test: `src/lib/woocommerce/format.test.ts`

**Interfaces:**
- Produces: `parseAcfDate(raw: string): string` — convierte `"marzo 8, 2027"` (nombre de mes en español, día, año — formato que devuelve el date picker de ACF) a `"8 de marzo de 2027"`. Lanza `Error` si el formato no matchea o el nombre de mes no es reconocido. Usado por Task 2.

- [ ] **Step 1: Escribir los tests que van a fallar**

Reemplazar el contenido completo de `src/lib/woocommerce/format.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatCLP, formatSpanishDate, parseAcfDate } from './format.ts';

test('formatCLP adds thousands separators and a peso sign', () => {
  assert.equal(formatCLP('850000'), '$850.000');
  assert.equal(formatCLP('1200000'), '$1.200.000');
  assert.equal(formatCLP('60000'), '$60.000');
});

test('formatSpanishDate renders "D de mes de YYYY" without timezone drift', () => {
  assert.equal(formatSpanishDate('2026-07-31T23:59:59'), '31 de julio de 2026');
  assert.equal(formatSpanishDate('2026-08-10T00:00:00'), '10 de agosto de 2026');
});

test('parseAcfDate converts the ACF date-picker format to "D de mes de YYYY"', () => {
  assert.equal(parseAcfDate('marzo 8, 2027'), '8 de marzo de 2027');
  assert.equal(parseAcfDate('agosto 3, 2026'), '3 de agosto de 2026');
  assert.equal(parseAcfDate('octubre 13, 2026'), '13 de octubre de 2026');
});

test('parseAcfDate is case-insensitive on the month name', () => {
  assert.equal(parseAcfDate('Marzo 8, 2027'), '8 de marzo de 2027');
});

test('parseAcfDate throws on an unexpected format', () => {
  assert.throws(() => parseAcfDate('8 de marzo de 2027'), /unexpected ACF date format/);
});

test('parseAcfDate throws on an unknown month name', () => {
  assert.throws(() => parseAcfDate('marzoo 8, 2027'), /unknown Spanish month/);
});
```

- [ ] **Step 2: Correr los tests y confirmar que fallan**

Run: `npm test -- src/lib/woocommerce/format.test.ts`
Expected: FAIL — `parseAcfDate` no existe todavía (`SyntaxError` o `TypeError: parseAcfDate is not a function`, según cómo Node resuelva el import faltante).

- [ ] **Step 3: Implementar `parseAcfDate`**

Reemplazar el contenido completo de `src/lib/woocommerce/format.ts`:

```ts
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

const ACF_DATE_PATTERN = /^([a-z]+)\s+(\d{1,2}),\s+(\d{4})$/i;

export function parseAcfDate(raw: string): string {
  const match = raw.match(ACF_DATE_PATTERN);
  if (!match) {
    throw new Error(`parseAcfDate: unexpected ACF date format "${raw}"`);
  }
  const [, monthName, day, year] = match;
  const monthIndex = MONTHS_ES.indexOf(monthName.toLowerCase());
  if (monthIndex === -1) {
    throw new Error(`parseAcfDate: unknown Spanish month "${monthName}" in "${raw}"`);
  }
  return `${Number(day)} de ${MONTHS_ES[monthIndex]} de ${year}`;
}
```

- [ ] **Step 4: Correr los tests y confirmar que pasan**

Run: `npm test -- src/lib/woocommerce/format.test.ts`
Expected: `ℹ tests 7`, `ℹ pass 7`, `ℹ fail 0`

- [ ] **Step 5: Commit**

```bash
git add src/lib/woocommerce/format.ts src/lib/woocommerce/format.test.ts
git commit -m "$(cat <<'EOF'
feat: add parseAcfDate to convert ACF date-picker format to site format

Needed to derive facts.nextStart from acf.fecha_inicio instead of a
hardcoded courseOverrides.json string.
EOF
)"
```

---

### Task 2: `title`/`nextStart`/`duration` dinámicos en `transformProduct`

**Files:**
- Modify: `src/lib/woocommerce/client.ts`
- Modify: `src/lib/woocommerce/transform.ts`
- Test: `src/lib/woocommerce/transform.test.ts`

**Interfaces:**
- Consumes: `parseAcfDate(raw: string): string` de Task 1.
- Produces: `CourseOverride` (interfaz) sin campo `title`, con `nextStart?: string` y `duration?: string` opcionales. `transformProduct()` mantiene la misma firma y forma de retorno; usado por `src/content/config.ts` (sin cambios ahí). Consumido por Task 3 (el script de migración solo necesita saber qué claves puede borrar, no importa `transformProduct` directamente).

- [ ] **Step 1: Escribir los tests que van a fallar**

Reemplazar el contenido completo de `src/lib/woocommerce/transform.test.ts`:

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
  slug: 'masoterapia-deportiva',
  short_description: '<p>Diplomado enfocado en técnicas de masoterapia deportiva aplicadas.</p>',
  regular_price: '950000',
  sale_price: '850000',
  on_sale: true,
  date_on_sale_to: '2026-07-31T23:59:59',
  acf: {
    horas: '150',
    fecha_inicio: 'agosto 11, 2026',
    incluye: '<ul><li>Acceso a aula virtual.</li><li>Material de estudio digital.</li></ul>',
    dirigido: '<ul><li>Masoterapeuta certificado.</li></ul>',
    formato: '<h4>Opción 1</h4><ul><li>Miércoles 19:30 a 22:30.</li></ul>',
    profesores: [
      '<div><h4>Jorge Rojas</h4><ul><li>Licenciado en Kinesiología.</li></ul></div>',
      '<div><h4>Guillermo Leiva</h4><ul><li>Licenciado en Kinesiología UNAB.</li></ul></div>',
    ],
    objetivo: 'Potenciar las habilidades profesionales de los alumnos y alumnas en masofilaxia y masoterapia.',
    plan_estudios:
      '<h3>Campo Ocupacional</h3><br /><br /> Los estudiantes podrán desempeñarse en spa, hoteles y centros deportivos.<br /><br /><ul><li>Aplicar técnicas de masaje deportivo.</li></ul>',
  },
};

const OVERRIDE: CourseOverride = {
  slug: 'diplomado-masoterapia-deportiva',
  groupId: 'especializaciones',
  modality: 'Semipresencial',
  location: 'Viña del Mar y aula virtual',
  nextStart: '1 de enero de 2020',
  diploma: true,
  introTitle: 'Diplomado intensivo en masoterapia deportiva',
  introLead: 'Aprende a acompañar a deportistas con técnicas seguras.',
  calloutText: 'Teoría online, práctica presencial y acompañamiento durante todo el proceso.',
  scheduleEyebrow: 'ADMISIÓN 2026',
  scheduleTitle: 'Fechas y horarios',
  scheduleBody: 'Inscripciones hasta el viernes 7 de agosto de 2026.',
  planEstudiosBody: 'El aprendizaje combina contenido teórico asincrónico con jornadas prácticas.',
  duration: '150 horas | 5 meses',
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
  assert.equal(data.hero.title, 'Diplomado en masoterapia deportiva');
  assert.equal(data.hero.image, 'https://cenakin.cl/images/cursos/masoterapia-deportiva/1@3x.webp');
  assert.equal(data.listing.image, 'https://cenakin.cl/images/cursos/masoterapia-deportiva/mini.webp');
  assert.deepEqual(data.hero.badges, ['DIPLOMADO CERTIFICADO', 'SEMIPRESENCIAL']);
  assert.equal(data.hero.pdfHref, 'https://cenakin.cl/pdfs/5571.pdf');
  assert.equal(data.facts.duration, '150 horas | 5 meses');
  assert.equal(data.facts.nextStart, '11 de agosto de 2026');
  assert.equal(data.facts.modality, 'Semipresencial');
  assert.equal(data.intro.title, 'Diplomado intensivo en masoterapia deportiva');
  assert.equal(data.intro.lead, 'Diplomado enfocado en técnicas de masoterapia deportiva aplicadas.');
  assert.equal(data.intro.body, PRODUCT.acf.objetivo);
  assert.equal(data.intro.calloutLabel, 'FORMACIÓN FLEXIBLE');
  assert.deepEqual(data.listing.badges, ['♙ Curso certificado', '◷ 150 horas', '◉ Semipresencial']);
  assert.equal(data.listing.longTitle, false);
  assert.equal(data.schedule[0].eyebrow, 'ADMISIÓN 2026');
  assert.equal(data.schedule[0].options[0].title, 'Opción 1');
  assert.equal(data.schedule[1].title, 'Plan de estudios');
  assert.equal(data.schedule[1].body, OVERRIDE.planEstudiosBody);
  assert.equal(
    data.schedule[1].bodyHtml,
    '<h3 class="section-divider">Campo Ocupacional</h3><br><br> Los estudiantes podrán desempeñarse en spa, hoteles y centros deportivos.<br><br><ul><li>Aplicar técnicas de masaje deportivo.</li></ul>',
  );
  assert.equal(data.schedule[1].pdfHref, 'https://cenakin.cl/pdfs/5571.pdf');
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
  assert.equal(data.price.reserveText, 'Reserva tu cupo para Diplomado en masoterapia deportiva.');
  assert.equal(data.intro.calloutLabel, 'FORMACIÓN PRÁCTICA');
  assert.deepEqual(data.listing.badges, ['♙ Curso certificado', '◷ 150 horas', '◉ Semipresencial']);
  assert.equal(data.hero.pdfHref, 'https://cenakin.cl/pdfs/5571.pdf');
});

test('transformProduct handles off-sale (not discounted) product pricing', () => {
  const OFF_SALE_PRODUCT = {
    ...PRODUCT,
    id: 3461,
    regular_price: '500000',
    sale_price: '',
    on_sale: false,
    date_on_sale_to: null,
  };
  const data = transformProduct(OFF_SALE_PRODUCT, '3461', OVERRIDE, TEACHERS, 'Educación continua o especializaciones');

  assert.equal(data.price.label, 'ARANCEL TOTAL');
  assert.equal(data.price.original, null);
  assert.equal(data.price.current, '$500.000');
  assert.equal(data.price.discountText, null);
});

test('transformProduct uses acf.fecha_inicio over a stale override.nextStart', () => {
  const data = transformProduct(PRODUCT, '5571', OVERRIDE, TEACHERS, 'grupo');
  assert.equal(data.facts.nextStart, '11 de agosto de 2026');
});

test('transformProduct falls back to override.nextStart when acf.fecha_inicio is empty', () => {
  const productWithoutDate = { ...PRODUCT, acf: { ...PRODUCT.acf, fecha_inicio: '' } };
  const data = transformProduct(productWithoutDate, '5571', OVERRIDE, TEACHERS, 'grupo');
  assert.equal(data.facts.nextStart, '1 de enero de 2020');
});

test('transformProduct throws when nextStart has neither acf.fecha_inicio nor override.nextStart', () => {
  const productWithoutDate = { ...PRODUCT, acf: { ...PRODUCT.acf, fecha_inicio: '' } };
  const { nextStart, ...overrideWithoutNextStart } = OVERRIDE;
  assert.throws(
    () => transformProduct(productWithoutDate, '5571', overrideWithoutNextStart, TEACHERS, 'grupo'),
    /entry 5571 is missing nextStart/,
  );
});

test('transformProduct prefers acf.horas over a stale pure-hours override.duration', () => {
  const productWithFewerHours = { ...PRODUCT, acf: { ...PRODUCT.acf, horas: '10' } };
  const data = transformProduct(productWithFewerHours, '5571', { ...OVERRIDE, duration: '20 horas' }, TEACHERS, 'grupo');
  assert.equal(data.facts.duration, '10 horas');
});

test('transformProduct falls back to a pure-hours override.duration when acf.horas is empty', () => {
  const productWithoutHours = { ...PRODUCT, acf: { ...PRODUCT.acf, horas: '' } };
  const data = transformProduct(productWithoutHours, '5571', { ...OVERRIDE, duration: '20 horas' }, TEACHERS, 'grupo');
  assert.equal(data.facts.duration, '20 horas');
});

test('transformProduct throws when duration has neither acf.horas nor a usable override.duration', () => {
  const productWithoutHours = { ...PRODUCT, acf: { ...PRODUCT.acf, horas: '' } };
  const { duration, ...overrideWithoutDuration } = OVERRIDE;
  assert.throws(
    () => transformProduct(productWithoutHours, '5571', overrideWithoutDuration, TEACHERS, 'grupo'),
    /entry 5571 is missing duration/,
  );
});
```

- [ ] **Step 2: Correr los tests y confirmar que fallan**

Run: `npm test -- src/lib/woocommerce/transform.test.ts`
Expected: FAIL — `CourseOverride` todavía exige `title` (error de tipos / `title` no definido en `OVERRIDE`), y `PRODUCT.acf` no tiene `fecha_inicio` en el tipo `WooCommerceProduct`.

- [ ] **Step 3: Agregar `fecha_inicio` al tipo de `client.ts`**

En `src/lib/woocommerce/client.ts`, dentro de la interfaz `WooCommerceProduct`, agregar el campo `fecha_inicio` junto a `horas`:

```ts
export interface WooCommerceProduct {
  id: number;
  name: string;
  slug: string;
  short_description: string;
  regular_price: string;
  sale_price: string;
  on_sale: boolean;
  date_on_sale_to: string | null;
  stock_status: 'instock' | 'outofstock' | 'onbackorder';
  acf: {
    horas: string;
    fecha_inicio: string;
    incluye: string;
    dirigido: string;
    formato: string;
    profesores: string[];
    objetivo: string;
    plan_estudios: string;
  };
}
```

(El resto de `client.ts` no cambia.)

- [ ] **Step 4: Reescribir `transform.ts`**

Reemplazar el contenido completo de `src/lib/woocommerce/transform.ts`:

```ts
// src/lib/woocommerce/transform.ts
import { parseIncludes, parseRequirements, parseFormatoOptions, parseProfesores, markSectionDividers, stripHtml } from './parseAcf.ts';
import { formatCLP, formatSpanishDate, parseAcfDate } from './format.ts';
import type { WooCommerceProduct } from './client.ts';

export interface CourseOverride {
  slug: string;
  groupId: string;
  modality: string;
  location: string;
  nextStart?: string;
  diploma: boolean;
  introTitle: string;
  introLead: string;
  calloutText: string;
  scheduleEyebrow: string;
  scheduleTitle: string;
  scheduleBody: string;
  planEstudiosBody: string;
  duration?: string;
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

const PURE_HORAS_PATTERN = /^\d+ horas$/;

export function transformProduct(
  product: WooCommerceProduct,
  wcId: string,
  override: CourseOverride,
  teachers: TeacherRegistry,
  groupTitle: string,
) {
  const modality = override.modality;
  const onSale = product.on_sale;
  const title = product.name;

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
  const reserveText = override.reserveText ?? `Reserva tu cupo para ${title}.`;
  const calloutLabel =
    override.calloutLabel ?? (override.diploma ? 'FORMACIÓN FLEXIBLE' : 'FORMACIÓN PRÁCTICA');
  const listingBadges = override.listingBadges ?? [
    '♙ Curso certificado',
    `◷ ${product.acf.horas} horas`,
    `◉ ${modality}`,
  ];

  const nextStart = product.acf.fecha_inicio ? parseAcfDate(product.acf.fecha_inicio) : override.nextStart;
  if (!nextStart) {
    throw new Error(
      `courseOverrides.json entry ${wcId} is missing nextStart (no acf.fecha_inicio and no override.nextStart)`,
    );
  }

  const derivedDuration = product.acf.horas ? `${product.acf.horas} horas` : undefined;
  const duration =
    override.duration && !PURE_HORAS_PATTERN.test(override.duration)
      ? override.duration
      : (derivedDuration ?? override.duration);
  if (!duration) {
    throw new Error(
      `courseOverrides.json entry ${wcId} is missing duration (no acf.horas and no override.duration)`,
    );
  }

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
      image: `https://cenakin.cl/images/cursos/${product.slug}/mini.webp`,
      badges: listingBadges,
      modality,
      longTitle: title.length > 70,
    },
    hero: {
      image: `https://cenakin.cl/images/cursos/${product.slug}/1@3x.webp`,
      ogImage: `https://cenakin.cl/images/cursos/${product.slug}/1.jpg`,
      breadcrumbLabel: groupTitle,
      badges: [override.diploma ? 'DIPLOMADO CERTIFICADO' : 'CURSO CERTIFICADO', modality.toUpperCase()],
      title,
      compactTitle: title.length > 60,
      subtitle: override.introLead,
      pdfHref,
      hasAvailability: product.stock_status === 'instock',
    },
    facts: {
      duration,
      modality,
      location: override.location,
      nextStart,
    },
    intro: {
      eyebrow: 'SOBRE ESTA FORMACIÓN',
      title: override.introTitle,
      lead: stripHtml(product.short_description),
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
        bodyHtml: markSectionDividers(product.acf.plan_estudios),
        pdfHref,
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

- [ ] **Step 5: Correr los tests y confirmar que pasan**

Run: `npm test -- src/lib/woocommerce/transform.test.ts`
Expected: `ℹ tests 10`, `ℹ pass 10`, `ℹ fail 0`

- [ ] **Step 6: Correr toda la suite**

Run: `npm test`
Expected: `ℹ tests 32`, `ℹ pass 32`, `ℹ fail 0` (21 tests previos + 5 nuevos en `format.test.ts` [Task 1: pasó de 2 a 7] + 6 nuevos en `transform.test.ts` [pasó de 4 a 10] = 32; el conteo exacto puede variar si algún archivo de test no listado acá también cambió, pero `fail 0` es la condición dura).

- [ ] **Step 7: Commit**

```bash
git add src/lib/woocommerce/client.ts src/lib/woocommerce/transform.ts src/lib/woocommerce/transform.test.ts
git commit -m "$(cat <<'EOF'
feat: derive course title, nextStart, and duration from WooCommerce

hero.title/intro.title now always come from product.name. facts.nextStart
prefers acf.fecha_inicio (parsed via parseAcfDate) over courseOverrides.json,
falling back to the override only when WooCommerce has no fecha_inicio.
facts.duration prefers acf.horas unless the override encodes something a
plain hour count can't (e.g. "150 horas | 5 meses"). Fixes course pages
showing stale years/start dates after they were updated in WordPress.
EOF
)"
```

---

### Task 3: Migrar `courseOverrides.json`

**Files:**
- Modify: `src/data/courseOverrides.json`

**Interfaces:**
- Consumes: `parseAcfDate` de Task 1 (importado directamente por el script de migración vía path absoluto, sin necesidad de un paso de build — Node 25 permite importar `.ts` con type-stripping nativo).
- Produces: `src/data/courseOverrides.json` sin las claves `title` (38/38), sin `nextStart` en las entradas donde WooCommerce tiene `acf.fecha_inicio` (~28/38), sin `duration` en las entradas donde el valor es puramente `"N horas"` y `acf.horas` no está vacío (~33/38). Consumido en runtime por Task 2 (ya implementado) — este task solo cambia el dato, no el código.

- [ ] **Step 1: Escribir el script de migración**

Crear `/tmp/claude-1000/-run-media-Respaldo-Oz-Escritorio-cenakinpage/e9cfa1db-3a54-475a-96f4-b0fe0fc7ab76/scratchpad/migrate-course-overrides.mjs` (vive en el scratchpad de la sesión — **no se commitea al repo**, es una herramienta de un solo uso):

```js
import { readFileSync, writeFileSync } from 'node:fs';
import { parseAcfDate } from '/run/media/Respaldo/Oz/Escritorio/cenakinpage/site/src/lib/woocommerce/format.ts';

const SITE_DIR = '/run/media/Respaldo/Oz/Escritorio/cenakinpage/site';
const PURE_HORAS_PATTERN = /^\d+ horas$/;

const envRaw = readFileSync(`${SITE_DIR}/.env`, 'utf8');
const env = {};
for (const line of envRaw.split('\n')) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1]] = match[2];
}

const overridesPath = `${SITE_DIR}/src/data/courseOverrides.json`;
const overrides = JSON.parse(readFileSync(overridesPath, 'utf8'));
const auth = Buffer.from(`${env.WOOCOMMERCE_CONSUMER_KEY}:${env.WOOCOMMERCE_CONSUMER_SECRET}`).toString('base64');

let titlesDeleted = 0;
let nextStartDeleted = 0;
let nextStartKept = 0;
let durationDeleted = 0;
let durationKept = 0;

for (const [wcId, entry] of Object.entries(overrides)) {
  const response = await fetch(`${env.WOOCOMMERCE_URL}/wp-json/wc/v3/products/${wcId}`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!response.ok) {
    throw new Error(`WooCommerce product ${wcId} fetch failed: HTTP ${response.status}`);
  }
  const product = await response.json();

  if ('title' in entry) {
    console.log(`${wcId}: delete title ("${entry.title}" -> product.name "${product.name}")`);
    delete entry.title;
    titlesDeleted++;
  }

  if (product.acf.fecha_inicio) {
    const derived = parseAcfDate(product.acf.fecha_inicio);
    console.log(`${wcId}: delete nextStart ("${entry.nextStart}" -> "${derived}")`);
    delete entry.nextStart;
    nextStartDeleted++;
  } else {
    console.log(`${wcId}: keep nextStart ("${entry.nextStart}") — no acf.fecha_inicio`);
    nextStartKept++;
  }

  if (entry.duration && PURE_HORAS_PATTERN.test(entry.duration) && product.acf.horas) {
    const derived = `${product.acf.horas} horas`;
    console.log(`${wcId}: delete duration ("${entry.duration}" -> "${derived}")`);
    delete entry.duration;
    durationDeleted++;
  } else {
    console.log(`${wcId}: keep duration ("${entry.duration}")`);
    durationKept++;
  }
}

writeFileSync(overridesPath, JSON.stringify(overrides, null, 2) + '\n');

console.log('---summary---');
console.log(`title deleted: ${titlesDeleted}/${Object.keys(overrides).length}`);
console.log(`nextStart deleted: ${nextStartDeleted}, kept: ${nextStartKept}`);
console.log(`duration deleted: ${durationDeleted}, kept: ${durationKept}`);
```

- [ ] **Step 2: Correr el script**

Run: `node /tmp/claude-1000/-run-media-Respaldo-Oz-Escritorio-cenakinpage/e9cfa1db-3a54-475a-96f4-b0fe0fc7ab76/scratchpad/migrate-course-overrides.mjs`

Expected (según el estado de WooCommerce relevado el 2026-08-19 — puede variar si alguien edita WordPress antes de correr esto, pero `fail 0` en el paso siguiente es la condición dura):
```
---summary---
title deleted: 38/38
nextStart deleted: 28, kept: 10
duration deleted: 33, kept: 5
```

- [ ] **Step 3: Revisar el diff a simple vista**

Run: `git diff --stat src/data/courseOverrides.json`
Expected: un solo archivo modificado, con líneas borradas (no agregadas) salvo el `\n` final si no existía antes.

Run: `git diff src/data/courseOverrides.json | grep '^-' | grep -c '"title"\|"nextStart"\|"duration"'`
Expected: 38 + 28 + 33 = 99 (número exacto de líneas borradas de esas tres claves; puede variar levemente según los conteos reales del Step 2).

- [ ] **Step 4: Validar que el JSON resultante sigue siendo válido y correr la suite completa**

Run: `node -e "JSON.parse(require('fs').readFileSync('src/data/courseOverrides.json', 'utf8')); console.log('valid JSON')"`
Expected: `valid JSON`

Run: `npm test`
Expected: `ℹ fail 0` (mismo conteo de tests que al final de Task 2 — este task no toca código, solo datos, así que los tests no deberían cambiar de cantidad).

- [ ] **Step 5: Commit**

```bash
git add src/data/courseOverrides.json
git commit -m "$(cat <<'EOF'
data: remove title/nextStart/duration from courseOverrides.json where WooCommerce already has them

Migrated with a one-off script that compared each of the 38 entries against
the live WooCommerce API. Generated with Task 2's transformProduct logic in
mind: these fields now come from product.name / acf.fecha_inicio / acf.horas
at build time, so keeping stale copies here was the source of the reported
bug (masoterapia diploma years/start dates not updating).
EOF
)"
```

---

### Task 4: Verificación final (build + spot-check)

**Files:**
- Ninguno (solo lectura/verificación; no se esperan cambios de código en este task salvo que algo falle).

**Interfaces:**
- Consumes: todo lo de Tasks 1–3.
- Produces: confirmación de que el bug reportado por el usuario está resuelto en el HTML generado.

- [ ] **Step 1: Build completo**

Run: `npm run build`
Expected: build exitoso, termina con algo como `X page(s) built in Ys` y sin errores (en particular, sin el error `is missing nextStart`/`is missing duration` de Task 2 — si aparece, algún curso real no cae en ninguno de los casos cubiertos y hay que revisar su entrada en `courseOverrides.json`).

- [ ] **Step 2: Confirmar que el caso reportado por el usuario ahora muestra 2027**

Run: `grep -o 'Diplomado en Masoterapia Semipresencial[^<]*\|8 de marzo de 2027' dist/cursos/diplomado-semipresencial/index.html`
Expected: aparece `Diplomado en Masoterapia Semipresencial 2027` (título ahora viene de `product.name`, ya no dice "Agosto 2026") y `8 de marzo de 2027` (nextStart derivado de `acf.fecha_inicio`, ya no "3 de agosto de 2026").

- [ ] **Step 3: Confirmar que el curso que sigue mal en WordPress (no es un bug de este código) se ve consistente con WordPress**

Run: `grep -o 'Diplomado Intensivo en Masoterapia[^<]*' dist/cursos/diplomado-intensivo-masoterapia-2026/index.html | head -1`
Expected: sigue diciendo "2026" — porque el propio WordPress todavía no fue actualizado para este producto (id 4691, ver Contexto del spec). Esto no es algo que este código pueda arreglar; si el resultado sorprende, es una señal para avisarle al usuario que ese curso específico falta actualizar en WordPress, no un bug de la migración.

- [ ] **Step 4: Confirmar que un curso sin fecha (online) sigue mostrando su texto manual**

Run: `grep -o 'Acceso inmediato' dist/cursos/diplomado-online-masoterapia/index.html`
Expected: aparece `Acceso inmediato` (el fallback a `override.nextStart` sigue funcionando para los cursos sin `acf.fecha_inicio`).

- [ ] **Step 5: Reportar resultado**

Si los 4 steps anteriores dan lo esperado, el bug reportado está resuelto y el resto del catálogo (22 cursos con fechas desincronizadas detectados durante la investigación, más allá del caso puntual reportado) también quedó corregido por el mismo cambio. Avisar al usuario que el producto 4691 sigue con año 2026 porque WordPress mismo no fue actualizado ahí — eso requiere una edición en WordPress, no código.
