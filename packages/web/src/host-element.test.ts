/**
 * A wrapped root answers `tagName` with its template name, as every node this package makes
 * does: a web root is a wrapper, not the element it wraps.
 */
import assert from 'node:assert/strict';
import { it } from 'node:test';
import { makeElementNode } from './dom-node.ts';
import { installJsdomEnvironment } from './jsdom-env.ts';

it('a wrapped node answers tagName with its template name', () => {
  const { document } = installJsdomEnvironment();
  assert.equal(makeElementNode('view', document.createElement('div')).tagName, 'view');
});
