# Cursos: título, fecha de inicio y duración dinámicos desde WooCommerce

Fecha: 2026-08-19

## Contexto

Bug reportado: se cambiaron años y fechas de inicio de varios diplomados de
masoterapia en WordPress, pero al levantar el sitio (`astro dev` / `astro build`)
seguían mostrando el valor viejo.

Causa raíz: `title`, `nextStart` y `duration` están escritos a mano en
`src/data/courseOverrides.json` para los 38 cursos, como texto fijo. `src/lib/woocommerce/transform.ts`
nunca los lee de WooCommerce — el override siempre gana, sin excepción. Se verificó
en vivo contra la API (`GET /wp-json/wc/v3/products/{id}`):

- Producto 4691 (`diplomado-intensivo-masoterapia-2026`): WordPress **tampoco** está
  actualizado (`name` sigue diciendo "2026", `acf.fecha_inicio` = "agosto 3, 2026").
- Producto 4480 (`diplomado-semipresencial`): WordPress **sí** está actualizado
  (`name` = "Diplomado en Masoterapia Semipresencial 2027", `acf.fecha_inicio` =
  "marzo 8, 2027"), pero `courseOverrides.json` quedó con "...Agosto 2026" / "3 de
  agosto de 2026".

Esto confirma que el dato correcto ya vive en WooCommerce para la mayoría de los
cursos, y que la duplicación manual es la que se desincroniza. (Nota histórica: el
spec anterior, `2026-07-23-woocommerce-course-source-design.md`, documentó que
`acf.fecha_inicio` venía vacío en ese momento — desde entonces alguien lo empezó a
llenar en WordPress para 28 de los 38 productos.)

Al comparar en vivo los 38 productos se encontró que esto no es un caso aislado del
diplomado mencionado: de los 28 cursos con `acf.fecha_inicio` poblado, **22 no
coinciden** con el `nextStart` que hoy muestra el sitio (WordPress ya tiene fechas
nuevas, ej. "13 de octubre de 2026", que nunca se copiaron a `courseOverrides.json`).
También se confirmó que 28 de los 38 títulos difieren entre WordPress y el override
(la mayoría solo en mayúsculas/minúsculas — WP usa case de oración, el sitio Title
Case — y algunos con redacción distinta), y que el curso 4851 (masaje tailandés)
muestra "20 horas" en el sitio mientras WordPress tiene `acf.horas = "10"`.

Se revisó también si el copy editorial (`introTitle`, `calloutText`, `scheduleEyebrow`,
`scheduleBody`, `reserveText`, `calloutLabel`, `planEstudiosBody`, `introLead`,
`scheduleTitle`) tiene alguna fuente real en WordPress. Existen campos ACF
`titulo_3`–`titulo_7`, `texto_2`–`texto_5` y `accion` sin usar en el código, pero
están **vacíos en los 38 productos sin excepción** y, según confirma el usuario, ya
no se van a usar para nada — no son la fuente de ese copy. Ese texto sigue siendo
editorial, mantenido a mano. `promociones`, `medios_pago` y `descripcion_valor` sí
tienen datos reales en WooCommerce pero hoy no se muestran en ninguna página de
curso; agregarlos es una funcionalidad nueva, fuera de alcance de este arreglo.

## Alcance

Dinámico desde WooCommerce (se borra el override correspondiente cuando aplica):

| Campo | Fuente WooCommerce | Fallback a override |
|---|---|---|
| `hero.title` / `intro.title` (antes `override.title`) | `product.name` | Ninguno — `name` es obligatorio en WooCommerce, presente en 38/38. Se acepta el cambio visible de casing/redacción en 28 cursos: confirmado con el usuario. |
| `facts.nextStart` | `acf.fecha_inicio`, formateado por `parseAcfDate()` | `override.nextStart`, solo para los cursos sin `fecha_inicio` (10/38 — cursos online/autoguiados sin fecha fija, ej. "Acceso inmediato"). Cuando `fecha_inicio` sí está poblado, gana siempre el valor derivado, aunque no coincida con lo que hoy dice el override — esa discrepancia **es** el bug que se está arreglando (confirmado en 22/28 casos). |
| `facts.duration` | `acf.horas` → `` `${horas} horas` `` | `override.duration` gana solo cuando su texto **no** es puramente `` `${N} horas` `` (ej. "Plazo de 6 meses", "150 horas \| 5 meses" — información que WordPress no puede expresar). Si el override sí tiene la forma pura "N horas" y `acf.horas` está poblado, gana siempre el valor derivado de WordPress, aunque el número no coincida (mismo criterio que `nextStart` — confirmado con el usuario a partir del caso 4851, que hoy muestra "20 horas" con `acf.horas = "10"`). El override solo sobrevive sin condiciones cuando `acf.horas` está vacío en WordPress. |

Se mantiene sin cambios (copy editorial, sin fuente en WordPress):
`introTitle`, `introLead`, `calloutText`, `calloutLabel`, `scheduleEyebrow`,
`scheduleTitle`, `scheduleBody`, `planEstudiosBody`, `reserveText`, `modality`,
`location`, `groupId`, `slug`, `diploma`, `pdfHref`, `listingBadges`.

