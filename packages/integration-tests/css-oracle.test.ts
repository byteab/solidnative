/**
 * The browser differential suite.
 *
 * Every other CSS test asserts a value I worked out by reading the spec, which can only ever be
 * as right as that reading. These assert what Chrome actually does with the same stylesheet and
 * the same tree, recorded once by `scripts/generate-css-oracle.mjs` and committed as a fixture, so
 * the tests stay pure `node --test` with no browser to install.
 *
 * Colours are the probe because `getComputedStyle` reports them in the same `rgb(r, g, b)` form
 * our own compiler emits, so what is compared is which declaration won, not how a value was
 * converted. Regenerate the fixture when adding a case.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRequire } from 'node:module';
import { StyleResolver, type StyleSheet, type StyleTarget } from '@solid-native/fabric';
import { CASES, INITIAL, PROPERTIES, type CaseNode } from './fixtures/css-oracle-cases.ts';

const require = createRequire(import.meta.url);
const { compileCss } = require('@solid-native/metro/css/compile.cjs');
const recorded = require('./fixtures/css-oracle.json') as {
  name: string;
  expected: Record<string, string>;
}[];

/** Build the same tree the browser was given, as nodes the resolver understands. */
function build(spec: CaseNode, sheet: StyleSheet, parent: StyleTarget | null): StyleTarget[] {
  const node: StyleTarget = {
    name: spec.name,
    parent,
    classes: new Set(spec.classes ?? []),
    // An id is `nativeID` here, which is the prop React Native gives a view for the purpose.
    props: { ...(spec.id ? { nativeID: spec.id } : {}), ...(spec.attrs ?? {}) },
    sheet,
    hostSheet: null,
    styleCache: null,
    styleDirty: true,
  };
  return [node, ...(spec.children ?? []).flatMap((child) => build(child, sheet, node))];
}

/** CSS property name to the React Native style key it lands in. */
const RN_KEY: Record<string, string> = { color: 'color', 'background-color': 'backgroundColor' };

describe('what a browser does with the same stylesheet', () => {
  assert.equal(recorded.length, CASES.length, 'the fixture is stale; regenerate it');

  CASES.forEach((test, index) => {
    it(test.name, () => {
      const expected = recorded[index]!;
      assert.equal(expected.name, test.name, 'the fixture is out of step with the cases');

      const sheet = compileCss(test.css, test.name) as StyleSheet;
      const nodes = build(test.tree as CaseNode, sheet, null);
      const probe = nodes.find((node) => node.props['nativeID'] === 'probe')!;
      // Resolve every node, as a commit does, so inherited values and tokens flow down.
      const resolver = new StyleResolver(null, { width: 0, height: 0, colorScheme: 'light' });
      for (const node of nodes) resolver.resolve(node, 1);
      const style = resolver.resolve(probe, 1).style;

      for (const property of PROPERTIES) {
        const browser = expected.expected[property]!;
        const ours = style[RN_KEY[property]!];
        if (browser === INITIAL[property]) {
          // The browser always reports a value; we report nothing when no rule set one, which
          // leaves the native default in place.
          assert.equal(ours, undefined, `${property}: no rule should have matched`);
        } else {
          assert.equal(ours, browser, property);
        }
      }
    });
  });
});
