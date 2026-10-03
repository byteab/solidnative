/**
 * The `@expo/ui` pickers as controlled form fields. A form with a date and a choice in it is most
 * forms, and a control that needs its own event wiring and conversion is a control every app gets
 * slightly wrong: SwiftUI takes the date as ISO text and Compose as milliseconds, and they report a
 * change under different event names (Compose's dialect is `ui-form-android.test.ts`, since a
 * process that has rendered Android stays Android).
 *
 * What is covered is the control's own contract: `value`/`onValueChange`/`onTouch`/`disabled`.
 */
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { registerExpoUiViews } from '@solidnative/expo';
import { createNativeRoot } from '@solidnative/platform/solid';
import {
  createFakeFabric,
  type FakeFabric,
  type FakeFabricNode as FakeNode,
} from '@solidnative/testing';
import { ExpoUiDisabled, ExpoUiHosts, expoUiFormFixture } from './expo-ui-form-fixture.tsx';

const flatten = (nodes: readonly FakeNode[]): FakeNode[] =>
  nodes.flatMap((node) => [node, ...flatten(node.children)]);

let fabric: FakeFabric;
let root: ReturnType<typeof createNativeRoot>;
const byId = (id: string) =>
  flatten(fabric.committed).find((node) => node.props['nativeID'] === id)!;
function render(View: () => unknown) {
  registerExpoUiViews('ios');
  fabric = createFakeFabric();
  root = createNativeRoot({ fabric, rootTag: 1 });
  root.render(View as never);
}
const emit = (id: string, type: string, payload: Record<string, unknown>) => {
  fabric.emit(byId(id), type, payload);
  root.flush();
};
afterEach(() => root.dispose());

describe('a date picker in a form', () => {
  let form: ReturnType<typeof expoUiFormFixture>;
  beforeEach(() => {
    form = expoUiFormFixture();
    render(form.View);
  });

  it('shows the field s date, as SwiftUI takes it', () => {
    assert.equal(byId('date').props['selection'], '2026-10-01T09:00:00.000Z');
  });

  it('writes the date the user picks into the form', () => {
    emit('date', 'topDateChange', { date: '2026-12-24T18:30:00.000Z' });
    assert.equal(form.arrival()!.toISOString(), '2026-12-24T18:30:00.000Z');
    assert.equal(byId('date').props['selection'], '2026-12-24T18:30:00.000Z');
  });

  it('does not take the date SwiftUI reports as it appears for one the user chose', () => {
    form.setArrival(null);
    root.flush();
    // SwiftUI's picker always shows a date, and reports it the moment it appears.
    emit('date', 'topDateChange', { date: Date.now() });
    assert.equal(form.arrival(), null, 'the field is still empty');
  });

  it('reports a touch once the user picks, so the field s errors show', () => {
    assert.equal(form.touched.arrival, 0);
    emit('date', 'topDateChange', { date: '2026-12-24T18:30:00.000Z' });
    assert.equal(form.touched.arrival, 1);
  });

  it('is disabled when the form says so', () => {
    form.setLocked(true);
    root.flush();
    const modifiers = byId('date').props['modifiers'] as { $type: string }[];
    assert.deepEqual(
      modifiers.find((modifier) => modifier.$type === 'disabled'),
      { $type: 'disabled', disabled: true },
    );
  });
});

describe('a picker in a form', () => {
  let form: ReturnType<typeof expoUiFormFixture>;
  beforeEach(() => {
    form = expoUiFormFixture();
    render(form.View);
  });

  it('draws its options and selects the field s value', () => {
    const room = byId('room');
    assert.equal(room.props['selection'], 'double');
    assert.deepEqual(room.props['modifiers'], [{ $type: 'pickerStyle', style: 'menu' }]);
    const options = flatten([room]).filter((node) => typeof node.props['text'] === 'string');
    assert.deepEqual(
      options.map((node) => [node.props['text'], node.props['modifiers']]),
      [
        ['Single', [{ $type: 'tag', tag: 'single' }]],
        ['Double', [{ $type: 'tag', tag: 'double' }]],
        ['Suite', [{ $type: 'tag', tag: 'suite' }]],
      ],
    );
  });

  it('reports a touch once the user picks', () => {
    emit('room', 'topSelectionChange', { selection: 'suite' });
    assert.equal(form.touched.room, 1);
  });

  it('writes the option the user picks into the form', () => {
    emit('room', 'topSelectionChange', { selection: 'suite' });
    assert.equal(form.room(), 'suite');
    assert.equal(byId('room').props['selection'], 'suite');
  });
});

describe('a picker outside a form', () => {
  it('is disabled by a bare disabled', () => {
    render(ExpoUiDisabled);
    for (const id of ['bare-date', 'bare-room']) {
      const modifiers = (byId(id).props['modifiers'] ?? []) as { $type: string }[];
      assert.ok(
        modifiers.some((modifier) => modifier.$type === 'disabled'),
        `${id} is disabled`,
      );
    }
  });
});

describe('a SwiftUI host', () => {
  // The native host reads one flag per axis; `@expo/ui`'s React wrapper splits `matchContents`
  // into them. Passed through whole, it is a prop native ignores: the host keeps no size, and the
  // control drawn in it is outside it, where no touch or screen reader reaches.
  it('sizes itself to its content through the flags native reads', () => {
    render(ExpoUiHosts);
    const both = byId('both').props;
    const tall = byId('tall').props;
    assert.equal(both['matchContents'], undefined);
    assert.equal(both['matchContentsVertical'], true);
    assert.equal(both['matchContentsHorizontal'], true);
    assert.equal(tall['matchContentsVertical'], true);
    assert.equal(tall['matchContentsHorizontal'], undefined);
  });
});
