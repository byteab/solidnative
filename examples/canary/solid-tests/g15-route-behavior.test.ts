import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AppState, provideService } from '@solidnative/device/solid';
import type { NativeRoute } from '@solidnative/router/solid';
import { createCanaryRoutes } from '../src/app/app.routes.solid.ts';
import { OrdersApi, OrdersBackend } from '../src/app/orders/orders-api.solid.ts';
import { consumerFixture } from './consumer-fixture.tsx';
import { bootConsumer } from './consumer-harness.ts';
import reference from './legacy-reference.json' with { type: 'json' };

interface Shape {
  path: string;
  pathMatch?: string;
  redirectTo?: string;
  lazy: boolean;
  guarded: boolean;
  data?: Record<string, unknown>;
  children?: Shape[];
}

function actualShape(routes: readonly NativeRoute[]): Shape[] {
  return routes.map((route) => ({
    path: route.path,
    pathMatch: route.pathMatch,
    redirectTo: route.redirectTo,
    lazy: typeof route.lazy === 'function',
    guarded: typeof route.guard === 'function',
    data: route.data,
    children: route.children ? actualShape(route.children) : undefined,
  }));
}

test('complete root export preserves all 95 original route records, 94 lazy boundaries, guards, data and nesting', () => {
  let reads = 0;
  const routes = createCanaryRoutes(() => {
    reads++;
    throw new Error('The shared session must be resolved only when a guard runs.');
  });
  assert.equal(reads, 0);
  const actual = actualShape(routes);
  // The route table the retired implementation declared (legacy-reference.json).
  assert.deepEqual(JSON.parse(JSON.stringify(actual)), reference.routes);
  const flatten = (records: Shape[]): Shape[] =>
    records.flatMap((record) => [record, ...flatten(record.children ?? [])]);
  const all = flatten(actual);
  assert.equal(all.length, 95);
  assert.equal(all.filter((record) => record.lazy).length, 94);
  assert.deepEqual(
    all.filter((record) => record.guarded).map((record) => record.path),
    ['account', 'account/settings', 'account/orders'],
  );
  assert.deepEqual(routes.find((route) => route.path === 'account/settings')?.data, {
    settings: true,
  });
  assert.equal(routes.find((route) => route.path === 'tabs')?.outlet, 'tabs');
});

function fullFixture() {
  const orders = new OrdersBackend();
  orders.latency = 0;
  return consumerFixture(createCanaryRoutes, [
    provideService(OrdersApi, () => orders),
    provideService(AppState.SOURCE, () => ({ current: () => 'active', subscribe: () => () => {} })),
  ]);
}

type Harness = ReturnType<typeof bootConsumer>;
async function signIn(h: Harness, fixture: ReturnType<typeof fullFixture>, destination: string) {
  const navigation = fixture.navigation();
  const login = navigation.current()!.owner;
  h.input('Email', 'full-root@example.com');
  h.input('Password', 'correct horse');
  h.press('Sign in');
  await h.waitFor(() => navigation.url() === '/auth/code');
  h.finish();
  const code = navigation.current()!.owner;
  assert.equal(login.disposed, false, 'login remains retained below the code screen');
  h.input('Code', '123456');
  h.press('Continue');
  await h.waitFor(() => navigation.url() === destination);
  h.finish();
  assert.equal(login.disposed, true);
  assert.equal(code.disposed, true);
  assert.equal(navigation.entries().length, 1);
  assert.equal(fixture.session().user()?.email, 'full-root@example.com');
}

