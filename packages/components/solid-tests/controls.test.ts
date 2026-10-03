import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createNativeRoot, type HostChild } from '@solid-native/platform/solid';
import {
  registerPlatformComponents,
  registerViewName,
  type FabricNode,
} from '@solid-native/fabric';
import { inputFixture, switchFixture } from './compiled-fixture.tsx';
import {
  createFakeFabric,
  createClock,
  type FakeNode,
} from '../../platform/solid-tests/fake-fabric.ts';

function flatten(nodes: readonly FakeNode[]): FakeNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}
function boot(fixture: { Scene: () => HostChild }) {
  const commands: { name: string; args: readonly unknown[] }[] = [];
  const fabric = Object.assign(createFakeFabric(), {
    dispatchCommand(_node: FabricNode, name: string, args: readonly unknown[]) {
      commands.push({ name, args });
    },
  });
  const errors: unknown[] = [];
  const clock = createClock(),
    root = createNativeRoot({
      fabric,
      clock,
      rootTag: 1,
      engineOptions: { onError: (error) => errors.push(error) },
    });
  root.render(fixture.Scene);
  const find = (id: string) => {
    const node = flatten(fabric.roots.get(1) ?? []).find((entry) => entry.props['testID'] === id);
    assert.ok(node, id);
    return node;
  };
  const change = (id: string, payload: object) => fabric.emit(find(id), 'topChange', payload);
  return { root, fabric, clock, commands, find, change, errors };
}

test('controlled text accepts, rejects repeatedly at the same value, and rewrites after commit', () => {
  const fixture = inputFixture({ controlled: true, value: '12', mode: 'reject' });
  const { root, change, clock, commands, find } = boot(fixture);
  change('input', { text: '12a', eventCount: 1 });
  assert.equal(commands.length, 0, 'correction waits for the host commit');
  clock.flushMicrotasks();
  change('input', { text: '12b', eventCount: 2 });
  clock.flushMicrotasks();
  assert.deepEqual(
    commands.map((entry) => entry.args),
    [
      [1, '12', -1, -1],
      [2, '12', -1, -1],
    ],
  );
  fixture.setMode('accept');
  change('input', { text: '123', eventCount: 3 });
  clock.flushMicrotasks();
  assert.equal(fixture.value(), '123');
  assert.equal(commands.length, 2);
  fixture.setMode('uppercase');
  change('input', { text: 'ab', eventCount: 4 });
  clock.flushMicrotasks();
  assert.equal(find('input').props['text'], 'AB');
  assert.deepEqual(commands.at(-1)?.args, [4, 'AB', -1, -1]);
  fixture.setValue('');
  clock.flushMicrotasks();
  assert.deepEqual(commands.at(-1)?.args, [4, '', -1, -1]);
  root.dispose();
});

test('rapid text changes coalesce against the newest count and stale/duplicate events are ignored', () => {
  const fixture = inputFixture({ controlled: true, value: 'kept', mode: 'reject' });
  const { root, change, clock, commands, find } = boot(fixture);
  change('input', { text: 'a', eventCount: 1 });
  change('input', { text: 'abc', eventCount: 3 });
  change('input', { text: 'ab', eventCount: 2 });
  change('input', { text: 'duplicate', eventCount: 3 });
  clock.flushMicrotasks();
  assert.deepEqual(fixture.proposals, ['a', 'abc']);
  assert.equal(find('input').props['mostRecentEventCount'], 3);
  assert.deepEqual(
    commands.map((entry) => entry.args),
    [[3, 'kept', -1, -1]],
  );
  root.dispose();
});

test('explicit composition holds both text props and correction until the latest composition end', () => {
  const fixture = inputFixture({ controlled: true, value: '', mode: 'uppercase' });
  const { root, change, clock, commands, find } = boot(fixture);
  change('input', { text: 'ab', eventCount: 1, isComposing: true });
  clock.flushMicrotasks();
  assert.equal(find('input').props['text'], 'ab');
  assert.equal(commands.length, 0);
  change('input', { text: 'abc', eventCount: 2, isComposing: true });
  clock.flushMicrotasks();
  change('input', { text: 'abc', eventCount: 2, isComposing: false });
  clock.flushMicrotasks();
  assert.deepEqual(
    commands.map((entry) => entry.args),
    [[2, 'ABC', -1, -1]],
  );
  assert.equal(find('input').props['text'], 'ABC');
  root.dispose();
});

