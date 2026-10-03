import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createNativeRoot, type HostChild } from '@solidnative/platform/solid';
import { registerPlatformComponents, type FabricNode } from '@solidnative/fabric';
import { autofillFixture, keyboardTapFixture } from './g6-auth-input-fixture.tsx';
import {
  createFakeFabric,
  createClock,
  type FakeNode,
} from '../../platform/solid-tests/fake-fabric.ts';

function flatten(nodes: readonly FakeNode[]): FakeNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}

function boot(fixture: { Scene: () => HostChild }) {
  const commands: { node: FabricNode; name: string; args: readonly unknown[] }[] = [];
  const errors: unknown[] = [];
  const fabric = Object.assign(createFakeFabric(), {
    dispatchCommand(node: FabricNode, name: string, args: readonly unknown[]) {
      commands.push({ node, name, args });
    },
  });
  const clock = createClock();
  const root = createNativeRoot({
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
  const touch = (id: string, type: string) => {
    const point = { pageX: 10, pageY: 10, identifier: 1 };
    fabric.emit(find(id), type, {
      ...point,
      touches: type === 'topTouchEnd' || type === 'topTouchCancel' ? [] : [point],
      changedTouches: [point],
    });
  };
  const tap = (id: string) => {
    touch(id, 'topTouchStart');
    touch(id, 'topTouchEnd');
    clock.flushMicrotasks();
  };
  return { root, fabric, clock, commands, errors, find, touch, tap };
}

for (const platform of ['ios', 'android'] as const) {
  test(`${platform}: autofill names map to native hints, explicit content type wins, and hints clear reactively`, () => {
    registerPlatformComponents(platform);
    const fixture = autofillFixture();
    const { root, find, clock, commands } = boot(fixture);
    try {
      const tag = find('input').tag;
      assert.equal(find('input').viewName, platform === 'ios' ? 'TextInput' : 'AndroidTextInput');
      const cases = [
        ['email', 'emailAddress', 'email'],
        ['username', 'username', 'username'],
        ['current-password', 'password', 'password'],
        ['new-password', 'newPassword', 'password-new'],
        ['one-time-code', 'oneTimeCode', 'sms-otp'],
        ['off', 'none', 'off'],
        ['given-name', 'givenName', 'name-given'],
        ['address-line1', 'streetAddressLine1', 'postal-address-region'],
        ['cc-number', 'creditCardNumber', 'cc-number'],
        ['bday-day', 'birthdateDay', 'birthdate-day'],
        ['password', undefined, 'password'],
        ['sms-otp', undefined, 'sms-otp'],
        ['native-future-hint', undefined, 'native-future-hint'],
        ['toString', undefined, 'toString'],
      ];
      for (const [input, ios, android] of cases) {
        fixture.setAutoComplete(input);
        clock.flushMicrotasks();
        assert.equal(
          find('input').props['autoComplete'],
          platform === 'android' ? android : undefined,
        );
        assert.equal(
          find('input').props['textContentType'] ?? undefined,
          platform === 'ios' ? ios : undefined,
        );
        assert.equal(find('input').tag, tag, 'hint changes preserve the native field');
      }
      fixture.setAutoComplete('email');
      fixture.setTextContentType('username');
      clock.flushMicrotasks();
      assert.equal(find('input').props['textContentType'], 'username');
      fixture.setTextContentType('');
      clock.flushMicrotasks();
      assert.equal(
        find('input').props['textContentType'],
        '',
        'an explicit empty native hint also wins',
      );
      fixture.setTextContentType(undefined);
      clock.flushMicrotasks();
      assert.equal(
        find('input').props['textContentType'],
        platform === 'ios' ? 'emailAddress' : null,
      );
      fixture.setAutoComplete(undefined);
      clock.flushMicrotasks();
      assert.equal(find('input').props['autoComplete'], platform === 'android' ? null : undefined);
      assert.equal(
        find('input').props['textContentType'],
        null,
        'Fabric resets a removed prop with null',
      );
      assert.equal(find('input').instanceHandle.props['autoComplete'], undefined);
      assert.equal(find('input').instanceHandle.props['textContentType'], undefined);
      assert.equal(commands.length, 0, 'autofill props do not rewrite text or selection');
    } finally {
      root.dispose();
    }
  });

  test(`${platform}: autofill prop changes preserve native counters, composition, selection and controlled corrections`, () => {
    registerPlatformComponents(platform);
    const fixture = autofillFixture();
    const { root, fabric, find, clock, commands } = boot(fixture);
    try {
      fabric.emit(find('input'), 'topChange', {
        text: 'composing',
        eventCount: 4,
        isComposing: true,
      });
      fixture.setAutoComplete('one-time-code');
      fixture.setSelection({ start: 2 });
      clock.flushMicrotasks();
      assert.equal(find('input').props['text'], 'composing');
      assert.equal(find('input').props['mostRecentEventCount'], 4);
      assert.equal(commands.length, 0);
      fabric.emit(find('input'), 'topChange', { text: 'stale', eventCount: 3, isComposing: false });
      fabric.emit(find('input'), 'topChange', {
        text: 'composing',
        eventCount: 4,
        isComposing: false,
      });
      clock.flushMicrotasks();
      assert.deepEqual(
        commands.map(({ name, args }) => ({ name, args })),
        [{ name: 'setTextAndSelection', args: [4, 'kept', 2, 2] }],
      );
      assert.deepEqual(fixture.proposals, ['composing', 'composing']);
      fixture.setAccept(true);
      fixture.setAutoComplete('email');
      fabric.emit(find('input'), 'topChange', { text: 'accepted@example.test', eventCount: 5 });
      clock.flushMicrotasks();
      assert.equal(find('input').props['text'], 'accepted@example.test');
      assert.equal(find('input').props['mostRecentEventCount'], 5);
      assert.equal(commands.length, 1);
      fixture.setAccept(false);
      fabric.emit(find('input'), 'topChange', { text: 'rejected', eventCount: 6 });
      root.dispose();
      clock.flushMicrotasks();
      assert.equal(commands.length, 1, 'root disposal cancels pending correction');
    } finally {
      root.dispose();
    }
  });

  test(`${platform}: handled taps reach nested pressables, dismiss unhandled taps, and preserve focused-input taps`, () => {
    registerPlatformComponents(platform);
    const fixture = keyboardTapFixture('handled');
    const { root, fabric, find, tap, commands, errors } = boot(fixture);
    try {
      fabric.emit(find('input'), 'topFocus', {});
      tap('label');
      assert.equal(fixture.counts.presses, 1);
      assert.equal(commands.length, 0);
      tap('input');
      assert.equal(commands.length, 0);
      tap('blank');
      assert.equal(commands.length, 1);
      assert.equal(commands[0]?.name, 'blur');
      assert.ok(commands[0]?.node === find('input').instanceHandle.committed?.handle);
      assert.equal(find('scroll').props['keyboardShouldPersistTaps'], undefined);
      assert.equal(find('scroll').instanceHandle.props['keyboardShouldPersistTaps'], undefined);
      assert.deepEqual(errors, []);
    } finally {
      root.dispose();
    }
  });
}

test('keyboard tap policies change reactively; never captures, always passes, and disabled children do not handle', () => {
  const fixture = keyboardTapFixture();
  const { root, fabric, find, tap, clock, commands } = boot(fixture);
  try {
    fabric.emit(find('input'), 'topFocus', {});
    tap('label');
    assert.equal(fixture.counts.presses, 0, 'never is the default and captures before the child');
    assert.equal(commands.length, 1);
    fixture.setPolicy('always');
    clock.flushMicrotasks();
    tap('label');
    tap('blank');
    assert.equal(fixture.counts.presses, 1);
    assert.equal(commands.length, 1);
    fixture.setPolicy('handled');
    fixture.setDisabled(true);
    clock.flushMicrotasks();
    tap('label');
    assert.equal(fixture.counts.presses, 1);
    assert.equal(commands.length, 2, 'a disabled child does not handle the tap');
    fabric.emit(find('input'), 'topBlur', {});
    tap('blank');
    assert.equal(commands.length, 2, 'there is no focused input to dismiss');
  } finally {
    root.dispose();
  }
});

test('scrolling and touch cancellation suppress dismissal while preserving caller scroll handlers', () => {
  const fixture = keyboardTapFixture('handled');
  const { root, fabric, find, touch, tap, clock, commands } = boot(fixture);
  try {
    fabric.emit(find('input'), 'topFocus', {});
    touch('blank', 'topTouchStart');
    fabric.emit(find('scroll'), 'topScroll', { contentOffset: { x: 0, y: 40 } });
    touch('blank', 'topTouchEnd');
    assert.equal(commands.length, 0);
    assert.equal(fixture.counts.oldScrolls, 1);
    fixture.replaceScroll();
    clock.flushMicrotasks();
    touch('blank', 'topTouchStart');
    fabric.emit(find('scroll'), 'topScroll', { contentOffset: { x: 0, y: 80 } });
    touch('blank', 'topTouchEnd');
    assert.equal(commands.length, 0);
    assert.equal(fixture.counts.oldScrolls, 1);
    assert.equal(fixture.counts.newScrolls, 1);
    touch('blank', 'topTouchStart');
    touch('blank', 'topTouchCancel');
    touch('blank', 'topTouchEnd');
    assert.equal(commands.length, 0);
    tap('blank');
    assert.equal(commands.length, 1, 'the next actual tap can dismiss');
  } finally {
    root.dispose();
  }
});

test('removing a scroll view under a touch releases its responder and listeners before remount', () => {
  const fixture = keyboardTapFixture('handled');
  const { root, fabric, find, touch, tap, clock, commands, errors } = boot(fixture);
  try {
    fabric.emit(find('outside-input'), 'topFocus', {});
    const oldScroll = find('scroll');
    const oldBlank = find('blank');
    touch('blank', 'topTouchStart');
    assert.ok(
      root.engine.responder === oldScroll.instanceHandle,
      'the scroll view owns the unhandled tap',
    );
    fixture.setVisible(false);
    clock.flushMicrotasks();
    assert.equal(root.engine.responder, null);
    fabric.emit(oldBlank, 'topTouchEnd', {});
    fabric.emit(oldScroll, 'topScroll', {});
    assert.equal(commands.length, 0);
    assert.equal(fixture.counts.oldScrolls, 0);
    fixture.setVisible(true);
    clock.flushMicrotasks();
    tap('blank');
    assert.equal(commands.length, 1);
    assert.ok(commands[0]?.node === find('outside-input').instanceHandle.committed?.handle);
    touch('blank', 'topTouchStart');
    root.dispose();
    clock.flushMicrotasks();
    assert.equal(root.engine.responder, null);
    assert.equal(commands.length, 1);
    assert.deepEqual(errors, []);
  } finally {
    root.dispose();
  }
});
