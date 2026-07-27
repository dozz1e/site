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

const FORMATO_H3_FALLBACK_HTML = `<h3>Inicio y acceso</h3>
<p>El inicio comienza con la activación del aula virtual, habilitada luego de realizar el pago completo del valor y formalizada la contratación de servicios. Este documento lo enviamos una vez realizado este pago. Si tienes dudas en este punto puedes presionar el botón de WhatsApp y un asesor te guiará en el proceso.</p>
<h3>Duración y certificación</h3>
<ul>
<li>Para obtener el certificado damos un plazo estimado de máximo 6 meses desde la activación del aula virtual.</li>
<li>Una vez finalizado y cumplidos los requisitos en este periodo, se entrega certificado digital de aprobación.</li>
<li>Luego de aprobar, tendrás un total de 12 meses de acceso a la plataforma desde su activación, para que puedas repasar contenidos todas las veces que lo necesites.</li>
</ul>
<p>&nbsp;</p>
`;

const FORMATO_HEADINGLESS_UL_HTML = `<h2>FECHAS, INICIO Y HORARIOS</h2>
<ul>
<li>Modalidad: Semi presencial</li>
<li>Inicio: Agosto 2026</li>
<li>Finalización programa: Abril 2027</li>
<li>Clases online desde aula virtual en modalidad asincrónica</li>
<li>Clases presenciales 1 vez por mes días sábados de 9:15 a 18:30 horas.</li>
<li>Inscripciones Hasta Viernes 31 de julio 2026</li>
</ul>
`;

const FORMATO_INTRO_H3_AND_TRAILING_UL_HTML = `<h2>Inicio y Opciones de horarios</h2>
<p>El inicio de clases será con una clase online por la plataforma zoom de 18:30 a 19:30 horas.</p>
<h3>Opciones de horarios</h3>
<p>Al momento de tu matrícula tienes que seleccionar solamente una de las siguientes opciones.</p>
<h4>Opción Miércoles Vespertino Cupos Disponibles</h4>
<ul>
<li>Clase de bienvenida Martes 11 de agosto 2026 de 18:30 a 19:30 hrs.</li>
<li>Inicio clases prácticas: Miércoles 12 de agosto 2026</li>
</ul>
<h4>Opción Jueves AM Cupos Disponibles</h4>
<ul>
<li>Clase de bienvenida Martes 11 de agosto 2026 de 18:30 a 19:30 hrs.</li>
<li>Inicio clases prácticas: Jueves 13 de agosto 2026.</li>
</ul>
<p>&nbsp;</p>
<ul>
<li>Fecha de inscripciones: hasta el Lunes 10 de agosto 2026 a las 13:00 horas.</li>
</ul>
`;

const FORMATO_H4_WITH_NO_UL_HTML = `<h2>Fechas y horarios</h2>
<p>&nbsp;</p>
<h4>Dirigido a empresas, contactar a nuestros teléfonos y correos para contrataciones</h4>
`;

const FORMATO_SINGLE_UNRELATED_H3_HTML = `<h2>Fechas y Horarios de clases</h2>
<p>El curso de masaje tailandés es formato semipresencial y la parte práctica se realizará el día sábado 06 de diciembre 2025 de 9:30 a 18:00 hrs.</p>
<h3>Requisitos</h3>
<ul>
<li>Licenciados y licenciadas en enseñanza media.</li>
<li>Mayores de 18 años.</li>
<li>Para extranjeros con R.U.N. definitivo o provisorio.</li>
</ul>
`;

const PROFESORES_BLOCKS = [
  '<div><h4>Jorge Rojas</h4><ul><li>Licenciado en Kinesiología de la P.U.C.V.</li><li>Diplomado en pedagogía U mayor.</li><li>Certificado en masaje tailandés.</li></ul></div>',
  '<div><h4>Guillermo Leiva</h4><ul><li>Licenciado en Kinesiología UNAB.</li><li>Diplomado en masoterapia OTEC Cenakin.</li></ul></div>',
];

