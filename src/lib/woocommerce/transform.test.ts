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
    plan_estudios:
      '<h3>Campo Ocupacional</h3><br /><br /> Los estudiantes podrán desempeñarse en spa, hoteles y centros deportivos.<br /><br /><ul><li>Aplicar técnicas de masaje deportivo.</li></ul>',
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
  assert.equal(data.hero.image, 'https://cenakin.cl/images/cursos/masoterapia-deportiva/1@3x.webp');
  assert.equal(data.listing.image, 'https://cenakin.cl/images/cursos/masoterapia-deportiva/mini.webp');
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
  assert.equal(data.price.reserveText, 'Reserva tu cupo para Diplomado en Masoterapia Deportiva.');
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
