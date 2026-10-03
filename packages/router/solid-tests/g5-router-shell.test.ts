import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRoot } from 'solid-js';
import { createNativeRoot } from '@solidnative/platform/solid';
import {
  createClock,
  createFakeFabric,
  type FakeNode,
} from '../../platform/solid-tests/fake-fabric.ts';
import { createShellFixture, projectLinkParent } from './g5-router-fixture.tsx';
import { deferred } from './navigation-fixture.tsx';
import {
  bindNativeNavigation,
  followLink,
  linkAncestry,
  type NativeNavigationBinding,
  type NativeNavigationBindingOptions,
} from '../src/solid/native-links.ts';
import { selectRouteTree } from '../src/solid/route-tree.ts';
import { canaryPaths } from './g5-router-canary-paths.ts';

const flatten = (nodes: readonly FakeNode[]): FakeNode[] =>
  nodes.flatMap((node) => [node, ...flatten(node.children)]);
const tick = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
function mount(options?: NativeNavigationBindingOptions) {
  const fabric = createFakeFabric();
  const root = createNativeRoot({ fabric, clock: createClock(), rootTag: 1 });
  const fixture = createShellFixture(options);
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
  return { fixture, nav: fixture.nav, fabric, root, find, settle };
}

test('nested default redirect mounts real tabs and independent stack with inherited inputs', async () => {
  const { nav, fixture, root, find, settle } = mount();
  assert.equal(await nav.reset('/tabs'), true);
  settle();
  assert.equal(nav.url(), '/tabs/library');
  assert.equal(find('tabs-host').viewName, 'RNSTabsHostIOS');
  assert.equal(find('tabs-host').children.length, 4);
  assert.equal(find('tabs-host').children[0]!.viewName, 'RNSTabsScreenIOS');
  assert.equal(find('library-stack').viewName, 'RNSScreenStack');
  assert.equal(find('header:/tabs/library').props['titleFontFamily'], 'LayoutFont');
  assert.deepEqual(fixture.constructions, ['tabs-layout', 'library-layout', '/tabs/library']);
  assert.deepEqual(fixture.inputs[0], { inherited: true, winner: 'library' });
  assert.equal(await nav.push('/tabs/library/Kind%20of%20Blue?winner=query#music'), true);
  assert.equal(nav.transition(), null);
  assert.equal(nav.busy(), true);
  assert.equal(await nav.push('/plain'), false);
  settle('library-stack');
  assert.equal(nav.url(), '/tabs/library/Kind%20of%20Blue?winner=query#music');
  assert.equal(fixture.inputs.at(-1)?.['winner'], 'Kind of Blue');
  assert.equal(fixture.inputs.at(-1)?.['inherited'], true);
  assert.equal(fixture.constructions.filter((value) => value === 'tabs-layout').length, 1);
  root.dispose();
  assert.equal(fixture.cleanups.length, fixture.constructions.length);
  assert.deepEqual(fixture.errors, []);
});

test('native selection retains tab stack identity and back visits inner stack then first tab then outer stack', async () => {
  const { nav, fixture, root, find, fabric, settle } = mount();
  await nav.reset('/');
  settle();
  await nav.push('/tabs');
  settle();
  await nav.push('/tabs/library/Blue');
  settle('library-stack');
  const albumTag = find('page:/tabs/library/Blue').tag;
  const tabs = nav.current()!.children!;
  fabric.emit(find('tabs-host'), 'topTabSelected', { selectedScreenKey: 'profile', provenance: 1 });
  await tick();
  root.flush();
  assert.equal(nav.url(), '/tabs/profile');
  assert.equal(find('page:/tabs/library/Blue').tag, albumTag);
  assert.equal(tabs.entries()[0]!.inFront(), false);
  assert.equal(tabs.current()!.inFront(), true);
  assert.deepEqual(find('tabs-host').props['navStateRequest'], {
    selectedScreenKey: 'profile',
    baseProvenance: 1,
  });
  assert.equal(await nav.back(), true);
  assert.equal(nav.url(), '/tabs/library/Blue');
  assert.equal(find('page:/tabs/library/Blue').tag, albumTag);
  assert.equal(await nav.back(), true);
  assert.equal(nav.url(), '/tabs/library');
  assert.equal(fixture.cleanups.includes('/tabs/library/Blue'), false);
  settle('library-stack');
  assert.equal(fixture.cleanups.includes('/tabs/library/Blue'), true);
  assert.equal(await nav.back(), true);
  assert.equal(nav.url(), '/');
  settle();
  assert.equal(nav.canGoBack(), false);
  root.dispose();
  assert.equal(new Set(fixture.cleanups).size, fixture.cleanups.length);
});