const FORMATO_NESTED_LI_HTML = `<h4>Opción 1</h4>
<ul>
<li>Lunes 18:15 a 22:30 horas.</li>
<li>Inicio prácticas presenciales Lunes 09 marzo 2026</li>
</ul>
<h4>Opción 2</h4>
<ul>
<li style="list-style-type: none;">
<ul>
<li>Miércoles de 9:15 a 13:30 horas.</li>
<li>Inicio prácticas presenciales Miércoles 11 marzo 2026</li>
<li>Finalización Miércoles 16 de diciembre 2026</li>
<li>Clases 1 vez por semana</li>
<li>Inscripciones fuera de plazo hasta el 20 de marzo 2026. Las clases faltantes las recuperas en abril 2026</li>
</ul>
</li>
</ul>
`;

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

test('parseFormatoOptions handles nested ul inside li (real WooCommerce product id 4149)', () => {
  const options = parseFormatoOptions(FORMATO_NESTED_LI_HTML);
  assert.equal(options.length, 2);
  assert.equal(options[0].title, 'Opción 1');
  assert.equal(options[1].title, 'Opción 2');
  // Opción 1: normal list items
  assert.equal(options[0].items.length, 2);
  assert.deepEqual(options[0].items, [
    'Lunes 18:15 a 22:30 horas.',
    'Inicio prácticas presenciales Lunes 09 marzo 2026',
  ]);
  // Opción 2: nested ul extracted from wrapper li, yielding 5 leaf items
  assert.equal(options[1].items.length, 5);
  assert.deepEqual(options[1].items, [
    'Miércoles de 9:15 a 13:30 horas.',
    'Inicio prácticas presenciales Miércoles 11 marzo 2026',
    'Finalización Miércoles 16 de diciembre 2026',
    'Clases 1 vez por semana',
    'Inscripciones fuera de plazo hasta el 20 de marzo 2026. Las clases faltantes las recuperas en abril 2026',
  ]);
});

test('parseFormatoOptions falls back to h3 grouping when no h4 exists (real WooCommerce product id 4479)', () => {
  const options = parseFormatoOptions(FORMATO_H3_FALLBACK_HTML);
  // "Inicio y acceso" has no adjacent <ul> and is dropped; only the populated option survives.
  assert.equal(options.length, 1);
  assert.equal(options[0].title, 'Duración y certificación');
  assert.equal(options[0].items.length, 3);
  assert.equal(
    options[0].items[0],
    'Para obtener el certificado damos un plazo estimado de máximo 6 meses desde la activación del aula virtual.',
  );
});

test('parseFormatoOptions treats a headingless top-level ul as a single option (real WooCommerce product id 4480)', () => {
  const options = parseFormatoOptions(FORMATO_HEADINGLESS_UL_HTML);
  assert.equal(options.length, 1);
  assert.equal(options[0].title, 'Horario');
  assert.deepEqual(options[0].items, [
    'Modalidad: Semi presencial',
    'Inicio: Agosto 2026',
    'Finalización programa: Abril 2027',
    'Clases online desde aula virtual en modalidad asincrónica',
    'Clases presenciales 1 vez por mes días sábados de 9:15 a 18:30 horas.',
    'Inscripciones Hasta Viernes 31 de julio 2026',
  ]);
});

test('parseFormatoOptions ignores an intro h3 and a trailing unclaimed ul when h4 options exist (real WooCommerce product id 3537)', () => {
  const options = parseFormatoOptions(FORMATO_INTRO_H3_AND_TRAILING_UL_HTML);
  assert.equal(options.length, 2);
  assert.equal(options[0].title, 'Opción Miércoles Vespertino Cupos Disponibles');
  assert.equal(options[1].title, 'Opción Jueves AM Cupos Disponibles');
  assert.equal(options[0].items.length, 2);
  assert.equal(options[1].items.length, 2);
  // The trailing "Fecha de inscripciones" ul belongs to no heading and must not leak into option 1.
  assert.ok(!options[1].items.some((item) => item.includes('Fecha de inscripciones')));
});

test('parseFormatoOptions drops an h4 with no adjacent ul (real WooCommerce product id 5490)', () => {
  const options = parseFormatoOptions(FORMATO_H4_WITH_NO_UL_HTML);
  assert.deepEqual(options, []);
});

test('parseFormatoOptions does not treat a single unrelated h3 (e.g. "Requisitos") as a schedule option (real WooCommerce product id 4851)', () => {
  const options = parseFormatoOptions(FORMATO_SINGLE_UNRELATED_H3_HTML);
  assert.deepEqual(options, []);
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
