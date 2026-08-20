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
