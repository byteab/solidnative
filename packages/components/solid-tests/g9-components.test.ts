import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createNativeRoot, type HostChild } from '@solid-native/platform/solid';
import {
  registerPlatformComponents,
  type FabricNode,
  type HostNode,
  type ScrollRange,
} from '@solid-native/fabric';
import {
  createFakeFabric,
  createClock,
  type FakeNode,
} from '../../platform/solid-tests/fake-fabric.ts';
import { presenceFixture, inputFixture, dockFixture } from './g9-components-fixture.tsx';

const flatten = (nodes: readonly FakeNode[]): FakeNode[] =>
  nodes.flatMap((node) => [node, ...flatten(node.children)]);
function boot(
  fixture: { Scene: () => HostChild },
  platform: 'ios' | 'android' = 'ios',
  configure?: (root: ReturnType<typeof createNativeRoot>) => void,
) {
  registerPlatformComponents(platform);
  const commands: { name: string; args: readonly unknown[] }[] = [];
  const fabric = Object.assign(createFakeFabric(), {
    dispatchCommand(_node: FabricNode, name: string, args: readonly unknown[]) {
      commands.push({ name, args });
    },
  });
  const clock = createClock(),
    root = createNativeRoot({ fabric, clock, rootTag: 1 });
  configure?.(root);
  root.render(fixture.Scene);
  const all = () => flatten(fabric.roots.get(1) ?? []);
  const find = (id: string) => {
    const node = all().find((node) => node.props['testID'] === id);
    assert.ok(node, id);
    return node;
  };
  return { fabric, clock, root, all, find, commands };
}
test('Presence retains child identity and reactivity through interrupted leave, then releases exactly once', (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const fixture = presenceFixture(),
    app = boot(fixture);
  const tag = app.find('owned-child').tag;
  assert.ok(app.find('presence').instanceHandle.classes?.has('arriving'));
  context.mock.timers.tick(40);
  app.clock.flushMicrotasks();
  assert.equal(fixture.calls.filter((x) => x === 'entered').length, 1);
  fixture.setVisible(false);
  app.clock.flushMicrotasks();
  assert.ok(app.find('presence').instanceHandle.classes?.has('leaving'));
  fixture.setLabel('two');
  app.clock.flushMicrotasks();
  assert.equal(app.find('owned-child').tag, tag);
  context.mock.timers.tick(30);
  fixture.setVisible(true);
  app.clock.flushMicrotasks();
  context.mock.timers.tick(30);
  app.clock.flushMicrotasks();
  assert.equal(app.find('owned-child').tag, tag);
  assert.ok(!fixture.calls.includes('dispose'));
  context.mock.timers.tick(10);
  fixture.setVisible(false);
  app.clock.flushMicrotasks();
  context.mock.timers.tick(60);
  app.clock.flushMicrotasks();
  assert.equal(app.all().length, 0);
  assert.deepEqual(
    fixture.calls.filter((x) => ['mount', 'dispose', 'exited'].includes(x)),
    ['mount', 'dispose', 'exited'],
  );
  fixture.setLabel('late');
  assert.ok(!fixture.calls.includes('label:late'));
  app.root.dispose();
  context.mock.timers.tick(1000);
  assert.equal(fixture.calls.filter((x) => x === 'dispose').length, 1);
});
test('Presence exit callback reentry creates a replacement without old timer or cleanup destroying it', (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const fixture = presenceFixture({ exited: () => fixture.setVisible(true) }),
    app = boot(fixture);
  const first = app.find('owned-child').tag;
  fixture.setVisible(false);
  app.clock.flushMicrotasks();
  context.mock.timers.tick(60);
  app.clock.flushMicrotasks();
  assert.notEqual(app.find('owned-child').tag, first);
  context.mock.timers.tick(100);
  app.clock.flushMicrotasks();
  assert.equal(fixture.calls.filter((x) => x === 'mount').length, 2);
  assert.equal(fixture.calls.filter((x) => x === 'dispose').length, 1);
  app.root.dispose();
  context.mock.timers.tick(1000);
  assert.equal(fixture.calls.filter((x) => x === 'dispose').length, 2);
});
test('Presence root disposal cancels pending exit and never calls completion on a dead owner', (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const fixture = presenceFixture(),
    app = boot(fixture);
  fixture.setVisible(false);
  app.clock.flushMicrotasks();
  app.root.dispose();
  context.mock.timers.tick(1000);
  assert.deepEqual(
    fixture.calls.filter((x) => ['dispose', 'exited', 'entered'].includes(x)),
    ['dispose'],
  );
  assert.equal(app.all().length, 0);
});
test('TextInput forwards full legacy platform hints, emits typed events and reveals focus above keyboard', () => {
  const fixture = inputFixture();
  const reveals: unknown[] = [];
  const app = boot(fixture, 'ios', (root) => {
    root.engine.reveal = (_node, options) => {
      reveals.push(options);
    };
  });
  const input = app.find('input');
  const expected = {
    keyboardType: 'visible-password',
    returnKeyType: 'previous',
    selectTextOnFocus: true,
    caretHidden: false,
    contextMenuHidden: true,
    textAlign: 'right',
    allowFontScaling: false,
    maxFontSizeMultiplier: 2,
    clearButtonMode: 'always',
    clearTextOnFocus: true,
    enablesReturnKeyAutomatically: true,
    keyboardAppearance: 'dark',
    passwordRules: 'minlength: 8;',
    spellCheck: false,
    smartInsertDelete: false,
    dataDetectorTypes: ['link'],
    cursorColor: 'red',
    selectionHandleColor: 'blue',
    textAlignVertical: 'top',
    importantForAutofill: 'yes',
    showSoftInputOnFocus: false,
    disableFullscreenUI: true,
    inlineImageLeft: 'mail',
    inlineImagePadding: 10,
    textBreakStrategy: 'balanced',
  };
  for (const [key, value] of Object.entries(expected))
    assert.deepEqual(input.props[key], value, key);
  app.fabric.emit(input, 'topFocus', { target: input.tag });
  assert.deepEqual(reveals, [{ visibleBottom: 300 }]);
  app.fabric.emit(input, 'topKeyPress', { key: 'Enter' });
  app.fabric.emit(input, 'topContentSizeChange', { contentSize: { width: 100, height: 50 } });
  app.fabric.emit(input, 'topScroll', { contentOffset: { x: 0, y: 12 } });
  app.fabric.emit(input, 'topSubmitEditing', { text: 'kept', eventCount: 0, target: input.tag });
  app.fabric.emit(input, 'topEndEditing', { text: 'kept', eventCount: 0, target: input.tag });
  app.fabric.emit(input, 'topBlur', { target: input.tag });
  assert.deepEqual(fixture.events, [
    'focus',
    ['key', 'Enter'],
    ['size', 50],
    ['scroll', 12],
    ['submit', 'kept'],
    ['end', 'kept'],
    'touched',
    'blur',
  ]);
  fixture.setMetrics({ height: 0 });
  app.fabric.emit(input, 'topFocus', {});
  assert.equal(reveals.length, 1);
  app.root.dispose();
});
test('TextInput clear is a parent-authoritative proposal; accepted clear uses latest native count and dead refs are inert', () => {
  const fixture = inputFixture(),
    app = boot(fixture);
  app.fabric.emit(app.find('input'), 'topChange', { text: 'native', eventCount: 4 });
  app.clock.flushMicrotasks();
  assert.deepEqual(fixture.events, [
    ['proposal', 'native'],
    ['text', 'native'],
    ['change', 4],
  ]);
  fixture.input().clear();
  app.clock.flushMicrotasks();
  assert.equal(app.find('input').props['text'], 'kept');
  fixture.setAccept(true);
  fixture.input().clear();
  app.clock.flushMicrotasks();
  assert.equal(app.find('input').props['text'], '');
  assert.deepEqual(app.commands.at(-1)?.args, [4, '', -1, -1]);
  app.root.dispose();
  const count = fixture.events.length;
  fixture.input().clear();
  fixture.input().focus();
  app.clock.flushMicrotasks();
  assert.equal(fixture.events.length, count);
});
test('TextInput disabled and readOnly reject edits without corrupting monotonic event corrections', () => {
  const fixture = inputFixture(),
    app = boot(fixture);
  fixture.setAccept(true);
  fixture.setDisabled(true);
  app.clock.flushMicrotasks();
  assert.equal(app.find('input').props['editable'], false);
  app.fabric.emit(app.find('input'), 'topChange', { text: 'no', eventCount: 2 });
  app.clock.flushMicrotasks();
  fixture.setDisabled(false);
  fixture.setReadOnly(true);
  app.clock.flushMicrotasks();
  app.fabric.emit(app.find('input'), 'topChange', { text: 'never', eventCount: 3 });
  app.clock.flushMicrotasks();
  assert.equal(app.find('input').props['text'], 'kept');
  assert.deepEqual(
    fixture.events.filter((x) => Array.isArray(x) && x[0] === 'proposal'),
    [],
  );
  assert.deepEqual(
    app.commands.map((x) => x.args),
    [
      [2, 'kept', -1, -1],
      [3, 'kept', -1, -1],
    ],
  );
  app.root.dispose();
});
test('KeyboardDock fallback measures overlap, avoids double inset in resized windows, and dismisses covered screens', () => {
  const fixture = dockFixture(false),
    app = boot(fixture, 'android', (root) => {
      root.engine.measure = (_node, callback) => callback({ x: 0, y: 600, width: 400, height: 50 });
    });
  assert.equal(app.find('dock').props['paddingBottom'], 20);
  app.fabric.emit(app.find('dock'), 'topLayout', {
    layout: { x: 0, y: 600, width: 400, height: 50 },
  });
  app.clock.flushMicrotasks();
  fixture.setMetrics({ height: 300, screenY: 500 });
  app.clock.flushMicrotasks();
  assert.equal(app.find('dock').props['paddingBottom'], 150);
  fixture.setMetrics({ height: 300, screenY: 650 });
  app.clock.flushMicrotasks();
  assert.equal(app.find('dock').props['paddingBottom'], 0);
  fixture.setFront(false);
  assert.equal(fixture.dismisses(), 1);
  fixture.setMetrics({ height: 0 });
  app.clock.flushMicrotasks();
  assert.equal(app.find('dock').props['paddingBottom'], 20);
  assert.equal(fixture.dock()?.lift(app.find('transcript').instanceHandle), null);
  app.root.dispose();
});
test('KeyboardDock native drive acquisition waits for commit and foreground changes release bar and lift', () => {
  const fixture = dockFixture(),
    drives: {
      view: HostNode;
      stopped: number;
      range: ScrollRange;
      shift: number | null | undefined;
    }[] = [];
  const app = boot(fixture, 'ios', (root) => {
    root.engine.driveByEvent = (view, source, feed, property, range, _statics, shift) => {
      assert.ok(view.parent);
      assert.ok(source.parent);
      assert.equal(property, 'translateY');
      assert.deepEqual(feed.path, ['height']);
      const drive = { view, stopped: 0, range, shift };
      drives.push(drive);
      return {
        update(value) {
          drive.range = value;
        },
        shift(value) {
          drive.shift = value;
        },
        stop() {
          drive.stopped++;
        },
      };
    };
  });
  assert.equal(drives.length, 2);
  assert.ok(drives.every((drive) => drive.stopped === 0));
  const controller = app.all().find((node) => node.viewName === 'KeyboardControllerView')!;
  assert.ok(controller);
  const gesture = app.all().find((node) => node.viewName === 'KeyboardGestureArea')!;
  assert.equal(gesture.props['textInputNativeID'], 'composer');
  app.fabric.emit(controller, 'topKeyboardMoveEnd', { height: 300 });
  app.clock.flushMicrotasks();
  assert.equal(fixture.dock()?.covered(), 280);
  assert.equal(app.find('transcript').props['paddingBottom'], 280);
  assert.ok(drives.some((drive) => drive.shift === 280));
  fixture.setFront(false);
  app.clock.flushMicrotasks();
  assert.ok(drives.every((drive) => drive.stopped === 1));
  assert.equal(app.find('transcript').props['paddingBottom'], 5);
  const count = drives.length;
  fixture.setFront(true);
  app.clock.flushMicrotasks();
  assert.equal(drives.length, count + 2);
  fixture.setInset(30);
  app.clock.flushMicrotasks();
  assert.deepEqual(fixture.dock()?.liftRange().input, [30, 10030]);
  app.root.dispose();
  assert.ok(drives.every((drive) => drive.stopped === 1));
});
test('Presence exit contains a throwing sibling cleanup and throwing reporter without leaking child reactivity', (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  context.mock.method(console, 'error', () => {
    throw new Error('reporter failed');
  });
  const fixture = presenceFixture({ throwCleanup: true }),
    app = boot(fixture);
  fixture.setVisible(false);
  app.clock.flushMicrotasks();
  context.mock.timers.tick(60);
  app.clock.flushMicrotasks();
  assert.equal(app.all().length, 0);
  fixture.setLabel('late');
  assert.ok(!fixture.calls.includes('label:late'));
  assert.equal(fixture.calls.filter((x) => x === 'dispose').length, 1);
  assert.equal(fixture.calls.filter((x) => x === 'exited').length, 1);
  app.root.dispose();
});
