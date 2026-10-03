import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createNativeRoot } from '@solid-native/platform/solid';
import { matchRoutePath, parseRouteLocation } from '../src/solid/route-match.ts';
import { createNavigationFixture } from './navigation-fixture.tsx';
import {
  createClock,
  createFakeFabric,
  type FakeNode,
} from '../../platform/solid-tests/fake-fabric.ts';

function flatten(nodes: readonly FakeNode[]): FakeNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}
async function mount() {
  const fabric = createFakeFabric();
  const clock = createClock();
  const fixture = createNavigationFixture();
  const root = createNativeRoot({ fabric, clock, rootTag: 1 });
  root.render(fixture.View);
  const find = (id: string) => {
    const node = flatten(fabric.roots.get(1) ?? []).find((node) => node.props['testID'] === id);
    assert.ok(node, `Committed ${id}`);
    return node;
  };
  const settle = () => {
    root.flush();
    fabric.emit(find('native-stack'), 'topFinishTransitioning');
    root.flush();
  };
  assert.equal(await fixture.navigation.reset('/'), true);
  settle();
  return { fixture, nav: fixture.navigation, fabric, clock, root, find, settle };
}

test('path matching decodes params/query/fragment, handles relative paths and rejects external URLs', () => {
  const location = parseRouteLocation(
    '../plain/a%2Fb?name=a+b&name=c%20d&empty#frag%20ment',
    '/item/old',
  );
  assert.equal(location.pathname, '/plain/a%2Fb');
  assert.deepEqual(location.query['name'], ['a b', 'c d']);
  assert.equal(location.query['empty'], '');
  assert.equal(location.fragment, 'frag ment');
  assert.equal(matchRoutePath('/plain/:id', location.pathname)?.params['id'], 'a/b');
  assert.equal(matchRoutePath('/plain/*', location.pathname)?.params['*'], 'a/b');
  assert.equal(matchRoutePath('/plain/:id', '/plain'), undefined);
  assert.equal(matchRoutePath('/literal', '/other'), undefined);
  assert.equal(parseRouteLocation('?x=1', '/plain/a').pathname, '/plain/a');
  assert.equal(parseRouteLocation('#x', '/plain/a').pathname, '/plain/a');
  assert.throws(() => parseRouteLocation('https://example.com/a'), /external URLs/);
  assert.throws(() => parseRouteLocation('/%zz'), URIError);
  const query = parseRouteLocation('/?__proto__=safe').query;
  assert.equal(query['__proto__'], 'safe');
});

test('compiled outlet registers actual native stack/screens and hoists real header configs', async () => {
  const { nav, root, find, settle } = await mount();
  const stack = find('native-stack');
  assert.equal(stack.viewName, 'RNSScreenStack');
  assert.equal(stack.children[0]?.viewName, 'RNSScreen');
  const first = nav.current()!;
  const firstTag = stack.children[0]!.tag;
  assert.equal(stack.children[0]!.props['activityState'], 2);
  assert.equal(stack.children[0]!.props['position'], 'absolute');
  assert.ok(
    stack.children[0]!.children.some((node) => node.viewName === 'RNSScreenStackHeaderConfig'),
  );
  assert.equal(find('header:/').props['title'], 'title:/');
  assert.equal(await nav.push('/item/12?id=query&gone=yes#details'), true);
  const entry = nav.current()!;
  assert.equal(entry.route.params['id'], '12');
  assert.equal(entry.route.inputs['id'], 'resolved:12');
  assert.equal(entry.route.fragment, 'details');
  assert.equal(entry.route.inputs['gone'], 'yes');
  settle();
  assert.equal(find('native-stack').children[0]!.tag, firstTag);
  assert.equal(first.owner.disposed, false);
  assert.equal(first.inFront(), false);
  assert.equal(entry.inFront(), true);
  assert.equal(await nav.push('/item/new'), true);
  assert.equal(
    nav.current()!.route.inputs['id'],
    undefined,
    'literal route outranks parameter route; missing inputs clear',
  );
  settle();
  assert.equal(await nav.push('/sheet'), true);
  root.flush();
  const sheet = find('native-stack').children.at(-1)!;
  assert.equal(sheet.props['stackPresentation'], 'formSheet');
  assert.equal(sheet.props['fullScreenSwipeEnabled'], 'true');
  assert.deepEqual(sheet.props['sheetAllowedDetents'], [0.5, 1]);
  settle();
  root.dispose();
});

