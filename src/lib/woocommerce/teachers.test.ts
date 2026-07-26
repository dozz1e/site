import { test } from 'node:test';
import assert from 'node:assert/strict';
import teachers from '../../data/teachers.json' with { type: 'json' };

const EXPECTED_NAMES = [
  'Camila González',
  'Guillermo Leiva',
  'Jorge Patricio Rojas Sánchez',
  'Jorge Rojas',
  'Jorge Rojas S',
  'Tamara Bahamondes',
];

test('teachers.json has an entry for every known ACF name variant', () => {
  for (const name of EXPECTED_NAMES) {
    assert.ok(name in teachers, `missing teacher entry: ${name}`);
    assert.ok(teachers[name].photo.startsWith('/images/'));
    assert.ok(teachers[name].summary.length > 0);
    assert.ok(teachers[name].tags.length > 0);
  }
});

test('the three Jorge Rojas name variants share the same photo (same person)', () => {
  assert.equal(teachers['Jorge Rojas'].photo, teachers['Jorge Rojas S'].photo);
  assert.equal(teachers['Jorge Rojas'].photo, teachers['Jorge Patricio Rojas Sánchez'].photo);
});