test('deep-linking into nonfirst tab still backs to declared first tab and denied native selection reverts', async () => {
  const { nav, root, find, fabric, settle } = mount();
  await nav.reset('/tabs/search');
  settle();
  assert.equal(nav.canGoBack(), true);
  assert.equal(await nav.back(), true);
  root.flush();
  assert.equal(nav.url(), '/tabs/library');
  fabric.emit(find('tabs-host'), 'topTabSelected', { selectedScreenKey: 'denied', provenance: 4 });
  await tick();
  root.flush();
  assert.equal(nav.url(), '/tabs/library');
  assert.deepEqual(find('tabs-host').props['navStateRequest'], {
    selectedScreenKey: 'library',
    baseProvenance: 4,
  });
  fabric.emit(find('tabs-host'), 'topTabSelected', { selectedScreenKey: 'profile', provenance: 3 });
  await tick();
  root.flush();
  assert.equal(nav.url(), '/tabs/library');
  root.dispose();
});

test('nested failure and superseded async preparation preserve retained ancestors and cancel new child on native rollback', async () => {
  const { nav, fixture, root, settle } = mount();
  await nav.reset('/tabs');
  settle();
  const parent = nav.current();
  assert.equal(await nav.push('/tabs/library/broken/lazy'), false);
  assert.equal(nav.current(), parent);
  const slow = nav.push('/tabs/library/slow/guard');
  await tick();
  assert.equal(await nav.push('/tabs/library/Blue'), true);
  assert.equal(await slow, false);
  assert.equal(fixture.signals[0]!.aborted, true);
  const library = parent!.children!.current()!.children!;
  const token = library.transition()!;
  assert.ok(token);
  assert.equal(library.cancel(token), true);
  assert.equal(nav.url(), '/tabs/library');
  assert.equal(fixture.cleanups.filter((value) => value === '/tabs/library/Blue').length, 1);
  fixture.slow.resolve(true);
  await tick();
  assert.equal(nav.url(), '/tabs/library');
  assert.match(String(fixture.errors[0]), /nested lazy failure/);
  root.dispose();
});

test('tab badge and scheme defaults update while covered header values wait for front ownership', async () => {
  const { nav, fixture, root, find, settle } = mount();
  await nav.reset('/tabs');
  settle();
  const header = find('header:/tabs/library');
  assert.equal(header.props['backgroundColor'], '#eeeeee');
  await nav.push('/tabs/profile');
  root.flush();
  fixture.setScheme('dark');
  fixture.setBadge('7');
  fixture.setTitle('Changed');
  root.flush();
  assert.equal(find('header:/tabs/library').props['backgroundColor'], '#eeeeee');
  assert.equal(find('header:/tabs/profile').props['backgroundColor'], '#101010');
  assert.equal(find('tabs-host').props['tabBarTintColor'], '#ffffff');
  assert.equal(find('tabs-host').children[2]!.props['badgeValue'], '7');
  const appearance = find('tabs-host').children[2]!.props['standardAppearance'] as {
    stacked: { selected: { tabBarItemTitleFontWeight: string } };
  };
  assert.equal(appearance.stacked.selected.tabBarItemTitleFontWeight, '600');
  assert.equal(await nav.current()!.children!.selectTab('library'), true);
  root.flush();
  assert.equal(find('header:/tabs/library').props['title'], 'Changed');
  assert.equal(find('header:/tabs/library').props['backgroundColor'], '#101010');
  root.dispose();
});