test('pop detaches native projection but retains owner until completion; cancellation restores identity', async () => {
  const { nav, fixture, root, find, fabric, settle } = await mount();
  await nav.push('/plain/second');
  settle();
  const second = nav.current()!;
  const secondNative = find('native-stack').children.at(-1)!;
  await nav.pop();
  const pop = nav.transition()!;
  const stale = nav.nativeEvents(pop);
  root.flush();
  assert.equal(find('native-stack').children.length, 1);
  assert.equal(second.owner.node.parent, null);
  assert.equal(second.owner.disposed, false);
  assert.deepEqual(fixture.cleanups, []);
  fabric.emit(secondNative, 'topDismissed', { dismissCount: 1 });
  assert.equal(nav.transition(), pop, 'outgoing detached native events cannot settle the stack');
  assert.equal(nav.cancel(pop), true);
  root.flush();
  assert.equal(find('native-stack').children.at(-1)!.tag, secondNative.tag);
  assert.equal(nav.current(), second);
  await nav.pop();
  assert.equal(stale.finish(), false);
  assert.equal(stale.cancelled(second.key), false);
  assert.equal(second.owner.disposed, false);
  settle();
  assert.equal(second.owner.disposed, true);
  assert.deepEqual(fixture.cleanups, ['/plain/second']);
  assert.equal(secondNative.instanceHandle.committed, null);
  root.dispose();
});

test('covered effects survive while header props pause and refresh on reveal', async () => {
  const { nav, fixture, root, find, settle } = await mount();
  await nav.push('/plain/second');
  settle();
  fixture.setLabel('changed');
  fixture.setValue(1);
  root.flush();
  assert.equal(find('header:/').props['title'], 'title:/');
  assert.equal(find('header:/plain/second').props['title'], 'changed:/plain/second');
  assert.ok(fixture.effects.includes('/:1'));
  assert.deepEqual(
    fixture.constructions,
    ['/:0', '/plain/second:0'],
    'component setup is untracked and never reruns for covered signal updates',
  );
  await nav.pop();
  settle();
  assert.equal(find('header:/').props['title'], 'changed:/');
  assert.equal(nav.current()!.inFront(), true);
  root.dispose();
});

test('denied, resolver, lazy and render failures preserve the previous screen and release failed roots', async () => {
  const { nav, fixture, root, find } = await mount();
  const previous = nav.current();
  const native = find('native-stack').children[0];
  for (const path of [
    '/denied',
    '/resolver-error',
    '/lazy-error',
    '/render-error',
    '/missing',
    '/%xx',
  ]) {
    assert.equal(await nav.push(path), false);
    root.flush();
    assert.equal(nav.current(), previous);
    assert.equal(nav.transition(), null);
    assert.equal(find('native-stack').children[0]!.tag, native!.tag);
    assert.equal(nav.pending(), false);
  }
  assert.deepEqual(fixture.cleanups, ['/render-error']);
  assert.equal(fixture.errors.length, 5);
  assert.equal(await nav.reset([]), false);
  assert.equal(await nav.pop(0), false);
  assert.equal(await nav.pop(), false);
  root.dispose();
});

test('superseding async guard/resolver/lazy requests aborts stale work and never mounts its route', async () => {
  for (const path of ['/guarded', '/resolved', '/lazy']) {
    const { nav, fixture, root, settle } = await mount();
    const waiting = nav.push(path);
    await Promise.resolve();
    assert.equal(nav.pending(), true);
    assert.equal(await nav.push('/plain/winner'), true);
    settle();
    assert.equal(fixture.signals[0]!.aborted, true);
    assert.equal(
      await waiting,
      false,
      'aborted request resolves even when application work ignores its signal',
    );
    fixture.guard.resolve(true);
    fixture.resolve.resolve({ late: 'ignored' });
    fixture.lazy.resolve(fixture.Page);
    assert.equal(await waiting, false);
    assert.equal(nav.current()!.route.pathname, '/plain/winner');
    assert.equal(
      fixture.effects.some((item) => item.startsWith(`${path}:`)),
      false,
    );
    assert.equal(nav.error(), undefined);
    root.dispose();
  }
});

test('replace/reset retain previous owners until native finish and cancel all newly adopted instances', async () => {
  const { nav, fixture, root, settle } = await mount();
  const home = nav.current()!;
  await nav.push('/plain/two');
  settle();
  const second = nav.current()!;
  await nav.replace('/plain/three');
  const replacement = nav.current()!;
  assert.equal(second.owner.disposed, false);
  assert.equal(nav.cancel(nav.transition()!), true);
  assert.equal(nav.current(), second);
  assert.equal(replacement.owner.disposed, true);
  await nav.reset(['/plain/a', '/plain/b']);
  assert.equal(home.owner.disposed, false);
  assert.equal(second.owner.disposed, false);
  settle();
  assert.equal(home.owner.disposed, true);
  assert.equal(second.owner.disposed, true);
  assert.deepEqual(
    nav.entries().map((entry) => entry.route.pathname),
    ['/plain/a', '/plain/b'],
  );
  await nav.replace('/plain/c');
  settle();
  assert.deepEqual(
    nav.entries().map((entry) => entry.route.pathname),
    ['/plain/a', '/plain/c'],
  );
  root.dispose();
  assert.equal(new Set(fixture.cleanups).size, fixture.cleanups.length);
});

