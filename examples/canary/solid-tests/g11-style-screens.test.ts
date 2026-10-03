import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LayoutPage } from '../src/app/css/layout.solid.tsx';
import { TypographyPage } from '../src/app/css/typography.solid.tsx';
import { SurfacesPage } from '../src/app/css/surfaces.solid.tsx';
import { CssPage } from '../src/app/css/css.solid.tsx';
import { CssEnginePage } from '../src/app/css/css-engine.solid.tsx';
import { TextNesting } from '../src/app/css/text.solid.tsx';
import { TailwindPage } from '../src/app/tailwind/tailwind-page.solid.tsx';
import { consumerFixture } from './consumer-fixture.tsx';
import { bootConsumer } from './consumer-harness.ts';
import reference from './legacy-reference.json' with { type: 'json' };

const catalogues = [
  ['layout', LayoutPage],
  ['typography', TypographyPage],
  ['surfaces', SurfacesPage],
  ['css-engine', CssEnginePage],
] as const;

for (const platform of ['ios', 'android'] as const) {
  for (const [name, component] of catalogues) {
    test(`actual ${platform} ${name} preserves every example and its explanatory note`, async (t) => {
      const fixture = consumerFixture(() => [{ path: name, component }]);
      const h = bootConsumer(fixture, platform);
      t.after(() => h.root.dispose());
      await fixture.navigation().reset(`/${name}`);
      h.finish();
      // Every example title and note the original catalogue carried (legacy-reference.json).
      const expected = reference.catalogues[name];
      const text = h.renderedText().replace(/\s+/g, ' ');
      for (const literal of expected.literals) assert.ok(text.includes(literal), literal);
      const classes = (css: string) =>
        h.nodes().filter((node) => node.instanceHandle.classes?.has(css));
      assert.equal(classes('stage').length, expected.stages);
      if (name === 'layout') {
        assert.equal(classes('relative-box')[0]!.props['height'], 96);
        assert.equal(classes('clip-round')[0]!.props['overflow'], 'hidden');
      }
      if (name === 'typography') {
        const link = classes('link').find(
          (node) => node.props['accessibilityLabel'] === 'Typography tap counter',
        )!;
        const touch = { identifier: 1, pageX: 1, pageY: 1 };
        for (const type of ['topTouchStart', 'topTouchEnd'])
          h.fabric.emit(link, type, {
            ...touch,
            changedTouches: [touch],
            touches: type === 'topTouchEnd' ? [] : [touch],
          });
        h.clock.flushMicrotasks();
        assert.match(h.renderedText(), /Tapped 1 times/);
        assert.equal(classes('ink')[0]!.props['fontSize'], 12);
      }
      if (name === 'surfaces') {
        const pressable = h.nodes().find((node) => node.instanceHandle.name === 'pressable')!;
        const touch = { identifier: 1, pageX: 1, pageY: 1 };
        h.fabric.emit(pressable, 'topTouchStart', {
          ...touch,
          changedTouches: [touch],
          touches: [touch],
        });
        h.clock.flushMicrotasks();
        assert.match(h.renderedText(), /Held/);
        h.fabric.emit(pressable, 'topTouchEnd', { ...touch, changedTouches: [touch], touches: [] });
        h.clock.flushMicrotasks();
        await h.waitFor(() => h.renderedText().includes('Press and hold'));
        assert.match(h.renderedText(), /Press and hold/);
      }
      if (name === 'css-engine') {
        assert.equal(classes('u-px')[0]!.props['width'], 64);
        assert.equal(classes('u-rem')[0]!.props['width'], 64);
        h.press('Move it');
        assert.equal(classes('slider-end').length, 1);
        h.press('Move it');
        assert.equal(classes('slider-end').length, 0);
      }
      h.root.dispose();
      assert.equal(h.clock.frames.size, 0);
      assert.deepEqual(fixture.errors, []);
    });
  }

  test(`actual ${platform} CSS catalogue, nested text and Tailwind retain their native content`, async (t) => {
    const fixture = consumerFixture(() => [
      { path: 'css', component: CssPage },
      { path: 'text', component: TextNesting },
      { path: 'tailwind', component: TailwindPage },
    ]);
    const h = bootConsumer(fixture, platform),
      nav = fixture.navigation();
    t.after(() => h.root.dispose());
    await nav.reset('/css');
    h.finish();
    for (const name of [
      'Selectors',
      'Cascade',
      'Inheritance',
      'Tokens (var)',
      'Media queries',
      'Pseudo-state',
      'Units',
      'Properties',
    ])
      assert.ok(h.renderedText().includes(name), name);
    const id = h.nodes().find((node) => node.props['nativeID'] === 'by-id')!;
    assert.ok(id);
    assert.ok(
      h.nodes().some((node) => node.instanceHandle.componentHost && node.props['rowGap'] === 18),
    );
    await nav.reset('/text');
    h.finish();
    const spans = h.nodes().filter((node) => node.viewName === 'VirtualText');
    assert.equal(spans.length, 5);
    assert.ok(spans.some((node) => node.props['fontSize'] === 12));
    assert.ok(spans.some((node) => node.props['fontWeight'] === 700));
    await nav.reset('/tailwind');
    h.finish();
    for (const group of reference.tailwindClasses) {
      const tokens = group.split(/\s+/);
      assert.ok(
        h.nodes().some((node) => tokens.every((token) => node.instanceHandle.classes?.has(token))),
        group,
      );
    }
    assert.deepEqual(fixture.errors, []);
  });
}
