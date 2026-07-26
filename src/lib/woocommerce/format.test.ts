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