test('project link ancestry stages every parent atomically and back walks actual retained owners', async () => {
  const { nav, root, settle } = mount();
  const url = '/projects/orion/tasks/launch/comments/review?from=mail#note';
  const expected = ['/projects', '/projects/orion', '/projects/orion/tasks/launch'];
  assert.deepEqual(linkAncestry(url, projectLinkParent), expected);
  assert.equal(await followLink(nav, url, projectLinkParent), true);
  assert.deepEqual(
    nav.entries().map((entry) => entry.route.url),
    [...expected, url],
  );
  assert.equal(nav.busy(), true);
  assert.equal(await followLink(nav, '/plain', projectLinkParent), false);
  settle();
  assert.equal(await nav.back(), true);
  settle();
  assert.equal(nav.url(), expected[2]);
  assert.equal(await followLink(nav, url, projectLinkParent), true);
  settle();
  assert.equal(nav.entries().length, 4);
  root.dispose();
  assert.deepEqual(
    linkAncestry('/a', (url) => (url === '/a' ? '/b' : '/a')),
    ['/b'],
  );
  assert.throws(() => linkAncestry('/0', (url) => `/${Number(url.slice(1)) + 1}`), /128 parents/);
});

test('startup live link beats launch snapshot, queued links wait for native settlement and hardware back cleans up', async () => {
  const launch = deferred<void>();
  let listener: ((path: string) => void) | undefined;
  let answer: (() => boolean) | undefined;
  let stops = 0;
  const { nav, fixture, root, settle } = mount({
    parentOf: projectLinkParent,
    links: {
      ready: launch.promise,
      initialUrl: () => '/plain',
      subscribe: (next) => {
        listener = next;
        return () => {
          stops++;
        };
      },
    },
    back: {
      handle: (next) => {
        answer = next;
        return () => {
          stops++;
        };
      },
    },
  });
  listener!('/projects/orion');
  launch.resolve();
  assert.equal(await fixture.binding!.ready, true);
  assert.deepEqual(
    nav.entries().map((entry) => entry.route.url),
    ['/projects', '/projects/orion'],
  );
  assert.equal(answer!(), true);
  listener!('/sheet');
  listener!('/projects/orion/tasks/launch');
  await tick();
  assert.equal(nav.url(), '/projects/orion');
  settle();
  await tick();
  assert.equal(nav.url(), '/projects/orion/tasks/launch');
  assert.equal(nav.entries().length, 3);
  settle();
  assert.equal(answer!(), true);
  await tick();
  assert.equal(nav.url(), '/projects/orion');
  settle();
  root.dispose();
  assert.equal(stops, 2);
  assert.equal(answer!(), false);
  listener!('/plain');
  await tick();
  assert.equal(nav.entries().length, 0);
});

test('auth guard redirects and reset dispose nested tab owners only after native acknowledgement', async () => {
  const { nav, fixture, root, settle } = mount();
  await nav.reset('/tabs');
  settle();
  assert.equal(await nav.push('/account'), true);
  assert.equal(nav.url(), '/auth/login');
  settle();
  fixture.setSignedIn(true);
  assert.equal(await nav.reset('/account'), true);
  assert.equal(fixture.cleanups.includes('tabs-layout'), false);
  assert.equal(await nav.reset('/auth/login'), false);
  settle();
  assert.equal(fixture.cleanups.includes('tabs-layout'), true);
  assert.equal(nav.url(), '/account');
  root.dispose();
});

test('binding rolls back acquired subscriptions on setup failure and contains every teardown failure', async () => {
  const setupError = new Error('back source setup');
  const cleanupError = new Error('links cleanup');
  const failures: unknown[] = [];
  let stopped = 0;
  assert.throws(
    () =>
      mount({
        links: {
          ready: Promise.resolve(),
          initialUrl: () => '/',
          subscribe: () => () => {
            stopped++;
            throw cleanupError;
          },
        },
        back: {
          handle: () => {
            throw setupError;
          },
        },
        onError: (error) => failures.push(error),
      }),
    (error) => error === setupError,
  );
  assert.equal(stopped, 1);
  assert.deepEqual(failures, [cleanupError]);
  const launch = deferred<void>();
  const { root, fixture } = mount({
    links: {
      ready: launch.promise,
      initialUrl: () => '/',
      subscribe: () => () => {
        stopped++;
        throw cleanupError;
      },
    },
    back: {
      handle: () => () => {
        stopped++;
        throw new Error('back cleanup');
      },
    },
    onError: () => {
      throw new Error('reporter cleanup');
    },
  });
  fixture.binding!.dispose();
  assert.equal(await fixture.binding!.ready, false);
  assert.equal(stopped, 3);
  fixture.binding!.dispose();
  root.dispose();
  assert.equal(stopped, 3);
  launch.resolve();
  await tick();
  assert.equal(fixture.nav.entries().length, 0);
});