test('native dismiss counts require current instance and stale captured events cannot dismiss a later screen', async () => {
  const { nav, root, fabric, find, settle } = await mount();
  await nav.push('/plain/one');
  settle();
  await nav.push('/plain/two');
  settle();
  const removed = nav.entries().slice(1);
  const old = nav.nativeEvents(null);
  const top = nav.current()!;
  assert.equal(old.dismissed('wrong', 1), false);
  assert.equal(old.dismissed(top.key, 0), false);
  fabric.emit(find('native-stack').children.at(-1)!, 'topDismissed', { dismissCount: 99 });
  root.flush();
  assert.equal(nav.entries().length, 1);
  assert.ok(removed.every((entry) => entry.owner.disposed));
  await nav.push('/plain/later');
  settle();
  assert.equal(old.dismissed(top.key, 1), false);
  assert.equal(nav.entries().length, 2);
  // A denied async request must refresh idle native event tokens, too.
  assert.equal(await nav.push('/denied'), false);
  fabric.emit(find('native-stack').children.at(-1)!, 'topDismissed', { dismissCount: 1 });
  assert.equal(nav.entries().length, 1);
  await nav.push('/plain/after-failure');
  settle();
  assert.equal(await nav.push('/render-error'), false);
  fabric.emit(find('native-stack').children.at(-1)!, 'topDismissed', { dismissCount: 1 });
  assert.equal(nav.entries().length, 1);
  root.dispose();
});

test('disposing a root aborts pending async work and rejects later native callbacks', async () => {
  const { nav, fixture, root, fabric, settle } = await mount();
  await nav.push('/plain/two');
  const events = nav.nativeEvents(nav.transition());
  settle();
  const waiting = nav.push('/resolved');
  await Promise.resolve();
  root.dispose();
  assert.equal(fixture.signals[0]!.aborted, true);
  fixture.resolve.reject(new Error('late rejection'));
  assert.equal(await waiting, false);
  assert.equal(nav.disposed, true);
  assert.equal(events.finish(), false);
  assert.deepEqual(fabric.roots.get(1), []);
  assert.deepEqual(fixture.errors, []);
  await assert.rejects(nav.push('/'), /disposed/);
});

test('guard app-path redirects preserve intent, detect loops and ignore stale async redirect answers', async () => {
  const { nav, fixture, root, settle } = await mount();
  const home = nav.current();
  assert.equal(await nav.push('/redirect'), true);
  assert.equal(nav.current()!.route.url, '/plain/login?reason=auth');
  settle();
  assert.equal(nav.entries()[0], home);
  const login = nav.current();
  assert.equal(await nav.replace('/loop'), false);
  assert.equal(nav.current(), login);
  assert.match(String(nav.error()), /redirect limit/);
  const waiting = nav.push('/guarded');
  await Promise.resolve();
  assert.equal(await nav.replace('/plain/winner'), true);
  settle();
  assert.equal(await waiting, false);
  fixture.guard.resolve('/plain/late');
  await Promise.resolve();
  assert.equal(nav.current()!.route.pathname, '/plain/winner');
  root.dispose();
});

test('nearest parent front service gates screens and headers; header children are created once', async () => {
  const { nav, fixture, root, find } = await mount();
  assert.deepEqual(fixture.headerChildren, ['/']);
  fixture.setAncestorFront(false);
  fixture.setLabel('covered');
  root.flush();
  assert.equal(nav.current()!.inFront(), false);
  assert.equal(find('header:/').props['title'], 'title:/');
  fixture.setAncestorFront(true);
  root.flush();
  assert.equal(nav.current()!.inFront(), true);
  assert.equal(find('header:/').props['title'], 'covered:/');
  assert.deepEqual(fixture.headerChildren, ['/']);
  assert.equal(await nav.push('/presentation-error'), false);
  assert.equal(nav.current()!.route.pathname, '/');
  assert.deepEqual(fixture.cleanups, ['/presentation-error']);
  const effectCount = fixture.effects.length;
  fixture.setValue(1);
  assert.equal(fixture.effects.length, effectCount + 1);
  root.dispose();
});

test('native transition proposals serialize rapid intents before actual stack finish dispatch', async () => {
  const { nav, root, fabric, find, settle } = await mount();
  await nav.push('/plain/first');
  root.flush();
  const first = nav.current()!;
  const token = nav.transition();
  assert.equal(await nav.push('/plain/second'), false);
  assert.equal(await nav.replace('/plain/replacement'), false);
  assert.equal(await nav.reset('/plain/reset'), false);
  assert.equal(await nav.pop(), false);
  assert.equal(nav.current(), first);
  assert.equal(nav.transition(), token);
  fabric.emit(find('native-stack'), 'topFinishTransitioning');
  assert.equal(nav.transition(), null);
  assert.equal(nav.current(), first);
  assert.equal(await nav.push('/plain/second'), true);
  const second = nav.current()!;
  assert.notEqual(nav.transition(), token);
  root.flush();
  assert.equal(first.owner.disposed, false);
  assert.equal(second.owner.disposed, false);
  settle();
  root.dispose();
});
