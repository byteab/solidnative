import assert from 'node:assert/strict';
import { test } from 'node:test';
import { provideService } from '@solidnative/device/solid';
import { NATIVE_STATE_SOURCE, registerExpoUiViews } from '@solidnative/expo/solid';
import { ExpoUiPage } from '../src/app/expo/expo-ui.solid.tsx';
import { consumerFixture } from './consumer-fixture.tsx';
import { bootConsumer } from './consumer-harness.ts';

test('actual SwiftUI examples preserve every section, control event and owned native text state', async (t) => {
  registerExpoUiViews('ios');
  let value = '',
    released = 0;
  const fixture = consumerFixture(
    () => [{ path: 'expo-ui', component: ExpoUiPage }],
    [
      provideService(NATIVE_STATE_SOURCE, () => ({
        create: () => ({
          __expo_shared_object_id__: 71,
          getValue: () => value,
          setValue: (next) => {
            value = String(next.value);
          },
          release: () => {
            released++;
          },
        }),
      })),
    ],
  );
  const h = bootConsumer(fixture);
  t.after(() => h.root.dispose());
  await fixture.navigation().reset('/expo-ui');
  h.finish();
  for (const title of [
    'Controls',
    'Indicators',
    'Layout',
    'Slider',
    'Picker',
    'Button roles',
    'Toggle',
    'Stepper',
    'Text field',
    'Colour picker',
    'Date picker',
    'Gauge',
    'Progress',
    'hstack and vstack',
    'Section in a form',
  ])
    assert.ok(h.renderedText().includes(title), title);
  const find = (name: string, label?: string) => {
    const node = h
      .nodes()
      .find(
        (node) => node.instanceHandle.name === name && (!label || node.props['label'] === label),
      );
    assert.ok(node, `${name} ${label ?? ''}`);
    return node;
  };
  const emit = (name: string, event: string, payload: Record<string, unknown>, label?: string) => {
    h.fabric.emit(find(name, label), event, payload);
    h.clock.flushMicrotasks();
  };
  const hosts = h.nodes().filter((node) => node.instanceHandle.name === 'ui-host');
  assert.equal(hosts.length, 13);
  for (const host of hosts) {
    assert.equal(host.props['matchContentsVertical'], true);
    assert.equal(host.props['ignoreSafeArea'], 'container');
  }
  assert.equal(find('ui-text-field').props['text'], 71);
  assert.deepEqual(find('ui-date-picker').props['modifiers'], [
    { $type: 'datePickerStyle', style: 'compact' },
  ]);
  emit('ui-slider', 'topValueChanged', { value: 0.75 });
  assert.equal(find('ui-gauge').props['value'], 0.75);
  assert.equal(find('ui-progress').props['value'], 0.75);
  emit('ui-picker', 'topSelectionChange', { selection: 'Large' });
  assert.equal(find('ui-picker').props['selection'], 'Large');
  emit('ui-toggle', 'topIsOnChange', { isOn: false }, 'Wi-Fi');
  assert.equal(find('ui-toggle', 'Bold text').props['isOn'], false);
  emit('ui-button', 'topButtonPress', {}, 'Press me');
  assert.match(h.renderedText(), /pressed 1 times/);
  emit('ui-stepper', 'topValueChange', { value: 4 });
  assert.equal(find('ui-stepper').props['value'], 4);
  emit('ui-text-field', 'topTextChange', { value: 'Grace' });
  assert.match(h.renderedText(), /Grace/);
  h.press('set it from Solid');
  assert.equal(value, 'Ada Lovelace');
  h.root.dispose();
  assert.equal(released, 1);
  assert.deepEqual(fixture.errors, []);
});
