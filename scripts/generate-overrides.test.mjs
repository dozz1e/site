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
