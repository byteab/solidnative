import './g12-dom-register.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { provideService } from '@solid-native/device/solid';
import { DomComponent } from '@solid-native/expo/solid/dom-component';
import { consumerFixture } from './consumer-fixture.tsx';
import { bootConsumer } from './consumer-harness.ts';
const { domComponentRoutes } = await import('../src/app/dom-components/routes.solid.ts');

for (const platform of ['ios', 'android'] as const)
  test(`actual embedded signature screen preserves native inputs/outputs and cover ownership on ${platform}`, async (t) => {
    const scripts: string[] = [];
    const fixture = consumerFixture(
      () => [...domComponentRoutes, { path: 'cover', component: () => null }],
      [
        provideService(DomComponent.SOURCE, () => ({
          baseUrl: 'http://localhost:8098',
          functions: {
            injectJavaScript: async (script) => {
              scripts.push(script);
            },
          },
        })),
      ],
    );
    const h = bootConsumer(fixture, platform);
    t.after(() => h.root.dispose());
    await fixture.navigation().reset('/dom-components');
    h.finish();
    const node = h.nodes().find((entry) => entry.instanceHandle.name === 'dom-component')!;
    assert.ok(node);
    assert.match(JSON.stringify(node.props['source']), /localhost:8098\/[a-f\d]{32}\.html/);
    assert.equal(node.props['height'], 240);
    assert.deepEqual(JSON.parse(String(node.props['injectedJavaScriptObject'])), {
      inputs: { name: 'Ada Lovelace', ink: '#1c1c1e' },
    });
    const emit = (message: object) => {
      h.fabric.emit(node, 'topMessage', { data: JSON.stringify(message) });
      h.clock.flushMicrotasks();
    };
    emit({ type: 'ready', outputs: ['strokes', 'cleared'] });
    h.press('Change name');
    assert.match(scripts.at(-1)!, /Grace Hopper/);
    h.press('Change ink');
    assert.match(scripts.at(-1)!, /#c4002d/);
    emit({ type: 'output', name: 'strokes', value: 3 });
    assert.match(h.renderedText(), /3 strokes/);
    emit({ type: 'output', name: 'cleared' });
    assert.match(h.renderedText(), /0 strokes/);
    await fixture.navigation().push('/cover');
    h.finish();
    emit({ type: 'output', name: 'strokes', value: 77 });
    await fixture.navigation().back();
    h.finish();
    assert.match(h.renderedText(), /0 strokes/);
    assert.deepEqual(fixture.errors, []);
  });