Fuera de alcance: mostrar `promociones` / `medios_pago` / `descripcion_valor` en la
página del curso (funcionalidad nueva, no arreglo de datos desincronizados).

## Cambios de código

**`src/lib/woocommerce/client.ts`**: agregar `fecha_inicio: string` al tipo
`WooCommerceProduct['acf']` (falta hoy en el tipo aunque ya se usaría en runtime).

**`src/lib/woocommerce/format.ts`**: nueva función `parseAcfDate(raw: string): string`.
Convierte el formato que devuelve el date picker de ACF (`"marzo 8, 2027"` — nombre de
mes en español, día, año, verificado consistente en 28/28 productos con el campo
poblado) al formato del sitio (`"8 de marzo de 2027"`). Reutiliza el arreglo
`MONTHS_ES` ya existente, buscando el índice del nombre de mes.

**`src/lib/woocommerce/transform.ts`**:
- `title` deja de venir de `override.title`; se calcula como `product.name` y se usa
  en `hero.title`, `intro.title`, `listing.longTitle`, `hero.compactTitle`, y en la
  plantilla de `reserveText` por defecto (que ya usa `override.title` hoy — pasa a
  usar el `title` calculado).
- `facts.nextStart`: si `product.acf.fecha_inicio` no está vacío, siempre se usa
  `parseAcfDate(product.acf.fecha_inicio)` — gana incluso si `override.nextStart`
  está presente y no coincide (esa discrepancia es el bug). Solo se usa
  `override.nextStart` cuando `fecha_inicio` viene vacío. Si ambos faltan, el build
  falla explícito (ver manejo de errores).
- `facts.duration`: si `override.duration` está presente y **no** matchea
  `/^\d+ horas$/`, gana el override (es información que WordPress no puede
  expresar, ej. "Plazo de 6 meses"). Si no hay override, o el override sí matchea
  ese patrón puro, gana `` `${product.acf.horas} horas` `` cuando `acf.horas` no
  está vacío. Si no hay ningún valor disponible (sin override utilizable y sin
  `acf.horas`), el build falla explícito.

**`src/lib/woocommerce/transform.ts` — `CourseOverride` interface**: `title` se
elimina del tipo (ya no es un campo del override). `nextStart` y `duration` pasan de
requeridos a opcionales (`nextStart?: string`, `duration?: string`).

## Migración de `courseOverrides.json`

Las 38 entradas tienen hoy `title`, `nextStart` y `duration` puestos a mano. Se migra
con un script Node de un solo uso (vive en el scratchpad de la sesión, no se
commitea al repo) que por cada entrada:

1. Pide el producto real a WooCommerce.
2. Borra la clave `title` siempre (38/38).
3. Borra `nextStart` si `acf.fecha_inicio` no está vacío (28/38) — sin importar si
   coincide con el valor actual del override; el mismatch es justamente lo que se
   está arreglando.
4. Borra `duration` si matchea `/^\d+ horas$/` **y** `acf.horas` no está vacío —
   sin importar si el número coincide (mismo criterio que el punto 3).
5. Escribe el JSON resultante, preservando el orden de claves e indentado a 2
   espacios (mismo estilo que el archivo actual).

El script imprime un resumen con cada cambio: ID, campo borrado, valor viejo →
valor nuevo derivado, para que quede como bitácora de la migración (no bloquea
nada, es solo para revisión humana posterior).

## Manejo de errores en build

- Curso sin `override.nextStart` y sin `acf.fecha_inicio` → build falla explícito
  listando el ID de WooCommerce (mismo patrón que el error ya existente de
  `groupId` desconocido en `src/content/config.ts`).
- Curso sin `override.duration` y sin `acf.horas` → build falla explícito, mismo
  patrón.
- `parseAcfDate` recibe un string que no matchea el formato esperado (mes en
  español + día + año) → lanza error explícito con el valor crudo recibido, no
  intenta adivinar.

## Tests

- `format.test.ts`: casos nuevos para `parseAcfDate` — día de un dígito y de dos
  dígitos, los 12 meses, error en formato inesperado.
- `transform.test.ts`: `title` sale de `product.name` y ya no depende de
  `override.title`; `nextStart`/`duration` usan el override cuando está presente y
  caen al valor derivado cuando no; build falla si falta todo.
- `client.test.ts`: el tipo `WooCommerceProduct` incluye `acf.fecha_inicio`.

## Fuera de alcance

- No se modifica WordPress ni sus campos ACF.
- No se muestran `promociones`, `medios_pago` ni `descripcion_valor` en la página del
  curso.
- No se toca el copy editorial (`introTitle`, `calloutText`, `scheduleEyebrow`,
  `scheduleBody`, etc.) — sigue siendo mantenimiento manual en `courseOverrides.json`,
  con el mismo riesgo de desincronización que hoy si alguien no lo actualiza al
  cambiar fechas relacionadas (ej. el año mencionado dentro de `scheduleEyebrow` o
  `scheduleBody`). Se documenta como limitación conocida, no se resuelve acá.
