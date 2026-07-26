# Cursos: fuente de datos WooCommerce (en vez de JSON local)

Fecha: 2026-07-23

## Contexto

El sitio hoy lee cursos desde `src/content/curso/*.json` (38 archivos), generados una
sola vez por `scripts/extract-courses.mjs` scrapeando HTML del sitio antiguo. Se
necesita que la fuente real sea WooCommerce (tienda en `https://cenakin.cl/otec`),
donde los cursos son productos con campos ricos vía ACF (Advanced Custom Fields).

Se inspeccionó la API real (`GET /wp-json/wc/v3/products/4149`) y el listado completo
de productos (`GET /wp-json/wc/v3/products?per_page=100`). Hallazgos clave:

- WooCommerce tiene 54 productos publicados, pero no todos son cursos reales: hay
  productos de prueba ("Producto", "Producto prueba online") y 3 cursos de Excel que
  no están publicados en el sitio actual.
- Los campos ACF (`objetivo`, `incluye`, `formato`, `dirigido`, `profesores`, etc.)
  vienen como bloques HTML sueltos (rich text de WordPress), no como los objetos
  estructurados finos del schema actual.
- Varios campos del schema actual (`facts.modality`, `facts.location`,
  `facts.nextStart`, `groupId`, foto/tags de docente) **no existen en WooCommerce en
  absoluto** — son curaduría editorial que hoy solo vive en los JSON locales.

## Arquitectura

Reemplazar la colección `curso` (`type: 'data'` leyendo archivos) por un **Content
Loader custom** de Astro (`src/content/config.ts`) que en cada `astro build` /
`astro dev`:

1. Lee `src/data/courseOverrides.json` — lista de IDs de producto WooCommerce a
   publicar, con sus campos editoriales.
2. Por cada ID, hace `GET /wp-json/wc/v3/products/{id}` a WooCommerce (credenciales
   vía variables de entorno `WOOCOMMERCE_URL`, `WOOCOMMERCE_CONSUMER_KEY`,
   `WOOCOMMERCE_CONSUMER_SECRET`, definidas en `.env`, que está en `.gitignore`).
3. Parsea los campos `acf.*` con `cheerio` para extraer listas, secciones y docentes.
4. Cruza nombres de docentes contra `src/data/teachers.json` para completar
   foto/tags/resumen.
5. Arma el objeto final y lo valida contra el mismo schema zod que existe hoy en
   `src/content/config.ts`.

No hay JSON intermedios versionados para los cursos — la fuente de verdad para el
contenido rico es WooCommerce; la fuente de verdad para qué se publica y los campos
editoriales exclusivos es `courseOverrides.json`.

## `courseOverrides.json`: lista blanca + datos editoriales

Keyed por ID de producto WooCommerce (string). Solo los IDs presentes acá generan
página de curso — esto filtra automáticamente productos de prueba y cursos no
publicados todavía, sin depender de categorías o convenciones de nombre en
WooCommerce.

```json
{
  "4149": {
    "groupId": "diplomados",
    "modality": "Presencial",
    "location": "Viña del Mar",
    "nextStart": "09 de marzo de 2026",
    "diploma": true,
    "introLead": "Conviértete en masoterapeuta profesional...",
    "calloutText": "Clases presenciales una vez por semana durante 10 meses."
  }
}
```

Campos de `courseOverrides.json` por entrada:
`groupId` (string, debe existir en `src/data/categoryGroups.json`), `modality`
(string), `location` (string), `nextStart` (string), `diploma` (boolean),
`introLead` (string), `calloutText` (string), `pdfHref` (string, opcional — solo
para los casos donde no aplica el patrón `/pdfs/{id}.pdf`, ver mapeo de
`hero.pdfHref` abajo).

Agregar un curso nuevo = agregar su ID de producto con estos campos. Sacar un curso
del sitio = borrar su entrada. No requiere tocar WordPress.

## `teachers.json`: registro de docentes

Keyed por nombre exacto tal como aparece en el `<h4>` de `acf.profesores`:

```json
{
  "Jorge Rojas": {
    "photo": "/images/teachers/jorge-rojas.jpg",
    "summary": "Kinesiólogo especializado en masoterapia deportiva.",
    "tags": ["Kinesiología", "Masoterapia deportiva"]
  }
}
```

