import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchProduct } from './client.ts';

test('fetchProduct throws with the HTTP status on a non-2xx response', async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response('{"code":"woocommerce_rest_product_invalid_id"}', { status: 404 });
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  await assert.rejects(() => fetchProduct('999999'), /HTTP 404/);
});

test('fetchProduct returns the parsed product on a 200 response', async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ id: 5571, name: 'Test' }), { status: 200 });
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const product = await fetchProduct('5571');
  assert.equal(product.id, 5571);
  assert.equal(product.name, 'Test');
});

test('isInCoursesCategory is true only when the product has category 22', async () => {
  const { isInCoursesCategory } = await import('./client.ts');
  assert.equal(isInCoursesCategory({ categories: [{ id: 22, name: 'Cursos', slug: 'cursos' }, { id: 51, name: 'Masoterapia', slug: 'masoterapia' }] }), true);
  assert.equal(isInCoursesCategory({ categories: [{ id: 51, name: 'Masoterapia', slug: 'masoterapia' }] }), false);
  assert.equal(isInCoursesCategory({ categories: [] }), false);
});