test('nested matcher ranks literal leaves, rejects invalid URI paths and preserves inherited dynamic params', () => {
  const component = () => null;
  const routes = [
    {
      path: 'org/:org',
      component,
      children: [
        { path: ':id', component },
        { path: 'new', component },
        { path: '*', component },
      ],
    },
  ];
  const result = selectRouteTree(routes, '/org/team/new?q=yes');
  assert.equal(result[1]!.definition.path, 'new');
  assert.deepEqual({ ...result[0]!.match.params }, { org: 'team' });
  assert.deepEqual({ ...result[1]!.match.params }, { org: 'team' });
  assert.equal(selectRouteTree(routes, '/org/team/a/b')[1]!.match.params['*'], 'a/b');
  assert.throws(() => selectRouteTree(routes, '/org/%zz/new'), URIError);
  assert.throws(() => selectRouteTree(routes, '/elsewhere'), /No native route/);
});

test('nested default redirects preserve query and fragment before inherited route input binding', async () => {
  const { nav, fixture, root, settle } = mount();
  assert.equal(await nav.reset('/tabs?filter=recent#albums'), true);
  settle();
  assert.equal(nav.url(), '/tabs/library?filter=recent#albums');
  assert.equal(fixture.inputs[0]?.['filter'], 'recent');
  root.dispose();
});

test('the complete canary route inventory matches without flattening the native tab subtree', () => {
  const fixture = createShellFixture();
  const component = () => null;
  const tree = canaryPaths.map((path) =>
    path === 'tabs' ? fixture.routes.find((route) => route.path === 'tabs')! : { path, component },
  );
  assert.equal(canaryPaths.length, 89);
  for (const path of canaryPaths) {
    const url = `/${path.replace(/:([a-z]+)/g, 'value-$1')}`;
    const selection = selectRouteTree(tree, url);
    assert.equal(selection[0]!.definition.path, path, url);
  }
  for (const url of [
    '/tabs/library',
    '/tabs/library/Kind%20of%20Blue',
    '/tabs/search',
    '/tabs/profile',
  ]) {
    assert.equal(selectRouteTree(tree, url)[0]!.definition.path, 'tabs');
  }
});

test('binding acquisition closes subscriptions returned after synchronous owner disposal', async () => {
  const { nav, root } = mount();
  let stops = 0;
  let backRegistrations = 0;
  let binding!: NativeNavigationBinding;
  createRoot((dispose) => {
    binding = bindNativeNavigation(nav, {
      links: {
        ready: Promise.resolve(),
        initialUrl: () => '/',
        subscribe() {
          dispose();
          return () => {
            stops++;
          };
        },
      },
      back: {
        handle() {
          backRegistrations++;
          return () => {};
        },
      },
    });
  });
  assert.equal(await binding.ready, false);
  assert.equal(stops, 1);
  assert.equal(backRegistrations, 0);
  binding.dispose();
  root.dispose();
  assert.equal(stops, 1);
});

test('throwing initial URL read reports the original failure and resolves startup false', async () => {
  const error = new Error('initial URL read');
  const failures: unknown[] = [];
  const { fixture, nav, root } = mount({
    links: {
      ready: Promise.resolve(),
      initialUrl: () => {
        throw error;
      },
      subscribe: () => () => {},
    },
    onError: (cause) => failures.push(cause),
  });
  assert.equal(await fixture.binding!.ready, false);
  assert.deepEqual(failures, [error]);
  assert.equal(nav.entries().length, 0);
  root.dispose();
});

test('live links start immediately while launch never settles and a late launch cannot reset them', async () => {
  const launch = deferred<void>();
  let listener!: (path: string) => void;
  const { fixture, nav, root, settle } = mount({
    links: {
      ready: launch.promise,
      initialUrl: () => '/plain',
      subscribe: (next) => {
        listener = next;
        return () => {};
      },
    },
  });
  listener('/projects');
  assert.equal(await fixture.binding!.ready, true);
  settle();
  listener('/projects/orion');
  await tick();
  settle();
  launch.resolve();
  await tick();
  assert.equal(nav.url(), '/projects/orion');
  assert.deepEqual(
    nav.entries().map((entry) => entry.route.url),
    ['/projects', '/projects/orion'],
  );
  root.dispose();
});