Un mismo docente aparece en varios cursos; se completa una sola vez. Si un nombre
parseado no tiene entrada en el registro, el build falla explícito (no se publica
ficha de docente incompleta silenciosamente).

## Mapeo de campos completo

| Campo del schema | Fuente | Cómo se obtiene |
|---|---|---|
| `slug` | WC nativo | `slug` |
| `hero.title`, `intro.title` | WC nativo | `name` |
| `hero.image`, `listing.image.src` | WC nativo | `images[0].src` |
| `listing.image.srcset` / `.sizes` | — | `null` (WooCommerce no expone srcset limpio; se omite el atributo en el `<img>`) |
| `price.original` | WC nativo | `regular_price` formateado a CLP |
| `price.current` | WC nativo | `sale_price` si `on_sale`, si no `regular_price` |
| `price.discountText` | WC nativo | `date_on_sale_to` formateada ("Válido hasta el ...", si existe) |
| `price.label` | derivado | constante `"DESCUENTO VIGENTE"` |
| `price.reserveText` | derivado | plantilla `` `Reserva tu cupo para ${hero.title}.` `` |
| `hero.badges` | derivado | `[diploma ? 'DIPLOMADO CERTIFICADO' : 'CURSO CERTIFICADO', modality.toUpperCase()]` |
| `listing.badges` | derivado | `['♙ Curso certificado', `◷ ${horas} horas`, `◉ ${modality}`]` |
| `listing.longTitle` | derivado | `hero.title.length > umbral` (mismo criterio visual que hoy) |
| `facts.duration` | ACF nativo | `acf.horas + ' horas'` |
| `facts.modality`, `.location`, `.nextStart` | overrides | `courseOverrides.json` |
| `includes[]` | ACF + cheerio | `<li>` de `acf.incluye` |
| `requirements[]` | ACF + cheerio | `<li>` de `acf.dirigido` |
| `teachers[].name` | ACF + cheerio | texto de cada `<h4>` en `acf.profesores` |
| `teachers[].credentials[]` | ACF + cheerio | `<li>` dentro de cada bloque de `acf.profesores` |
| `teachers[].photo`, `.summary`, `.tags[]` | `teachers.json` | lookup por nombre |
| `schedule[].options[]` | ACF + cheerio | cada bloque `<h4>` de `acf.formato` → `title` = texto del `<h4>`, `items[]` = `<li>` siguientes. Sub-campo `availability` se elimina del schema (no hay fuente) |
| `schedule[].eyebrow`, `.title`, `.body` | derivado | constante (`"Fechas y horarios"`, eyebrow según `diploma`) |
| `intro.eyebrow` | derivado | constante `"SOBRE ESTA FORMACIÓN"` |
| `intro.body` | ACF nativo | `acf.objetivo` |
| `intro.lead` | overrides | `courseOverrides.json.introLead` |
| `intro.calloutLabel` | derivado | `diploma ? 'FORMACIÓN FLEXIBLE' : 'FORMACIÓN PRÁCTICA'` |
| `intro.calloutText` | overrides | `courseOverrides.json.calloutText` |
| `groupId` | overrides | `courseOverrides.json.groupId` |
| `diploma` | overrides | `courseOverrides.json.diploma` |
| `hero.pdfHref` | derivado, con excepción en overrides | plantilla `` `https://cenakin.cl/pdfs/${id}.pdf` `` (id = ID de producto WooCommerce, patrón verificado en vivo); si `courseOverrides.json` trae `pdfHref` explícito para ese ID, ese valor gana |

## Manejo de errores en build

- ID en `courseOverrides.json` sin producto correspondiente en WooCommerce (borrado o
  despublicado) → build falla explícito, listando el ID faltante.
- WooCommerce inaccesible (red, credenciales inválidas, HTTP != 200) → build falla
  con el código/mensaje HTTP. No hay fallback silencioso a datos viejos.
- Nombre de docente parseado sin entrada en `teachers.json` → build falla explícito
  listando el nombre faltante.
- Producto sin alguno de los campos ACF esperados → build falla al validar contra el
  schema zod (comportamiento ya existente, no cambia).

## Limpieza

Al migrar, se eliminan:
- `src/content/curso/*.json` (38 archivos, generados por el scraper viejo)
- `scripts/extract-courses.mjs` y `scripts/extract-courses.test.mjs`
- El script `extract:courses` de `package.json`

