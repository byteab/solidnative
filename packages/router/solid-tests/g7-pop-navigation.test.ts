import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createNativeRoot } from '@solidnative/platform/solid';
import { createClock, createFakeFabric } from '../../platform/solid-tests/fake-fabric.ts';
import { createPresentationFixture } from './g6-presentation-fixture.tsx';

function nestedNavigation() {
  const root = createNativeRoot({ fabric: createFakeFabric(), clock: createClock(), rootTag: 1 });
  const fixture = createPresentationFixture();
  root.render(fixture.View);
  function settle() {
    const walk = (nav: typeof fixture.nav) => {
      for (const entry of nav.entries()) if (entry.children) walk(entry.children);
      const transition = nav.transition();
      if (transition) nav.complete(transition);
    };
    walk(fixture.nav);
    root.flush();
  }
  return { fixture, root, nav: fixture.nav, settle };
}

test('popTo awaiting a nested miss cannot supersede a newer pending navigation request', async (t) => {
  const { fixture, root, nav, settle } = nestedNavigation();
  t.after(() => root.dispose());
  await nav.reset(['/plain', '/layout/a/first']);
  settle();
  const popping = nav.popTo('/plain');
  const pushing = nav.push('/guarded');
  const popped = await popping;
  fixture.guard.resolve(true);
  const pushed = await pushing;
  assert.equal(popped, false, 'the older awaiting pop must not replace the newer intent');
  assert.equal(pushed, true);
  assert.equal(nav.url(), '/guarded');
});

test('popTo awaiting a nested miss resolves false if navigation is disposed before it resumes', async (t) => {
  const { root, nav, settle } = nestedNavigation();
  t.after(() => root.dispose());
  await nav.reset(['/plain', '/layout/a/first']);
  settle();
  const popping = nav.popTo('/plain');
  root.dispose();
  assert.equal(await popping, false);
});
