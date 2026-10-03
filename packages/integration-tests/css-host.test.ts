/**
 * `:host`, which is not merely unimplemented without this but unreachable.
 *
 * A component's host node is created in its *parent's* tree, so it belongs to the parent's
 * sheet. The component therefore tags its host with its own sheet (`setNativeStyleHost`), and a
 * `:host` compound matches a node whose tag is the sheet currently being evaluated.
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { createRequire } from 'node:module';
import { StyleResolver, matches, type StyleTarget } from '@solid-native/fabric';
import { mountSolid } from './css-solid-harness.ts';
import { hostParent } from './css-solid-fixtures.tsx';

const require = createRequire(import.meta.url);
const { compileCss } = require('@solid-native/metro/css/compile.cjs');

describe(':host', () => {
  let mounted: ReturnType<typeof mountSolid> | undefined;

  const boot = (dark: boolean) => {
    mounted?.root.dispose();
    const fixture = hostParent();
    mounted = mountSolid(fixture.View);
    fixture.setDark(dark);
    mounted.settle();
  };

  afterEach(() => mounted?.root.dispose());

  const hosts = () => mounted!.nodes().filter((n) => n.props['backgroundColor'] !== undefined);
  const labels = () => mounted!.nodes().filter((n) => n.viewName === 'Paragraph');

  it("styles the child's own host node from the child's sheet", () => {
    boot(false);
    assert.deepEqual(
      hosts().map((n) => n.props['backgroundColor']),
      ['rgb(1, 1, 1)', 'rgb(2, 2, 2)'],
      ':host applied to both, and :host(.active) beat it on the second',
    );
  });

  it('does not leak :host onto the elements inside the component', () => {
    boot(false);
    assert.deepEqual(
      labels().map((n) => n.props['backgroundColor']),
      [undefined, undefined],
    );
  });

  it("does not style the host from the child's plain rules, only its :host ones", () => {
    // The parent puts class="active" on the second kid. The kid's own .active rule is for
    // elements inside it, so the host, which belongs to the parent's sheet, is left alone.
    boot(false);
    assert.deepEqual(
      hosts().map((n) => n.props['paddingTop']),
      [undefined, undefined],
    );
  });

  it('matches a descendant through `:host .label`', () => {
    boot(false);
    assert.deepEqual(
      labels().map((n) => n.props['color']),
      ['rgb(3, 3, 3)', 'rgb(3, 3, 3)'],
    );
  });

  it('applies :host-context only when an ancestor matches', () => {
    boot(false);
    assert.deepEqual(
      labels().map((n) => n.props['letterSpacing']),
      [undefined, undefined],
    );

    boot(true);
    assert.deepEqual(
      labels().map((n) => n.props['letterSpacing']),
      [4, 4],
    );
  });
});

describe('a host node, straight from the resolver', () => {
  const hostOf = (hostSheet: StyleTarget['hostSheet'], classes: string[]): StyleTarget => ({
    name: 'view',
    parent: null,
    classes: new Set(classes),
    props: {},
    sheet: null,
    hostSheet,
    styleCache: null,
    styleDirty: true,
  });

  it('matches :host-context() on the host itself, as well as on its ancestors', () => {
    const sheet = compileCss(':host-context(.dark) { color: red }', 'host');
    assert.equal(matches(hostOf(sheet, ['dark']), sheet.rules[0], sheet), true);
    assert.equal(matches(hostOf(sheet, []), sheet.rules[0], sheet), false);
  });

  it('reads a bare name in :host-context() as an element type', () => {
    const sheet = compileCss(':host-context(view) { color: red }', 'host');
    assert.equal(matches(hostOf(sheet, []), sheet.rules[0], sheet), true, 'the host is a view');
    const text = compileCss(':host-context(text) { color: red }', 'host');
    assert.equal(matches(hostOf(text, []), text.rules[0], text), false);
  });

  it("gives the component's :host rules a class of weight over the global sheet's", () => {
    // `:host` is one class of specificity, and a component's rules gain one more, as
    // emulated encapsulation would grant them: enough to beat a global rule of a type and a class.
    const global = compileCss('view.card { color: red }', 'global');
    const own = compileCss(':host { color: blue }', 'host');
    const resolver = new StyleResolver(global, { width: 400, height: 800, colorScheme: 'light' });
    assert.equal(resolver.resolve(hostOf(own, ['card']), 1).style['color'], 'rgb(0, 0, 255)');
  });
});
