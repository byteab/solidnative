import assert from 'node:assert/strict';
import { test } from 'node:test';
import { overlayRoutes } from '../src/app/overlays/routes.solid.ts';
import { consumerFixture } from './consumer-fixture.tsx';
import { bootConsumer } from './consumer-harness.ts';

for (const platform of ['ios', 'android'] as const) {
  test(`actual ${platform} overlays cover sheets and release canceled screen work`, async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
    const fixture = consumerFixture(() => [
      ...overlayRoutes,
      { path: 'empty', component: () => null },
    ]);
    const h = bootConsumer(fixture, platform),
      nav = fixture.navigation();
    t.after(() => h.root.dispose());
    await nav.reset('/overlays');
    h.finish();
    h.press('Show a toast');
    assert.match(h.renderedText(), /Shown above the screen/);
    await nav.present('/overlays/sheet', { as: 'formSheet' });
    h.finish();
    const sheet = h
      .nodes()
      .filter((node) => node.viewName === 'RNSScreen')
      .at(-1)!;
    assert.ok(sheet);
    h.press('Show a toast', sheet);
    assert.match(h.renderedText(), /Shown above the sheet/);
    h.press('Load for a moment', sheet);
    h.clock.flushMicrotasks();
    assert.ok(h.nodes().some((node) => node.instanceHandle.name === 'activity-indicator'));
    t.mock.timers.tick(1500);
    for (let turn = 0; turn < 4; turn++) await Promise.resolve();
    h.clock.flushMicrotasks();
    assert.match(h.renderedText(), /Loaded/);
    assert.ok(!h.nodes().some((node) => node.instanceHandle.name === 'activity-indicator'));
    t.mock.timers.tick(2500);
    h.clock.flushMicrotasks();
    h.press('Load for a moment', sheet);
    await nav.reset('/empty');
    h.finish();
    for (let turn = 0; turn < 4; turn++) await Promise.resolve();
    t.mock.timers.tick(1500);
    h.clock.flushMicrotasks();
    assert.ok(!h.nodes().some((node) => node.instanceHandle.name === 'activity-indicator'));
    assert.doesNotMatch(h.renderedText(), /Loaded/);
    assert.deepEqual(fixture.errors, []);
  });
}
