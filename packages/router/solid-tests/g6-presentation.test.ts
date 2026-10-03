import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createNativeRoot } from '@solid-native/platform/solid';
import {
  createClock,
  createFakeFabric,
  type FakeNode,
} from '../../platform/solid-tests/fake-fabric.ts';
import { createPresentationFixture } from './g6-presentation-fixture.tsx';

const flatten = (nodes: readonly FakeNode[]): FakeNode[] =>
  nodes.flatMap((node) => [node, ...flatten(node.children)]);
const tick = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
function mount() {
  const fabric = createFakeFabric();
  const root = createNativeRoot({ fabric, clock: createClock(), rootTag: 1 });
  const fixture = createPresentationFixture();
  root.render(fixture.View);
  const find = (id: string) => {
    const node = flatten(fabric.roots.get(1) ?? []).find((node) => node.props['testID'] === id);
    assert.ok(node, `Committed ${id}`);
    return node;
  };
  const settle = (id = 'root-stack') => {
    root.flush();
    fabric.emit(find(id), 'topFinishTransitioning');
    root.flush();
  };
  const screen = () => {
    root.flush();
    return find('root-stack').children.at(-1)!;
  };
  return { fixture, nav: fixture.nav, root, fabric, find, settle, screen };
}

test('present commits native sheet props with runtime precedence and leaves the route definition intact', async (t) => {
  const { nav, fixture, root, settle, screen } = mount();
  t.after(() => root.dispose());
  await nav.reset('/');
  settle();
  const underneath = nav.current();
  const presentation = {
    sheetAllowedDetents: [0.5, 1],
    sheetGrabberVisible: false,
    fullScreenSwipeEnabled: false,
    gestureResponseDistance: { bottom: 18 },
  };
  assert.equal(
    await nav.present('/sheet?returnUrl=%2Faccount%3Ftab%3Dprofile#code', {
      as: 'formSheet',
      presentation,
    }),
    true,
  );
  assert.equal(nav.url(), '/sheet?returnUrl=%2Faccount%3Ftab%3Dprofile#code');
  assert.equal(screen().viewName, 'RNSScreen');
  assert.equal(screen().props['stackPresentation'], 'formSheet');
  assert.equal(screen().props['stackAnimation'], 'fade');
  assert.equal(screen().props['sheetGrabberVisible'], false);
  assert.deepEqual(screen().props['sheetAllowedDetents'], [0.5, 1]);
  assert.deepEqual(screen().props['gestureResponseDistance'], {
    start: -1,
    end: -1,
    top: -1,
    bottom: 18,
  });
  assert.equal(screen().props['fullScreenSwipeEnabled'], 'false');
  assert.equal(nav.entries()[0], underneath);
  assert.equal(underneath!.owner.disposed, false);
  assert.equal(
    fixture.routes.find((route) => route.path === 'sheet')!.presentation!.stackPresentation,
    'pageSheet',
  );
  settle();
  assert.equal(await nav.pop(), true);
  assert.equal(fixture.cleanups.length, 0);
  settle();
  assert.deepEqual(fixture.cleanups, ['/sheet?returnUrl=%2Faccount%3Ftab%3Dprofile#code']);
  assert.equal(nav.current(), underneath);
});

test('present defaults to modal, explicit stackPresentation wins and ordinary pushes inherit only its mode', async (t) => {
  const { nav, root, settle, screen } = mount();
  t.after(() => root.dispose());
  await nav.reset('/');
  settle();
  await nav.present('/sheet');
  assert.equal(screen().props['stackPresentation'], 'modal');
  settle();
  await nav.push('/plain');
  assert.equal(screen().props['stackPresentation'], 'modal');
  assert.equal(screen().props['sheetGrabberVisible'], undefined);
  settle();
  await nav.push('/plain', { presentation: { stackPresentation: 'push', stackAnimation: 'none' } });
  assert.equal(screen().props['stackPresentation'], 'push');
  settle();
  await nav.present('/plain', {
    as: 'formSheet',
    presentation: { stackPresentation: 'fullScreenModal' },
  });
  assert.equal(screen().props['stackPresentation'], 'fullScreenModal');
  settle();
  await nav.reset('/plain');
  assert.equal(screen().props['stackPresentation'], 'push');
});

test('native overlap refuses present without mutation and native cancellation restores the retained owner', async (t) => {
  const { nav, fixture, root, settle, screen, fabric, find } = mount();
  t.after(() => root.dispose());
  await nav.reset('/');
  settle();
  const underneath = nav.current();
  await nav.present('/plain', { as: 'formSheet' });
  const transition = nav.transition();
  const stale = nav.nativeEvents(transition);
  const entry = nav.current();
  const committed = screen();
  assert.equal(await nav.present('/sheet', { as: 'fullScreenModal' }), false);
  assert.equal(nav.current(), entry);
  assert.equal(nav.transition(), transition);
  assert.equal(screen(), committed);
  fabric.emit(committed, 'topGestureCancel');
  root.flush();
  assert.equal(nav.current(), underneath);
  assert.equal(nav.transition(), null);
  assert.equal(entry!.owner.disposed, true);
  assert.equal(underneath!.owner.disposed, false);
  assert.deepEqual(fixture.cleanups, ['/plain']);
  await nav.present('/sheet', { as: 'pageSheet' });
  root.flush();
  assert.equal(stale.finish(), false);
  assert.ok(nav.transition());
  fabric.emit(find('root-stack'), 'topFinishTransitioning');
  root.flush();
  assert.equal(nav.transition(), null);
});