for (const platform of ['ios', 'android'] as const) {
  for (const path of ['account', 'account/settings', 'account/orders']) {
    test(`full ${platform} root guards /${path}, keeps the complete return URL and shares auth identity`, async (t) => {
      const fixture = fullFixture();
      const h = bootConsumer(fixture, platform);
      t.after(() => h.root.dispose());
      const navigation = fixture.navigation();
      const destination = `/${path}?source=mail&filter=a%2Fb&tag=one&tag=two#section%20one`;
      assert.equal(await navigation.reset(destination), true);
      h.finish();
      assert.equal(navigation.url(), '/auth/login');
      assert.equal(fixture.session().returnTo, destination);
      await signIn(h, fixture, destination);
      assert.equal(navigation.url(), destination);
      assert.equal(navigation.current()!.route.query['filter'], 'a/b');
      assert.equal(navigation.current()!.route.fragment, 'section one');
      if (path === 'account/settings') {
        assert.equal(navigation.current()!.route.inputs['settings'], true);
        assert.match(h.renderedText(), /Let the session expire/);
      } else if (path === 'account/orders') {
        await h.waitFor(() => h.renderedText().includes('Order o1'));
        assert.equal(navigation.current()!.route.pathname, '/account/orders');
      } else {
        assert.match(h.renderedText(), /Signed in as full-root@example.com/);
      }
      const protectedOwner = navigation.current()!.owner;
      assert.equal(await fixture.session().signOut(), true);
      h.finish();
      assert.equal(protectedOwner.disposed, true);
      assert.equal(navigation.url(), '/auth/login');
      assert.equal(fixture.session().signedIn(), false);
      assert.equal(await navigation.back(), false);
      h.root.dispose();
      h.root.dispose();
      assert.equal(navigation.disposed, true);
      assert.equal(
        await fixture.session().checkPassword('late@example.com', 'correct horse'),
        'cancelled',
      );
      assert.deepEqual(h.fabric.roots.get(1), []);
      assert.equal(fixture.cleanups.filter((name) => name === 'keyboard').length, 1);
      assert.deepEqual(fixture.errors, []);
    });
  }

  test(`full ${platform} root account settings is a retained sheet and expiry waits for native settlement`, async (t) => {
    const fixture = fullFixture();
    const h = bootConsumer(fixture, platform);
    const navigation = fixture.navigation();
    t.after(() => h.root.dispose());
    await navigation.reset('/account');
    h.finish();
    await signIn(h, fixture, '/account');
    const account = navigation.current()!.owner;
    h.press('Settings');
    await h.waitFor(() => navigation.url() === '/account/settings');
    h.clock.flushMicrotasks();
    const settings = navigation.current()!.owner;
    assert.equal(account.disposed, false);
    const sheet = h.nodes().find((node) => node.instanceHandle === settings.node);
    assert.equal(sheet?.props['stackPresentation'], 'formSheet');
    assert.equal(navigation.busy(), true);
    h.press('Let the session expire');
    assert.equal(fixture.session().signedIn(), false);
    assert.equal(navigation.url(), '/account/settings');
    h.finish();
    await h.waitFor(() => navigation.url() === '/auth/login');
    h.finish();
    assert.equal(account.disposed, true);
    assert.equal(settings.disposed, true);
    assert.match(h.renderedText(), /Your session has expired/);
    assert.equal(navigation.entries().length, 1);
    assert.deepEqual(fixture.errors, []);
  });

  test(`full ${platform} root prioritizes shop/basket over shop/:id and retains the product owner`, async (t) => {
    const fixture = fullFixture();
    const h = bootConsumer(fixture, platform);
    const navigation = fixture.navigation();
    t.after(() => h.root.dispose());
    assert.equal(await navigation.reset('/shop/basket?source=link#total'), true);
    h.finish();
    assert.match(h.renderedText(), /Your basket is empty/);
    assert.equal(navigation.current()!.route.params['id'], undefined);
    const empty = navigation.current()!.owner;
    assert.equal(await navigation.reset('/shop/p3'), true);
    h.finish();
    assert.equal(empty.disposed, true);
    const product = navigation.current()!.owner;
    h.press('Add to basket');
    assert.equal(await navigation.present('/shop/basket', { as: 'pageSheet' }), true);
    h.finish();
    const basket = navigation.current()!.owner;
    assert.equal(product.disposed, false);
    assert.ok(h.nodes().some((node) => node.props['accessibilityLabel'] === '1 of Canvas Tote'));
    assert.equal(await navigation.back(), true);
    h.finish();
    assert.equal(basket.disposed, true);
    assert.equal(navigation.current()!.owner, product);
    assert.equal(await navigation.reset('/auth/login'), true);
    h.finish();
    assert.equal(product.disposed, true);
    assert.deepEqual(fixture.errors, []);
  });

  test(`full ${platform} root tab redirect preserves URL suffix and retained nested owners until removal`, async (t) => {
    const fixture = fullFixture();
    const h = bootConsumer(fixture, platform);
    const navigation = fixture.navigation();
    t.after(() => h.root.dispose());
    assert.equal(await navigation.reset('/tabs?source=home#library'), true);
    h.finish();
    assert.equal(navigation.url(), '/tabs/library?source=home#library');
    const tabsOwner = navigation.current()!.owner;
    const tabs = navigation.current()!.children!;
    const libraryOwner = tabs.current()!.owner;
    const library = tabs.current()!.children!;
    const list = library.current()!.owner;
    h.press('Kind of Blue');
    await h.waitFor(() => navigation.url().includes('Kind%20of%20Blue'));
    h.finish();
    const album = library.current()!.owner;
    assert.equal(library.entries().length, 2);
    assert.equal(await tabs.selectTab('search'), true);
    h.finish();
    const search = tabs.current()!.owner;
    const input = h
      .nodes()
      .find((node) => node.props['placeholder'] === 'Type something, then switch tabs');
    assert.ok(input);
    h.fabric.emit(input, 'topChange', { text: 'retained full-root search', eventCount: 1 });
    h.clock.flushMicrotasks();
    assert.equal(await navigation.push('/auth/login'), true);
    h.finish();
    assert.equal(search.disposed, false);
    assert.equal(await navigation.back(), true);
    h.finish();
    assert.equal(navigation.current()!.owner, tabsOwner);
    assert.equal(
      h.nodes().find((node) => node.tag === input.tag)?.props['text'],
      'retained full-root search',
    );
    assert.equal(await tabs.selectTab('library'), true);
    h.finish();
    assert.equal(tabs.current()!.owner, libraryOwner);
    assert.equal(library.current()!.owner, album);
    for (const owner of [tabsOwner, libraryOwner, list, album, search])
      assert.equal(owner.disposed, false);
    assert.equal(await navigation.reset('/auth/login'), true);
    h.finish();
    for (const owner of [tabsOwner, libraryOwner, list, album, search])
      assert.equal(owner.disposed, true);
    h.root.dispose();
    assert.deepEqual(h.fabric.roots.get(1), []);
    assert.deepEqual(fixture.errors, []);
  });
}
