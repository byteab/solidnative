import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AppState, Dialogs, provideService } from '@solid-native/device/solid';
import { linkAncestry } from '@solid-native/router/solid';
import { consumerFixture } from './consumer-fixture.tsx';
import { bootConsumer } from './consumer-harness.ts';
import {
  ProjectBackend,
  ProjectServer,
  ProjectStore,
  createProjectStore,
} from '../src/app/projects/project-data.solid.ts';
import { projectRoutes } from '../src/app/projects/routes.solid.ts';
import { projectLinkParent } from '../src/app/projects/project-links.ts';
import { OrdersBackend, OrdersApi, ORDER_POLL_MS } from '../src/app/orders/orders-api.solid.ts';
import { orderRoutes } from '../src/app/orders/routes.solid.ts';

function projectFixture(answers: boolean[] = []) {
  const server = new ProjectBackend();
  server.latency = 0;
  let store!: ProjectStore;
  const questions: string[] = [];
  const fixture = consumerFixture(
    () => projectRoutes,
    [
      provideService(ProjectServer, () => server),
      provideService(ProjectStore, () => {
        store = createProjectStore(server);
        return store;
      }),
      provideService(Dialogs.SOURCE, () => ({
        platform: 'ios',
        alert(title, _message, buttons) {
          questions.push(title);
          const agree = answers.shift() ?? true;
          buttons
            .find((button) => (agree ? button.style !== 'cancel' : button.style === 'cancel'))
            ?.onPress?.();
        },
      })),
    ],
  );
  return { fixture, server, store: () => store, questions };
}

for (const platform of ['ios', 'android'] as const) {
  test(`actual project deep ancestry, reactive task details and retained popTo on ${platform}`, async () => {
    const data = projectFixture();
    const app = bootConsumer(data.fixture, platform);
    const navigation = data.fixture.navigation();
    const destination = '/projects/p1/tasks/t2/comments/c5?from=mail#body';
    const paths = [...linkAncestry(destination, projectLinkParent), destination];
    assert.deepEqual(paths, [
      '/projects',
      '/projects/p1',
      '/projects/p1/tasks/t2',
      '/projects/p1/tasks/t2/comments/c5?from=mail#body',
    ]);
    assert.equal(await navigation.reset(paths), true);
    app.finish();
    await app.waitFor(() => data.store().loaded());
    assert.ok(app.renderedText().includes('Can we split this in two?'));
    const list = navigation.entries()[0]!.owner;
    assert.equal(await navigation.popTo('/projects/p1/tasks/t2'), true);
    assert.equal(list.disposed, false);
    app.finish();
    assert.ok(app.renderedText().includes('Review onboarding'));
    app.press('Tap to change');
    await app.waitFor(() => data.store().task('t2')?.version === 2);
    assert.equal(data.store().task('t2')?.done, true);
    assert.equal(await navigation.popTo('/projects'), true);
    app.finish();
    assert.equal(navigation.current()?.owner, list);
    assert.equal(await navigation.popTo('/missing'), false);
    assert.equal(await navigation.popToRoot(), false);
    app.root.dispose();
    assert.deepEqual(data.fixture.errors, []);
  });
}

test('actual project sheet validates title, updates store and guards cancelled native dismissal', async () => {
  const data = projectFixture([false, true]);
  const app = bootConsumer(data.fixture);
  const navigation = data.fixture.navigation();
  await navigation.reset('/projects');
  app.finish();
  await app.waitFor(() => data.store().loaded());
  await navigation.push('/projects/p1');
  app.finish();
  assert.ok(
    app
      .nodes()
      .some(
        (node) => node.viewName === 'RNSScreenStackHeaderSubview' && node.props['type'] === 'right',
      ),
  );
  app.press('New');
  await app.waitFor(() => navigation.url() === '/projects/p1/new');
  app.finish();
  app.press('Save');
  assert.ok(app.renderedText().includes('Give the task a title'));
  app.input('Title', 'New migration task');
  const screen = app
    .nodes()
    .find((node) => node.instanceHandle === navigation.current()!.owner.node)!;
  assert.equal(screen.props['preventNativeDismiss'], true);
  app.fabric.emit(screen, 'topNativeDismissCancelled');
  await app.waitFor(() => data.questions.length === 1);
  assert.equal(navigation.url(), '/projects/p1/new');
  app.press('Save');
  await app.waitFor(() => navigation.url() === '/projects/p1');
  app.finish();
  await app.waitFor(() =>
    data
      .store()
      .tasksOf('p1')
      .some((task) => task.title === 'New migration task' && task.version === 1),
  );
  await navigation.present('/projects/p1/tasks/t2/edit', { as: 'formSheet' });
  app.finish();
  app.input('Title', 'Discard this');
  app.press('Cancel');
  await app.waitFor(() => navigation.url() === '/projects/p1');
  app.finish();
  assert.equal(data.store().task('t2')?.title, 'Review onboarding');
  assert.deepEqual(data.questions, ['Discard your changes?', 'Discard your changes?']);
  app.root.dispose();
  assert.deepEqual(data.fixture.errors, []);
});