test('selection commands carry the current count and owner disposal cancels pending correction/ref work', () => {
  const fixture = inputFixture({ controlled: true, value: 'hello', mode: 'accept' });
  const { root, change, clock, commands, find, fabric } = boot(fixture);
  change('input', { text: 'hello!', eventCount: 5 });
  clock.flushMicrotasks();
  fixture.setSelection({ start: 2 });
  clock.flushMicrotasks();
  assert.deepEqual(commands.at(-1)?.args, [5, null, 2, 2]);
  fabric.emit(find('input'), 'topSelectionChange', { selection: { start: 4 }, eventCount: 5 });
  clock.flushMicrotasks();
  assert.deepEqual(commands.at(-1)?.args, [5, null, 2, 2]);
  fixture.ref().setSelection(3, 4);
  clock.flushMicrotasks();
  assert.deepEqual(commands.at(-1)?.args, [5, null, 3, 4]);
  const before = commands.length;
  fixture.setMode('reject');
  change('input', { text: 'rejected', eventCount: 6 });
  fixture.ref().blur();
  fixture.setVisible(false);
  clock.flushMicrotasks();
  assert.equal(commands.length, before);
  root.dispose();
});

test('uncontrolled text stays local when a later value appears, with disabled/readOnly and form state', () => {
  const fixture = inputFixture({ value: 'initial' });
  const { root, change, clock, commands, find, fabric } = boot(fixture);
  change('input', { text: 'typed', eventCount: 1 });
  clock.flushMicrotasks();
  fixture.setValue('external');
  clock.flushMicrotasks();
  assert.equal(find('input').props['text'], 'typed');
  assert.equal(commands.length, 0);
  fixture.setReadOnly(true);
  fixture.setInvalid(true);
  clock.flushMicrotasks();
  assert.equal(find('input').props['editable'], false);
  fabric.emit(find('input'), 'topBlur', {});
  clock.flushMicrotasks();
  assert.equal(find('input').instanceHandle.props['data-touched'], '');
  assert.equal(find('input').instanceHandle.props['data-invalid'], '');
  fixture.setDisabled(true);
  clock.flushMicrotasks();
  assert.deepEqual(find('input').props['accessibilityState'], { disabled: true });
  change('input', { text: 'unexpected', eventCount: 2 });
  clock.flushMicrotasks();
  assert.deepEqual(fixture.proposals, ['typed']);
  assert.deepEqual(commands.at(-1)?.args, [2, 'typed', -1, -1]);
  root.dispose();
});

test('switch supports controlled rejection/acceptance, local mode, disabled, blur and platform commands', () => {
  for (const platform of ['ios', 'android'] as const) {
    registerPlatformComponents(platform);
    const fixture = switchFixture({ controlled: true, accept: false });
    const { root, change, clock, commands, find, fabric } = boot(fixture);
    try {
      change('switch', { value: true });
      clock.flushMicrotasks();
      change('switch', { value: true });
      clock.flushMicrotasks();
      assert.deepEqual(
        commands.map((entry) => [entry.name, ...entry.args]),
        [
          [platform === 'ios' ? 'setValue' : 'setNativeValue', false],
          [platform === 'ios' ? 'setValue' : 'setNativeValue', false],
        ],
      );
      fixture.setAccept(true);
      change('switch', { value: true });
      clock.flushMicrotasks();
      assert.equal(find('switch').props['value'], true);
      assert.equal(commands.length, 2);
      assert.equal(find('switch').props['accessibilityRole'], 'switch');
      fixture.setDisabled(true);
      fixture.setInvalid(true);
      fabric.emit(find('switch'), 'topBlur', {});
      clock.flushMicrotasks();
      assert.deepEqual(find('switch').props['accessibilityState'], {
        checked: true,
        disabled: true,
      });
      assert.equal(find('switch').instanceHandle.props['data-touched'], '');
      assert.equal(find('switch').instanceHandle.props['data-invalid'], '');
      change('switch', { value: false });
      clock.flushMicrotasks();
      assert.equal(fixture.value(), true);
    } finally {
      root.dispose();
    }
  }
  registerPlatformComponents('ios');
  registerViewName('switch', 'Switch');
  registerViewName('text-input', 'TextInput');
  const fixture = switchFixture();
  const { root, change, clock, commands, find } = boot(fixture);
  change('switch', { value: true });
  clock.flushMicrotasks();
  fixture.setValue(false);
  clock.flushMicrotasks();
  assert.equal(find('switch').props['value'], true);
  assert.equal(commands.length, 0);
  root.dispose();
});

