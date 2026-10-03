/**
 * A presented screen that must not be swiped away while it holds unsaved changes, and has to hear
 * the attempt to ask about them. The guard binds to the page's own retained native screen.
 */
import assert from 'node:assert/strict';
import { it } from 'node:test';
import { createNativeRoot } from '@solid-native/platform/solid';
import { createClock, createFakeFabric, type FakeFabricNode } from '@solid-native/testing';
import { createDismissFixture } from './ui-dismiss-fixture.tsx';

const flatten = (nodes: readonly FakeFabricNode[]): FakeFabricNode[] =>
  nodes.flatMap((node) => [node, ...flatten(node.children)]);

function mount() {
  const fabric = createFakeFabric();
  const root = createNativeRoot({ fabric, clock: createClock(), rootTag: 1 });
  const fixture = createDismissFixture();
  root.render(fixture.View);
  const nodes = () => flatten(fabric.committed);
  const screens = () => {
    root.flush();
    return nodes().filter((node) => node.viewName === 'RNSScreen');
  };
  const settle = async () => {
    for (let turn = 0; turn < 5; turn++) {
      for (let i = 0; i < 20; i++) await Promise.resolve();
      root.flush();
      const stack = nodes().find((node) => node.props['testID'] === 'root-stack');
      if (stack) fabric.emit(stack, 'topFinishTransitioning');
      root.flush();
    }
  };
  return { fabric, root, fixture, screens, settle };
}

it('refuses a swipe down while dirty, and hears it', async (t) => {
  const { fabric, root, fixture, screens, settle } = mount();
  t.after(() => root.dispose());
  await fixture.nav.reset('/');
  await settle();
  await fixture.nav.present('/editor', { as: 'formSheet' });
  await settle();
  const editor = () => screens().at(-1)!;
  const page = fixture.editors.at(-1)!;

  assert.notEqual(
    editor().props['preventNativeDismiss'],
    true,
    'a clean editor can be swiped away',
  );
  page.setDirty(true);
  root.flush();
  assert.equal(editor().props['preventNativeDismiss'], true);

  fabric.emit(editor(), 'topNativeDismissCancelled', { dismissCount: 1 });
  root.flush();
  assert.equal(page.attempts(), 1, 'the page heard the attempt');

  page.setDirty(false);
  root.flush();
  fabric.emit(editor(), 'topNativeDismissCancelled', { dismissCount: 1 });
  assert.equal(page.attempts(), 1, 'a clean page is not asked');
});

it('presents once for a double tap, and one back closes it', async (t) => {
  const { root, fixture, screens, settle } = mount();
  t.after(() => root.dispose());
  await fixture.nav.reset('/');
  await settle();
  // Two taps before the first presentation has finished.
  const first = fixture.nav.present('/editor', { as: 'formSheet' });
  const second = fixture.nav.present('/editor', { as: 'formSheet' });
  await settle();
  await Promise.all([first, second]);
  await settle();
  assert.equal(screens().length, 2, 'the home screen and one sheet');
  void fixture.nav.back();
  await settle();
  assert.equal(screens().length, 1);
});
