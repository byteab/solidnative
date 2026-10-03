import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AppState, DeepLinks, provideService } from '@solid-native/device/solid';
import { consumerFixture } from './consumer-fixture.tsx';
import { bootConsumer, flatten } from './consumer-harness.ts';
import { navigationRoutes } from '../src/app/navigation/routes.solid.ts';
import { Primitives } from '../src/app/components/primitives.solid.tsx';
import { DevicePage } from '../src/app/device/device.solid.tsx';
import { IconsPage } from '../src/app/components/icons.solid.tsx';

for (const platform of ['ios', 'android'] as const) {
  test(`actual ${platform} navigation companions preserve push/back, header actions, sheets and modal`, async () => {
    const fixture = consumerFixture(() => navigationRoutes);
    const h = bootConsumer(fixture, platform),
      nav = fixture.navigation();
    await nav.reset('/navigation');
    h.finish();
    const first = nav.current()!;
    h.press('push');
    await h.waitFor(() => nav.url() === '/detail');
    h.finish();
    h.press('Done');
    await h.waitFor(() => nav.url() === '/navigation');
    h.finish();
    assert.equal(nav.current(), first);
    h.press('present as a sheet');
    await h.waitFor(() => nav.url() === '/sheet');
    h.finish();
    const sheet = h.nodes().find((n) => n.props['stackPresentation'] === 'formSheet')!;
    assert.deepEqual(sheet.props['sheetAllowedDetents'], [0.5, 1]);
    assert.match(h.renderedText(), /Presented/);
    h.press('Close', sheet);
    await h.waitFor(() => nav.url() === '/navigation');
    h.finish();
    await nav.push('/header');
    h.finish();
    h.press('☆');
    assert.match(h.renderedText(), /Starred:yes/);
    h.press('large title');
    assert.ok(
      h
        .nodes()
        .some((n) => n.viewName === 'RNSScreenStackHeaderConfig' && n.props['largeTitle'] === true),
    );
    await nav.push('/modal');
    h.finish();
    h.press('open modal');
    assert.ok(h.nodes().some((n) => n.viewName === 'ModalHostView'));
    h.press('close');
    assert.ok(!h.nodes().some((n) => n.viewName === 'ModalHostView'));
    h.root.dispose();
    assert.deepEqual(fixture.errors, []);
  });
  test(`actual ${platform} primitives and device show native values and controlled edits`, async () => {
    const opened: string[] = [];
    const fixture = consumerFixture(
      () => [
        { path: 'primitives', component: Primitives },
        { path: 'device', component: DevicePage },
      ],
      [
        provideService(AppState.SOURCE, () => ({
          current: () => 'active',
          subscribe: () => () => {},
        })),
        provideService(DeepLinks.SOURCE, () => ({
          launchUrl: async () => null,
          subscribe: () => () => {},
          open: async (url) => {
            opened.push(url);
          },
          canOpen: async () => true,
        })),
      ],
    );
    const h = bootConsumer(fixture, platform),
      nav = fixture.navigation();
    await nav.reset('/primitives');
    h.finish();
    const input = h.nodes().find((n) => n.props['placeholder'] === 'type here')!;
    h.fabric.emit(input, 'topChange', { text: 'Ada', eventCount: 1 });
    h.clock.flushMicrotasks();
    assert.match(h.renderedText(), /typed: Ada/);
    assert.ok(h.nodes().some((n) => JSON.stringify(n.props).includes('local.png')));
    const refresh = h.nodes().find((n) => n.instanceHandle.name === 'refresh-control')!;
    h.fabric.emit(refresh, 'topRefresh');
    h.clock.flushMicrotasks();
    assert.ok(h.nodes().some((n) => n.props['refreshing'] === true));
    await nav.push('/device');
    h.finish();
    assert.match(h.renderedText(), /402 x 874/);
    assert.match(h.renderedText(), /light theme, app is active/);
    fixture.keyboard(250);
    h.clock.flushMicrotasks();
    assert.match(h.renderedText(), /250pt tall/);
    h.press('Open solidjs.com');
    assert.deepEqual(opened, ['https://www.solidjs.com']);
    h.root.dispose();
    assert.deepEqual(fixture.errors, []);
  });
  test(`actual ${platform} icon page retains native shapes while changing size, stroke and color`, async () => {
    const fixture = consumerFixture(() => [{ path: 'icons', component: IconsPage }]);
    const h = bootConsumer(fixture, platform);
    await fixture.navigation().reset('/icons');
    h.finish();
    const paths = h
      .nodes()
      .filter((n) => n.viewName === 'RNSVGPath')
      .map((n) => n.tag);
    assert.ok(paths.length > 8);
    for (const label of ['Size', 'Weight', 'Colour']) {
      const target = h.nodes().find(
        (n) =>
          n.instanceHandle.name === 'pressable' &&
          flatten(n.children)
            .map((child) => child.props['text'] ?? '')
            .join('') === label,
      );
      assert.ok(target, label);
      h.press(label, target);
    }
    assert.match(h.renderedText(), /40pt, stroke 2, #32d74b/);
    assert.deepEqual(
      h
        .nodes()
        .filter((n) => n.viewName === 'RNSVGPath')
        .map((n) => n.tag),
      paths,
    );
    h.root.dispose();
    assert.deepEqual(fixture.errors, []);
  });
}
