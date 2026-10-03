import assert from 'node:assert/strict';
import { test } from 'node:test';
import { tabRoute } from '../src/app/tabs/routes.solid.ts';
import { consumerFixture } from './consumer-fixture.tsx';
import { bootConsumer } from './consumer-harness.ts';

for (const platform of ['ios', 'android'] as const) {
  test(`actual ${platform} tabs preserve assets, nested library depth, search input and profile badge`, async (t) => {
    const fixture = consumerFixture(() => [tabRoute]);
    const h = bootConsumer(fixture, platform);
    t.after(() => h.root.dispose());
    const nav = fixture.navigation();
    assert.equal(await nav.reset('/tabs?source=home#library'), true);
    h.finish();
    assert.equal(nav.url(), '/tabs/library?source=home#library');
    const tabs = nav.current()!.children!;
    const library = tabs.current()!.children!;
    const libraryOwner = tabs.current()!.owner;
    h.press('Kind of Blue');
    await h.waitFor(() => nav.url().includes('Kind%20of%20Blue'));
    h.finish();
    assert.equal(library.entries().length, 2);
    const albumOwner = library.current()!.owner;
    const select = async (path: string) => {
      assert.equal(await tabs.selectTab(path), true);
      h.finish();
    };
    await select('search');
    let field = h
      .nodes()
      .find((node) => node.props['placeholder'] === 'Type something, then switch tabs');
    assert.ok(field);
    const tag = field.tag;
    h.fabric.emit(field, 'topChange', { text: 'jazz', eventCount: 1 });
    fixture.keyboard(280);
    h.clock.flushMicrotasks();
    assert.ok(h.propsText().includes('280pt tall'));
    await select('profile');
    h.press('Tap me, then switch tabs');
    assert.ok(h.renderedText().includes('Tapped 1 times.'));
    assert.ok(h.nodes().some((node) => node.props['badgeValue'] === '3'));
    h.press('Clear the badge');
    assert.ok(!h.nodes().some((node) => node.props['badgeValue']));
    await select('search');
    field = h.nodes().find((node) => node.tag === tag);
    assert.ok(field);
    assert.equal(field.props['text'], 'jazz');
    await select('library');
    assert.equal(tabs.current()!.owner, libraryOwner);
    assert.equal(library.current()!.owner, albumOwner);
    assert.equal(library.entries().length, 2);
    const icons = JSON.stringify(h.nodes().map((node) => node.props));
    assert.ok(icons.includes('tab-search.png'));
    assert.ok(icons.includes('tab-search-selected.png'));
    assert.ok(icons.includes(platform === 'ios' ? 'books.vertical.fill' : 'tab-library.png'));
    h.root.dispose();
    assert.equal(libraryOwner.disposed, true);
    assert.equal(albumOwner.disposed, true);
    assert.deepEqual(h.fabric.roots.get(1), []);
    assert.deepEqual(fixture.errors, []);
    assert.equal(fixture.cleanups.filter((key) => key === 'keyboard').length, 1);
  });
}
