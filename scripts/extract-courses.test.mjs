import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractGroups, extractListing, extractCourseDetail } from './extract-courses.mjs';

const categoriasFixture = `
<div class="catalog">
  <section class="course-group" id="esteticos">
    <div class="group-head">
      <div><p>ÁREA DE FORMACIÓN</p><h2>Cursos de Masaje Estético</h2><span>Descripción de prueba.</span></div>
    </div>
    <div class="course-grid">
      <a class="course-card long-title" href="/curso/curso-prueba/">
        <div class="course-image"><img src="/images/curso-prueba-1200.webp" srcSet="/images/curso-prueba-640.webp 640w, /images/curso-prueba-1200.webp 1200w" sizes="(max-width: 700px) 100vw, 230px"/></div>
        <div class="course-body">
          <div class="badges"><span>♙ Curso certificado</span><span>◷ 20 horas</span><span class="modality-badge">◉ Semipresencial</span></div>
          <h3>Curso de Prueba</h3>
          <p>Semipresencial</p>
        </div>
      </a>
    </div>
  </section>
</div>`;

const detailFixture = `
<main class="detail-page diploma-detail">
  <section class="detail-hero">
    <img src="/images/curso-prueba.webp"/>
    <div class="detail-hero-content">
      <p class="detail-crumb"><a href="/categorias/">Cursos</a><span>›</span>Cursos de Masaje Estético</p>
      <div class="detail-badges"><span>CURSO CERTIFICADO</span><span>SEMIPRESENCIAL</span></div>
      <h1>Curso de Prueba</h1>
      <p>Subtítulo de prueba.</p>
      <div class="hero-actions"><a class="secondary-detail-btn" href="https://cenakin.cl/pdfs/1.pdf">Descargar programa</a></div>
    </div>
  </section>
  <section class="detail-facts">
    <div><small>DURACIÓN</small><strong>20 horas</strong></div>
    <div><small>MODALIDAD</small><strong>Semipresencial</strong></div>
    <div><small>UBICACIÓN</small><strong>Viña del Mar</strong></div>
    <div><small>PRÓXIMO INICIO</small><strong>11 de agosto de 2026</strong></div>
  </section>
  <div class="detail-layout">
    <div class="detail-content">
      <section class="detail-section intro-section">
        <p class="eyebrow">SOBRE ESTA FORMACIÓN</p>
        <h2>Curso intensivo de prueba</h2>
        <p class="lead">Bajada de prueba.</p>
        <p>Cuerpo de prueba.</p>
        <div class="detail-callout"><span>FORMACIÓN PRÁCTICA</span><strong>Callout de prueba.</strong></div>
      </section>
      <section class="detail-section">
        <p class="eyebrow">AGENDA 2026</p>
        <h2>Fechas y horarios</h2>
        <p>Texto de agenda.</p>
        <div class="schedule-grid">
          <article>
            <span class="availability">CUPOS DISPONIBLES</span>
            <h3>Miércoles vespertino</h3>
            <ul><li><b>Bienvenida:</b> martes 11 de agosto.</li><li><b>Duración:</b> 5 semanas.</li></ul>
          </article>
        </div>
      </section>
      <section class="teacher-section diploma-teacher-card">
        <div class="teacher-mark teacher-photo" style="background-image:url('/images/docente-prueba.jpg')"></div>
        <div>
          <h2>Docente de Prueba</h2>
          <p class="teacher-summary">Resumen de prueba.</p>
          <ul class="check-list teacher-credentials"><li>Certificado A.</li><li>Certificado B.</li></ul>
          <div class="teacher-tags"><span>Tag uno</span><span>Tag dos</span></div>
        </div>
      </section>
      <section class="detail-section include-section">
        <div><h2>Tu curso incluye</h2><ul class="check-list"><li>Incluye A.</li></ul></div>
        <div><h2>Requisitos</h2><ul class="check-list"><li>Requisito A.</li></ul></div>
      </section>
      <section class="accreditation">ignored</section>
      <section class="testimonial">ignored</section>
    </div>
    <aside class="enroll-card inquiry-card" id="inscripcion">ignored</aside>
    <section class="price-section">
      <div class="price-intro"><p class="eyebrow">VALORES Y FORMAS DE PAGO</p><h2>Invierte en tu formación profesional</h2><p>Reserva tu cupo para Curso de Prueba.</p></div>
      <div class="price-panel">
        <span class="enroll-label">DESCUENTO VIGENTE</span>
        <p>Arancel total <del>$100.000</del></p>
        <strong class="price">$80.000 CLP</strong>
        <span class="discount">Válido hasta el 31 de julio de 2026</span>
      </div>
    </section>
  </div>
</main>`;

