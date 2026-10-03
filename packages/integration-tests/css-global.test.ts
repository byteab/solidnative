/**
 * The application-level sheet: the one set of rules allowed to cross a component boundary.
 *
 * Precedence is not a separate tier. Global and component rules cascade together by specificity,
 * with component rules given one extra class - the weight an emulated-encapsulation attribute
 * would add to a scoped rule.
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { createRequire } from 'node:module';
import { mountSolid } from './css-solid-harness.ts';
import { globalRows, globalStyled } from './css-solid-fixtures.tsx';

const require = createRequire(import.meta.url);
const { compileCss } = require('@solidnative/metro/css/compile.cjs');

let mounted: ReturnType<typeof mountSolid> | undefined;
afterEach(() => mounted?.root.dispose());

/** Mounts a fixture under a global sheet, disposing whatever the last boot mounted. */
const mountUnder = (view: () => unknown, css: string) => {
  mounted?.root.dispose();
  mounted = mountSolid(view, { globalStyles: compileCss(css, 'global') });
  return mounted;
};
const rowNodes = () =>
  mounted!.nodes().filter((n) => /^row/.test(String(n.props['nativeID'] ?? '')));

/**
 * Structural selectors from the *global* sheet.
 *
 * They are covered for a component's own styles already. This is the other half, and it is the
 * half an application sheet is for: a list striped by a rule the list's component never declared.
 */
describe('position pseudo-classes in the global sheet', () => {
  const bootRows = (css: string) => {
    mountUnder(globalRows(), css);
    return rowNodes;
  };

  it('picks the first and the last', () => {
    const rowsOf = bootRows(`
      .row:first-child { border-top-width: 2px }
      .row:last-child { border-bottom-width: 4px }
    `);
    const all = rowsOf();
    assert.equal(all.length, 3);
    assert.equal(all[0]!.props['borderTopWidth'], 2);
    assert.equal(all[2]!.props['borderBottomWidth'], 4);
    assert.equal(all[1]!.props['borderTopWidth'], undefined);
  });

  /**
   * A `var()` is resolved when a node matches rather than when the sheet is compiled, so it
   * travels as a deferred declaration beside the plain ones. Applying the deferred set after the
   * plain set would make a token beat anything, whatever the cascade says - here a one-class rule
   * would repaint over a rule with a pseudo-class on top of it.
   */
  it('does not let a token jump the cascade', () => {
    const rowsOf = bootRows(`
      :root { --surface: rgb(240, 240, 245) }
      .row { background-color: var(--surface) }
      .row:nth-child(odd) { background-color: rgb(38, 38, 48) }
    `);
    const all = rowsOf();
    assert.equal(
      all[0]!.props['backgroundColor'],
      'rgb(38, 38, 48)',
      'the more specific rule wins',
    );
    assert.equal(all[1]!.props['backgroundColor'], 'rgb(240, 240, 245)');
    assert.equal(all[2]!.props['backgroundColor'], 'rgb(38, 38, 48)');
  });

  it('stripes with nth-child, which is the reason to write one in a global sheet at all', () => {
    const rowsOf = bootRows('.row:nth-child(odd) { background-color: #eee }');
    const all = rowsOf();
    assert.equal(all[0]!.props['backgroundColor'], 'rgb(238, 238, 238)');
    assert.equal(all[1]!.props['backgroundColor'], undefined);
    assert.equal(all[2]!.props['backgroundColor'], 'rgb(238, 238, 238)');
  });
});

describe('the global sheet', () => {
  const boot = (css: string) => void mountUnder(globalStyled(), css);

  const byId = (id: string) => mounted!.byId(id);
  const box = () => byId('box');
  const label = () => mounted!.nodes().find((n) => n.viewName === 'Paragraph')!;

  it('reaches inside a component, which no other sheet may', () => {
    boot('.box { background-color: rgb(9, 9, 9) }');
    assert.equal(box().props['backgroundColor'], 'rgb(9, 9, 9)');
  });

  it('loses to a component rule of the same specificity, as a scoping attribute would', () => {
    // Both are one class. The component's carries one extra class of weight.
    boot('.box { padding: 40px }');
    assert.equal(box().props['paddingTop'], 2);
  });

  it('wins when it is genuinely more specific than the component rule', () => {
    // The component's one-class rule is worth two after the bump, so `.box.box` only ties with it
    // and loses on source order. Three classes genuinely beats it. Nothing makes the global sheet
    // weaker in kind, it is simply one class behind.
    boot('.box.box { padding: 40px }');
    assert.equal(
      box().props['paddingTop'],
      2,
      'two classes only ties, and a tie goes to the component',
    );

    boot('.box.box.box { padding: 40px }');
    assert.equal(box().props['paddingTop'], 40);
  });

  it('honours !important from the global sheet over a component rule', () => {
    boot('.box { padding: 40px !important }');
    assert.equal(box().props['paddingTop'], 40);
  });

  it('inherits from the global sheet down through components', () => {
    boot('.plain { color: rgb(7, 7, 7) }');
    assert.equal(byId('plain-text').props['color'], 'rgb(7, 7, 7)');
  });

  it('still lets a component rule win on the element it owns', () => {
    boot('.label { color: rgb(7, 7, 7) }');
    assert.equal(label().props['color'], 'rgb(1, 1, 1)');
  });
});

/**
 * `ios:` and `android:` from `@solidnative/tailwind` compile to `.platform-ios <rule>`: they match
 * beneath a class naming the platform. `createNativeRoot` puts that class on the root itself, so a
 * platform variant works in a new app with nothing to set up - otherwise the app would have to know
 * to add it, and one that did not would get variants that silently did nothing.
 */
describe('the platform class on the root', () => {
  it('lets a platform-scoped rule match with no class added by the app', () => {
    mountUnder(
      globalRows(),
      '.platform-ios .row { padding-top: 8px } .platform-android .row { padding-top: 30px }',
    );
    const rows = rowNodes();
    assert.equal(rows[0]!.props['paddingTop'], 8, 'the ios rule, since the test platform is ios');
  });
});
