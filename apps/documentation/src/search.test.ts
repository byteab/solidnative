import { expect, test } from 'vitest';
import { routeFor } from './search.ts';

test("a Pagefind URL becomes the router's, anchor and all", () => {
  expect(routeFor('/guide/offline/')).toBe('/guide/offline');
  expect(routeFor('/packages/router/header/#options')).toBe('/packages/router/header#options');
  expect(routeFor('/')).toBe('/');
});