Se mantiene sin cambios:
- `src/data/categoryGroups.json` (curaduría de las 10 áreas, no depende de WooCommerce)
- Todos los componentes de presentación (`FactsBar`, `TeacherCard`, `ScheduleGrid`,
  `PriceSection`, `IncludeSection`, `IntroSection`), salvo quitar el sub-campo
  `availability` de `ScheduleGrid`.

## Fuera de alcance

- No se modifica WordPress/WooCommerce ni sus campos ACF.
- No se agregan los 3 cursos de Excel ni se limpian los productos de prueba en
  WooCommerce — simplemente no se listan en `courseOverrides.json`.
- No se implementa revalidación en runtime (el sitio sigue siendo `output: 'static'`,
  el contenido se actualiza solo en cada rebuild).

## Addendum (2026-07-26): hallazgos de la API real de WooCommerce

Al inspeccionar `GET /wp-json/wc/v3/products` con los 37 productos reales (no solo
la muestra inicial), aparecieron brechas que este addendum resuelve sin cambiar la
arquitectura general:

- **Imágenes no vienen de WooCommerce.** 12 de 37 productos no tienen ningún elemento
  en `images[]`, y el nombre de archivo local (`/images/{slug}...`) no se deriva
  limpio del slug en 15 de 37 casos. `courseOverrides.json` gana los campos
  `heroImage` (string) y `listingImage` (`{ src, srcset, sizes }`), copiados 1:1 desde
  los assets locales ya existentes en `public/images/`. Se elimina la fila `images`
  de la tabla de mapeo original — WooCommerce nunca es fuente de imágenes.
- **`schedule[0]` (fechas/inscripción) y `schedule[1]` (plan de estudios) son texto
  curado, no derivable.** `acf.fecha_inicio`/`fecha_termino` vienen vacíos en
  productos reales; `acf.plan_estudios` es contenido HTML extenso (malla curricular
  completa) que no calza con el resumen corto de una frase que muestra hoy el sitio.
  `courseOverrides.json` gana 4 campos requeridos: `scheduleEyebrow`, `scheduleTitle`,
  `scheduleBody`, `planEstudiosBody` — copiados 1:1 desde los JSON locales actuales.
- **`price.reserveText`** sigue la plantilla `Reserva tu cupo para ${hero.title}.` en
  31 de 37 casos; los 5 diplomados y 1 excepción (`masaje-relajante-descontracturante`)
  tienen texto propio. `courseOverrides.json` gana el campo opcional `reserveText`
  (si se omite, se usa la plantilla).
- **`price.label`** no es la constante única `"DESCUENTO VIGENTE"` — se deriva
  `on_sale ? 'DESCUENTO VIGENTE' : 'ARANCEL TOTAL'`.
- **`price.discountText`** se deriva de `on_sale` + `date_on_sale_to` +
  `diploma`: `(diploma ? 'Válido hasta el ' : 'Descuento válido hasta el ') +
  fecha`, sin fila de "hasta agotar cupos" (no ocurre en datos reales actuales).
- **Slugs de WooCommerce no coinciden con las URLs actuales** en 27 de 37 casos
  (ej. WC `masoterapia-deportiva` vs URL actual `/curso/diplomado-masoterapia-deportiva/`).
  Se decidió mantener las URLs actuales: `courseOverrides.json` gana el campo
  requerido `slug`, que gana sobre el slug nativo de WooCommerce.
- **Mapeo slug actual → ID de producto WooCommerce** se resolvió con alta confianza
  extrayendo el ID numérico ya presente en `hero.pdfHref` de los JSON locales
  (`https://cenakin.cl/pdfs/{id}.pdf`) y cruzándolo contra el nombre del producto en
  WooCommerce; 3 casos sin ese patrón se resolvieron por coincidencia exacta de slug
  o de URL de página. Ver `scripts/generate-overrides.mjs` para la tabla completa.
- **Nombres de docentes en ACF tienen variantes de ortografía** para la misma
  persona (`"Jorge Rojas"`, `"Jorge Rojas S"`, `"Jorge Patricio Rojas Sánchez"` son
  el mismo director académico). `teachers.json` incluye las 3 variantes como claves
  separadas apuntando a los mismos datos, en vez de intentar normalizar en código.