test('actual task actions duplicate, delete and reflect edits made elsewhere', async () => {
  const data = projectFixture();
  const app = bootConsumer(data.fixture);
  const navigation = data.fixture.navigation();
  await navigation.reset(['/projects', '/projects/p1/tasks/t2']);
  app.finish();
  await app.waitFor(() => data.store().loaded());
  app.press('Have Grace rename it, then refresh');
  await app.waitFor(() => !!data.store().task('t2')?.title.includes('edited by Grace'));
  assert.ok(app.renderedText().includes('edited by Grace'));
  app.press('Duplicate');
  await app.waitFor(() => navigation.url() !== '/projects/p1/tasks/t2');
  app.finish();
  const copy = navigation.current()!.route.params['tid']!;
  await app.waitFor(() => data.store().task(copy)?.version === 1);
  app.press(
    'Delete',
    app.nodes().find((node) => node.instanceHandle === navigation.current()!.owner.node),
  );
  await app.waitFor(() => navigation.url() === '/projects/p1/tasks/t2');
  app.finish();
  assert.equal(data.store().task(copy), undefined);
  assert.ok(data.questions.includes('Delete this task?'));
  app.root.dispose();
  assert.deepEqual(data.fixture.errors, []);
});

test('actual order routes render, reject stale polling while covered and retain previous screen', async () => {
  const backend = new OrdersBackend();
  backend.latency = 0;
  const fixture = consumerFixture(
    (session) => orderRoutes(session),
    [
      provideService(OrdersApi, () => backend),
      provideService(ORDER_POLL_MS, () => 5),
      provideService(AppState.SOURCE, () => ({
        current: () => 'active',
        subscribe: () => () => {},
      })),
    ],
  );
  const app = bootConsumer(fixture);
  const navigation = fixture.navigation();
  await navigation.reset('/orders/o1');
  app.finish();
  await app.waitFor(() => app.renderedText().includes('Status:'));
  const first = navigation.current()!.owner;
  app.press('Next order');
  await app.waitFor(() => app.renderedText().includes('Croissant'));
  app.press('All orders');
  await app.waitFor(() => navigation.url() === '/orders');
  app.finish();
  const count = backend.requests;
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(backend.requests, count);
  assert.equal(await navigation.back(), true);
  app.finish();
  assert.equal(navigation.current()?.owner, first);
  assert.ok(app.renderedText().includes('Croissant'));
  app.root.dispose();
  assert.deepEqual(fixture.errors, []);
});

test('direct editor navigation waits for real task data and retains dirty guard on refused back', async () => {
  const data = projectFixture();
  const app = bootConsumer(data.fixture);
  const navigation = data.fixture.navigation();
  await navigation.reset('/projects/p1/tasks/t2/edit');
  app.finish();
  await app.waitFor(() =>
    app
      .nodes()
      .some(
        (node) =>
          node.props['accessibilityLabel'] === 'Title' &&
          node.props['text'] === 'Review onboarding',
      ),
  );
  app.input('Title', 'Unsaved');
  app.press('Cancel');
  await app.waitFor(() => data.questions.length === 1);
  await new Promise((resolve) => setTimeout(resolve, 0));
  app.clock.flushMicrotasks();
  assert.equal(navigation.url(), '/projects/p1/tasks/t2/edit');
  const screen = app
    .nodes()
    .find((node) => node.instanceHandle === navigation.current()!.owner.node)!;
  assert.equal(screen.props['preventNativeDismiss'], true);
  assert.equal(data.store().task('t2')?.title, 'Review onboarding');
  app.root.dispose();
  assert.deepEqual(data.fixture.errors, []);
});

test('a delayed deletion question cannot mutate or navigate after its screen is replaced', async () => {
  const server = new ProjectBackend();
  server.latency = 0;
  let store!: ProjectStore;
  let agree: (() => void) | undefined;
  const fixture = consumerFixture(
    () => projectRoutes,
    [
      provideService(ProjectStore, () => {
        store = createProjectStore(server);
        return store;
      }),
      provideService(ProjectServer, () => server),
      provideService(Dialogs.SOURCE, () => ({
        platform: 'ios',
        alert(_title, _message, buttons) {
          agree = buttons.find((button) => button.style !== 'cancel')?.onPress;
        },
      })),
    ],
  );
  const app = bootConsumer(fixture);
  const navigation = fixture.navigation();
  await navigation.reset('/projects/p1/tasks/t2');
  app.finish();
  await app.waitFor(() => store.loaded());
  app.press('Delete');
  assert.ok(agree);
  await navigation.reset('/projects');
  app.finish();
  agree();
  await new Promise((resolve) => setTimeout(resolve, 0));
  app.clock.flushMicrotasks();
  assert.ok(store.task('t2'));
  assert.equal(navigation.url(), '/projects');
  app.root.dispose();
  assert.deepEqual(fixture.errors, []);
});