test('async request snapshots presentation and supersession, denial, failure and redirect keep overrides local', async (t) => {
  const { nav, fixture, root, settle, screen } = mount();
  t.after(() => root.dispose());
  await nav.reset('/');
  settle();
  const pending = nav.present('/guarded', { as: 'formSheet' });
  await tick();
  assert.equal(await nav.push('/plain'), true);
  assert.equal(await pending, false);
  assert.equal(fixture.signals[0]!.aborted, true);
  assert.equal(screen().props['stackPresentation'], 'push');
  settle();
  fixture.guard.resolve(true);
  await tick();
  assert.equal(nav.url(), '/plain');
  assert.equal(await nav.present('/denied', { as: 'formSheet' }), false);
  assert.equal(await nav.present('/broken', { as: 'formSheet' }), false);
  assert.equal(await nav.push('/plain'), true);
  assert.equal(screen().props['stackPresentation'], 'push');
  settle();
  assert.equal(await nav.present('/redirect', { as: 'formSheet' }), true);
  assert.equal(nav.url(), '/sheet?returnUrl=%2Faccount%3Ftab%3Dprofile#code');
  assert.equal(screen().props['stackPresentation'], 'formSheet');
  assert.match(String(fixture.errors[0]), /presentation lazy failure/);
});

test('runtime presentation is captured before awaiting the guard including mutable nested values', async (t) => {
  const { nav, fixture, root, settle, screen } = mount();
  t.after(() => root.dispose());
  await nav.reset('/');
  settle();
  const presentation = { sheetAllowedDetents: [0.5, 1], gestureResponseDistance: { bottom: 18 } };
  const pending = nav.present('/guarded', { as: 'formSheet', presentation });
  await tick();
  presentation.sheetAllowedDetents[0] = 0.1;
  presentation.gestureResponseDistance.bottom = 99;
  fixture.guard.resolve(true);
  assert.equal(await pending, true);
  assert.deepEqual(screen().props['sheetAllowedDetents'], [0.5, 1]);
  assert.deepEqual(screen().props['gestureResponseDistance'], {
    start: -1,
    end: -1,
    top: -1,
    bottom: 18,
  });
});

test('presenting a nested route creates one fresh outer sheet and preserves original ancestry on dismiss', async (t) => {
  const { nav, fixture, root, settle, screen, find, fabric } = mount();
  t.after(() => root.dispose());
  await nav.reset('/layout/alpha/first');
  settle();
  const underneath = nav.current()!;
  const leaf = underneath.children!.current()!;
  const originalTag = find('page:/layout/alpha/first').tag;
  assert.equal(
    await nav.present('/layout/alpha?returnUrl=%2Faccount#nested', { as: 'formSheet' }),
    true,
  );
  assert.equal(nav.entries().length, 2);
  assert.notEqual(nav.current(), underneath);
  assert.equal(nav.url(), '/layout/alpha/first?returnUrl=%2Faccount#nested');
  assert.equal(screen().props['stackPresentation'], 'formSheet');
  const screens = flatten([screen()]).filter((node) => node.viewName === 'RNSScreen');
  assert.equal(screens.length, 2);
  assert.equal(screens[1]!.props['stackPresentation'], 'push');
  assert.deepEqual(
    { ...nav.current()!.children!.current()!.route.params },
    { account: 'alpha', page: 'first' },
  );
  settle();
  const presented = nav.current()!;
  fabric.emit(screen(), 'topDismissed', { dismissCount: 1 });
  root.flush();
  assert.equal(nav.current(), underneath);
  assert.equal(underneath.children!.current(), leaf);
  assert.equal(find('page:/layout/alpha/first').tag, originalTag);
  assert.equal(presented.owner.disposed, true);
  assert.equal(presented.children!.disposed, true);
  assert.equal(fixture.cleanups.length, 2);
  assert.deepEqual(fixture.errors, []);
});

test('push inside a presented layout uses the inner stack and applies an override only to its new child', async (t) => {
  const { nav, root, settle, screen } = mount();
  t.after(() => root.dispose());
  await nav.reset('/');
  settle();
  await nav.present('/layout/alpha/first', { as: 'formSheet' });
  settle();
  const outer = nav.current()!;
  const children = outer.children!;
  await children.push('/layout/alpha/second', { presentation: { stackAnimation: 'fade' } });
  assert.equal(nav.current(), outer);
  assert.equal(nav.entries().length, 2);
  assert.equal(nav.transition(), null);
  assert.ok(children.transition());
  assert.equal(await children.present('/plain'), false);
  const screens = flatten([screen()]).filter((node) => node.viewName === 'RNSScreen');
  assert.equal(screens[0]!.props['stackPresentation'], 'formSheet');
  assert.equal(screens[1]!.props['stackAnimation'], undefined);
  assert.equal(screens[2]!.props['stackPresentation'], 'push');
  assert.equal(screens[2]!.props['stackAnimation'], 'fade');
  settle('nested-stack');
  assert.equal(await nav.back(), true);
  settle('nested-stack');
  assert.equal(nav.current(), outer);
  assert.equal(nav.url(), '/layout/alpha/first');
});

test('disposing during presentation preparation aborts work and never constructs the destination', async () => {
  const { nav, fixture, root, settle } = mount();
  await nav.reset('/');
  settle();
  const pending = nav.present('/guarded', { as: 'formSheet' });
  await tick();
  root.dispose();
  assert.equal(await pending, false);
  assert.equal(fixture.signals[0]!.aborted, true);
  fixture.guard.resolve(true);
  await tick();
  assert.deepEqual(fixture.constructions, ['/']);
  assert.deepEqual(fixture.cleanups, ['/']);
  assert.deepEqual(fixture.errors, []);
});
