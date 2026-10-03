/**
 * A style written as a string, which is the form this project's own doc comments recommend.
 *
 * `<view style="flex: 1">` reaches the renderer as one `style` prop holding the whole string. A
 * style flattener that merges objects and arrays of objects and lets a string fall through would
 * compile the declaration, commit nothing, and say nothing about it. A unitless number written in
 * a string must also reach Fabric as the number `1`, as the object form gives it: Yoga wants a
 * number, and two forms of the same declaration disagreeing is its own bug.
 */
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { mountSolid } from './css-solid-harness.ts';
import { styleForms } from './css-solid-fixtures.tsx';

describe('the four ways to write a style', () => {
  let props: Record<string, Record<string, unknown>>;

  before(() => {
    const mounted = mountSolid(styleForms());
    props = Object.fromEntries(
      ['static', 'bound-string', 'bound-object', 'single'].map((id) => [
        id,
        mounted.byId(id).props,
      ]),
    );
    mounted.root.dispose();
  });

  it('commits a static string attribute', () => {
    assert.equal(props['static']!['flex'], 1);
    assert.equal(props['static']!['marginTop'], 4);
  });

  it('commits a bound string', () => {
    assert.equal(props['bound-string']!['flex'], 1);
    assert.equal(props['bound-string']!['marginTop'], 5);
  });

  it('commits an object, which is the form that always worked', () => {
    assert.equal(props['bound-object']!['flex'], 1);
    assert.equal(props['bound-object']!['marginTop'], 6);
  });

  it('commits a single property with a unit', () => {
    assert.equal(props['single']!['marginTop'], 7);
  });

  it('agrees with itself: every form gives the same node the same props', () => {
    // The point of the other four. A design that reads `flex: 1` should not depend on which of
    // four spellings the author reached for.
    assert.deepEqual(
      new Set(['static', 'bound-string', 'bound-object'].map((id) => props[id]!['flex'])),
      new Set([1]),
    );
  });
});
