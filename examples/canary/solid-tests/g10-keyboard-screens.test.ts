import assert from 'node:assert/strict';
import { test } from 'node:test';
import { provideService } from '@solid-native/device/solid';
import { DeviceOrientation } from '@solid-native/expo/solid/orientation';
import type { FakeNode } from '../../../packages/platform/solid-tests/fake-fabric.ts';
import { consumerFixture } from './consumer-fixture.tsx';
import { bootConsumer } from './consumer-harness.ts';
import { KeyboardLab } from '../src/app/keyboard/keyboard-lab.solid.tsx';
import { NoteSheet } from '../src/app/keyboard/note-sheet.solid.tsx';

for (const platform of ['ios', 'android'] as const) {
  test(`actual ${platform} keyboard page retains carousel, focus, dock, sheet save and rotation cleanup`, async (t) => {
    const locks: string[] = [],
      released: string[] = [];
    const fixture = consumerFixture(
      () => [
        { path: 'keyboard', component: KeyboardLab },
        { path: 'keyboard/sheet', component: NoteSheet },
      ],
      [
        provideService(DeviceOrientation, () => ({
          orientation: () => 'unknown',
          landscape: () => false,
          error: () => null,
          lock(value) {
            locks.push(value);
            return () => {
              released.push(value);
            };
          },
        })),
      ],
    );
    const h = bootConsumer(fixture, platform),
      nav = fixture.navigation();
    t.after(() => h.root.dispose());
    const focuses: unknown[] = [];
    Object.assign(h.fabric, {
      dispatchCommand(node: FakeNode, name: string) {
        if (name === 'focus') focuses.push(node.props['accessibilityLabel']);
      },
    });
    await nav.reset('/keyboard');
    h.finish();
    const email = h.nodes().find((node) => node.props['accessibilityLabel'] === 'Email')!;
    h.fabric.emit(email, 'topSubmitEditing', { text: '' });
    h.clock.flushMicrotasks();
    assert.deepEqual(focuses, ['Amount']);
    for (const label of [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Row 8',
      'The last field on the page',
    ])
      assert.ok(h.renderedText().includes(label), label);
    h.input('Quick note', 'Keep me');
    h.press('Rotate to landscape');
    h.press('Back to portrait');
    assert.deepEqual(locks, ['landscape', 'portrait']);
    assert.deepEqual(released, ['landscape']);
    h.press('Edit a note in a sheet');
    await h.waitFor(() => nav.transition() !== null);
    h.finish();
    h.press('Save');
    await h.waitFor(() => h.renderedText().includes('Give the note a title'));
    assert.doesNotMatch(h.renderedText(), /Saved:/);
    h.input('Title', 'Groceries');
    h.input('Body', 'Milk');
    h.press('Save');
    await h.waitFor(() => nav.transition() !== null);
    h.finish();
    assert.match(h.renderedText(), /Saved: Groceries/);
    assert.equal(
      h.nodes().find((node) => node.props['accessibilityLabel'] === 'Quick note')?.props['text'],
      'Keep me',
    );
    h.root.dispose();
    assert.deepEqual(released, ['landscape', 'portrait']);
    assert.deepEqual(fixture.errors, []);
  });
}
