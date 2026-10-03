import assert from 'node:assert/strict';
import { test } from 'node:test';
import { provideService } from '@solid-native/device/solid';
import { consumerFixture } from './consumer-fixture.tsx';
import { bootConsumer } from './consumer-harness.ts';
import { searchRoutes } from '../src/app/search/routes.solid.ts';
import { StoreSearch, type CatalogueItem } from '../src/app/search/catalogue.solid.ts';

for (const platform of ['ios', 'android'] as const)
  test(`actual ${platform} music search preserves filters, recents and retained route state`, async () => {
    const requests: { signal: AbortSignal; resolve: (items: CatalogueItem[]) => void }[] = [];
    const fixture = consumerFixture(
      () => searchRoutes,
      [
        provideService(StoreSearch, () => ({
          latency: 0,
          failing: false,
          requests: 0,
          cancelled: 0,
          find(_q, _scope, signal) {
            return new Promise((resolve) => requests.push({ signal: signal!, resolve }));
          },
        })),
      ],
    );
    const h = bootConsumer(fixture, platform),
      nav = fixture.navigation();
    assert.equal(await nav.reset('/search-demo'), true);
    h.finish();
    const retained = nav.current()!;
    const bar = h.nodes().find((n) => n.viewName === 'RNSSearchBar')!;
    assert.ok(bar);
    h.fabric.emit(bar, 'topSearchFocus');
    h.clock.flushMicrotasks();
    assert.match(h.renderedText(), /Recent.*Coltrane.*Blue Train/);
    h.press('Coltrane');
    await h.waitFor(() => requests.length === 1);
    assert.match(h.renderedText(), /In your library/);
    assert.match(h.propsText(), /Coltrane/);
    h.press('Artists');
    await h.waitFor(() => requests.length === 2);
    assert.ok(requests[0]!.signal.aborted);
    h.fabric.emit(bar, 'topSearchBlur');
    h.clock.flushMicrotasks();
    h.press('John Coltrane');
    await h.waitFor(() => nav.url().startsWith('/search-demo/r'));
    h.finish();
    assert.equal(nav.current()!.route.state?.['title'], 'John Coltrane');
    assert.match(h.renderedText(), /John Coltrane/);
    await nav.back();
    h.finish();
    assert.equal(nav.current(), retained);
    assert.ok(h.nodes().some((n) => n.tag === bar.tag));
    h.root.dispose();
    assert.ok(requests.at(-1)!.signal.aborted);
    assert.deepEqual(fixture.errors, []);
  });
