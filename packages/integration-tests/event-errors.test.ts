/**
 * An error thrown while a native event is being dispatched reaches the app's error hook.
 *
 * Fabric calls the engine's event handler synchronously from C++, in the middle of whatever
 * native was doing when it sent the event, and a throw that escapes it unwinds through that. For
 * `RNSScreen` that is the mounting transaction of a push, and the next commit reads props freed on
 * the way out. These are the whole path: component listeners, responder handlers, and listeners
 * registered on the engine directly.
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { Engine } from '@solidnative/fabric';
import { createFakeFabric } from '@solidnative/testing';
import { mountSolid } from './css-solid-harness.ts';
import { eventErrors } from './css-solid-fixtures.tsx';

const message = (error: unknown) => (error as Error).message;

describe('errors thrown during event dispatch, on the engine', () => {
  it('go to the error hook with the event name, and never out to native', () => {
    const fabric = createFakeFabric();
    const seen: [string, string][] = [];
    const engine = new Engine(fabric, 1, {
      onError: (error, topLevelType) => seen.push([message(error), topLevelType]),
    });
    const node = engine.createElement('view');
    engine.appendChild(engine.root, node);
    engine.commit();
    engine.setEventListener(node, 'topWillAppear', () => {
      throw new Error('boom');
    });

    assert.doesNotThrow(() => fabric.emit(fabric.committed[0]!, 'topWillAppear', {}));
    assert.deepEqual(seen, [['boom', 'topWillAppear']]);
  });

  it('let the rest of the path run after one listener throws', () => {
    const fabric = createFakeFabric();
    const engine = new Engine(fabric, 1, { onError: () => {} });
    const outer = engine.createElement('view');
    const inner = engine.createElement('view');
    engine.appendChild(engine.root, outer);
    engine.appendChild(outer, inner);
    engine.commit();
    const log: string[] = [];
    engine.setEventListener(inner, 'topTouchEnd', () => {
      throw new Error('first');
    });
    engine.setEventListener(inner, 'topTouchEnd', () => log.push('inner'));
    engine.setEventListener(outer, 'topTouchEnd', () => log.push('outer'));

    engine.dispatchEvent(inner, 'topTouchEnd', {});
    assert.deepEqual(log, ['inner', 'outer']);
  });

  it('are reported to the console with the event name when nothing is hooked up', () => {
    const fabric = createFakeFabric();
    const engine = new Engine(fabric, 1);
    const node = engine.createElement('view');
    engine.appendChild(engine.root, node);
    engine.commit();
    engine.setEventListener(node, 'topWillAppear', () => {
      throw new Error('unhooked');
    });

    const reports: unknown[][] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => reports.push(args);
    try {
      assert.doesNotThrow(() => engine.dispatchEvent(node, 'topWillAppear', {}));
    } finally {
      console.error = original;
    }
    assert.equal(reports.length, 1);
    assert.match(String(reports[0]![0]), /topWillAppear/);
    assert.equal(message(reports[0]![1]), 'unhooked');
  });
});

describe('errors thrown during event dispatch, in an app', () => {
  let mounted: ReturnType<typeof mountSolid> | undefined;

  afterEach(() => mounted?.root.dispose());

  /**
   * Code in the dispatch path that is not a component's own listener: a responder handler, and a
   * listener registered on the engine directly, as the gesture and worklet layers do.
   */
  const start = () => {
    const errors: unknown[] = [];
    const fixture = eventErrors();
    mounted = mountSolid(fixture.View, { onError: (error) => errors.push(error) });
    const { engine } = mounted;
    engine.setResponder(fixture.host(), {
      onStartShouldSetResponder: () => true,
      onResponderGrant: () => {
        throw new Error('grant failed');
      },
    });
    engine.setEventListener(fixture.host(), 'topWillAppear', () => {
      throw new Error('willAppear failed');
    });
    return { errors, engine, fixture, fabric: mounted.fabric };
  };

  it("reach the app's error hook from a listener on the engine", () => {
    const { errors, engine, fixture } = start();
    assert.doesNotThrow(() => engine.dispatchEvent(fixture.host(), 'topWillAppear', {}));
    assert.deepEqual(errors.map(message), ['willAppear failed']);
  });

  it("reach the app's error hook from a responder handler, and the touch still bubbles", () => {
    const { errors, fixture, fabric } = start();
    const target = mounted!.byId('target');
    assert.doesNotThrow(() => fabric.emit(target, 'topTouchStart', {}));
    assert.deepEqual(errors.map(message), ['grant failed']);

    fabric.emit(target, 'topTouchEnd', {});
    assert.deepEqual(fixture.bubbled, ['view', 'host']);
  });
});