test('extractGroups reads group id, title and description in order', () => {
  const groups = extractGroups(categoriasFixture);
  assert.deepEqual(groups, [
    { id: 'esteticos', title: 'Cursos de Masaje Estético', description: 'Descripción de prueba.' },
  ]);
});

test('extractListing reads card image, badges, modality and long-title flag', () => {
  const listing = extractListing(categoriasFixture);
  const entry = listing.get('curso-prueba');
  assert.ok(entry, 'expected an entry for curso-prueba');
  assert.equal(entry.groupId, 'esteticos');
  assert.equal(entry.image.src, '/images/curso-prueba-1200.webp');
  assert.match(entry.image.srcset, /640w/);
  assert.deepEqual(entry.badges, ['♙ Curso certificado', '◷ 20 horas', '◉ Semipresencial']);
  assert.equal(entry.modality, 'Semipresencial');
  assert.equal(entry.longTitle, true);
});

test('extractCourseDetail reads hero, facts, intro, schedule, teachers, includes and price', () => {
  const data = extractCourseDetail(detailFixture);

  assert.equal(data.diploma, true);
  assert.equal(data.hero.image, '/images/curso-prueba.webp');
  assert.equal(data.hero.breadcrumbLabel, 'Cursos de Masaje Estético');
  assert.deepEqual(data.hero.badges, ['CURSO CERTIFICADO', 'SEMIPRESENCIAL']);
  assert.equal(data.hero.title, 'Curso de Prueba');
  assert.equal(data.hero.subtitle, 'Subtítulo de prueba.');
  assert.equal(data.hero.pdfHref, 'https://cenakin.cl/pdfs/1.pdf');

  assert.deepEqual(data.facts, {
    duration: '20 horas',
    modality: 'Semipresencial',
    location: 'Viña del Mar',
    nextStart: '11 de agosto de 2026',
  });

  assert.equal(data.intro.eyebrow, 'SOBRE ESTA FORMACIÓN');
  assert.equal(data.intro.title, 'Curso intensivo de prueba');
  assert.equal(data.intro.lead, 'Bajada de prueba.');
  assert.equal(data.intro.body, 'Cuerpo de prueba.');
  assert.equal(data.intro.calloutLabel, 'FORMACIÓN PRÁCTICA');
  assert.equal(data.intro.calloutText, 'Callout de prueba.');

  assert.equal(data.schedule.length, 1);
  assert.equal(data.schedule[0].eyebrow, 'AGENDA 2026');
  assert.equal(data.schedule[0].options[0].availability, 'CUPOS DISPONIBLES');
  assert.equal(data.schedule[0].options[0].title, 'Miércoles vespertino');
  assert.deepEqual(data.schedule[0].options[0].items, ['Bienvenida: martes 11 de agosto.', 'Duración: 5 semanas.']);

  assert.equal(data.teachers.length, 1);
  assert.equal(data.teachers[0].name, 'Docente de Prueba');
  assert.equal(data.teachers[0].photo, '/images/docente-prueba.jpg');
  assert.deepEqual(data.teachers[0].credentials, ['Certificado A.', 'Certificado B.']);
  assert.deepEqual(data.teachers[0].tags, ['Tag uno', 'Tag dos']);

  assert.deepEqual(data.includes, ['Incluye A.']);
  assert.deepEqual(data.requirements, ['Requisito A.']);

  assert.equal(data.price.label, 'DESCUENTO VIGENTE');
  assert.equal(data.price.original, '$100.000');
  assert.equal(data.price.current, '$80.000 CLP');
  assert.equal(data.price.discountText, 'Válido hasta el 31 de julio de 2026');
  assert.equal(data.price.reserveText, 'Reserva tu cupo para Curso de Prueba.');
});