test('external text reaches the initial native field and throwing proposal callbacks still reconcile', () => {
  const fixture = inputFixture({ controlled: true, value: 'initial', mode: 'throw' });
  const { root, change, clock, commands, find, errors } = boot(fixture);
  fixture.setValue('external');
  clock.flushMicrotasks();
  assert.equal(find('input').props['text'], 'external');
  assert.equal(commands.length, 0);
  change('input', { text: 'rejected', eventCount: 1 });
  clock.flushMicrotasks();
  assert.equal(errors.length, 1);
  assert.deepEqual(commands.at(-1)?.args, [1, 'external', -1, -1]);
  root.dispose();
});

test('typed refs reject retained nodes under a detached ancestor and work after reattachment', () => {
  const fixture = inputFixture({ controlled: true, value: 'initial' });
  const { root, clock, commands, find } = boot(fixture);
  const ancestor = find('input').instanceHandle.parent!;
  const container = ancestor.parent!;
  assert.equal(fixture.ref().isAttached(), true);
  root.engine.removeChild(container, ancestor);
  assert.equal(fixture.ref().isAttached(), false);
  fixture.ref().blur();
  fixture.ref().setSelection(1);
  clock.flushMicrotasks();
  assert.equal(commands.length, 0);
  root.engine.insertBefore(container, ancestor, null);
  clock.flushMicrotasks();
  assert.equal(fixture.ref().isAttached(), true);
  fixture.ref().blur();
  clock.flushMicrotasks();
  assert.equal(commands.at(-1)?.name, 'blur');
  root.dispose();
  assert.equal(fixture.ref().isAttached(), false);
});

test('accepted typing commits once while subsequent programmatic text is remeasured', () => {
  const fixture = inputFixture({ controlled: true, value: '' });
  const { root, change, clock, commands, fabric } = boot(fixture);
  const initial = fabric.commits;
  change('input', { text: 'a long message that wrapped onto three lines', eventCount: 1 });
  clock.flushMicrotasks();
  assert.equal(fabric.commits, initial + 1);
  assert.equal(commands.length, 0);
  fixture.setValue('');
  clock.flushMicrotasks();
  assert.equal(fabric.commits, initial + 3, 'one text commit followed by remeasurement');
  assert.deepEqual(commands.at(-1)?.args, [1, '', -1, -1]);
  root.dispose();
});

test('a track colour reaches native converted, under every name each platform reads it by', () => {
  registerPlatformComponents('android');
  registerViewName('switch', 'Switch');
  const fabric = createFakeFabric();
  const root = createNativeRoot({
    fabric,
    clock: createClock(),
    rootTag: 1,
    engineOptions: { processColor: (value) => `processed ${String(value)}` },
  });
  root.render(switchFixture({ trackColor: '#ff0000' }).Scene);
  const node = flatten(fabric.roots.get(1) ?? []).find((n) => n.props['testID'] === 'switch')!;
  // iOS's `onTintColor` is spelled like an event, and is not one.
  assert.equal(node.props['onTintColor'], 'processed #ff0000');
  // Android's converter refuses a string, so these must be converted too.
  assert.equal(node.props['trackColorForTrue'], 'processed #ff0000');
  root.dispose();
});
