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
