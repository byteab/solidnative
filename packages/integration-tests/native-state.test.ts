/**
 * `nativeState`, the one `@expo/ui` prop that is not a value.
 *
 * `TextFieldView` and `SecureFieldView` take their text as an `ObservableState`, a shared object
 * both sides hold a reference to rather than a plain string. Binding the string directly compiles,
 * looks right, and does nothing: the field logs `FieldInvalidTypeException` and quietly manages
 * its own text instead. So what is worth pinning here is the shape `nativeState` builds by hand
 * around `ExpoUI`'s `ObservableState` - id, get, set, release - and that it is `null` rather than a
 * throw where the native module is not there to ask.
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { nativeState as ownedNativeState } from '@solidnative/expo';
import { withServiceScope } from '@solidnative/device/solid';
import { disposeServices, owned, servicesWith } from './expo-service.ts';

/** `nativeState` under a fresh owner and service scope, resolving its default source. */
const nativeState = <T>(initial: T) => servicesWith([], () => ownedNativeState(initial));

/** A fake `ObservableState`, close enough to `@expo/ui`'s to drive `nativeState` with. */
function observableState() {
  let nextId = 1;
  let released = false;
  class Fake {
    readonly __expo_shared_object_id__ = nextId++;
    private value: unknown;
    constructor(init: { value: unknown }) {
      this.value = init.value;
    }
    getValue() {
      return this.value;
    }
    setValue(next: { value: unknown }) {
      this.value = next.value;
    }
    release() {
      released = true;
    }
  }
  return { ObservableState: Fake, wasReleased: () => released };
}

/** Installs a fake `expo` for one call, the same seam `optional()` reaches through in Node. */
function withExpo<T>(module: { requireNativeModule(name: string): unknown }, run: () => T): T {
  const host = globalThis as Record<string, unknown>;
  host['require'] = (id: string) => {
    if (id !== 'expo') throw new Error(`Cannot find module '${id}'`);
    return module;
  };
  try {
    return run();
  } finally {
    delete host['require'];
  }
}

afterEach(() => {
  disposeServices();
  delete (globalThis as Record<string, unknown>)['require'];
});

describe('holding a value on the native side', () => {
  it('is null with no ExpoUI module to ask, rather than throwing', () => {
    assert.equal(nativeState('hello'), null);
  });

  it('wraps a fresh ObservableState around the initial value', () => {
    const { ObservableState } = observableState();
    const state = withExpo(
      { requireNativeModule: (name) => (assert.equal(name, 'ExpoUI'), { ObservableState }) },
      () => nativeState('hello'),
    );

    assert.ok(state);
    assert.equal(typeof state.id, 'number', 'the id is what the view prop takes');
    assert.equal(state.get(), 'hello');
  });

  it('writes through to the native object, and reads back what was written', () => {
    const { ObservableState } = observableState();
    const state = withExpo({ requireNativeModule: () => ({ ObservableState }) }, () =>
      nativeState(''),
    )!;

    state.set('typed by the app');
    assert.equal(state.get(), 'typed by the app');
  });

  it('releases the native object, so a field inside a list that comes and goes does not leak it', () => {
    const { ObservableState, wasReleased } = observableState();
    const state = withExpo({ requireNativeModule: () => ({ ObservableState }) }, () =>
      nativeState(0),
    )!;

    state.release();
    assert.equal(wasReleased(), true);
  });

  it('gives two states their own ids, since they are two different native objects', () => {
    const { ObservableState } = observableState();
    const [first, second] = withExpo({ requireNativeModule: () => ({ ObservableState }) }, () => [
      nativeState('a')!,
      nativeState('b')!,
    ]);
    assert.notEqual(first.id, second.id);
  });

  it('releases the native object when its owner is disposed', () => {
    const { ObservableState, wasReleased } = observableState();
    const { value: state, stop } = withExpo(
      { requireNativeModule: () => ({ ObservableState }) },
      () => owned(() => withServiceScope([], () => ownedNativeState(0))),
    );
    assert.ok(state);
    stop();
    assert.equal(wasReleased(), true);
    assert.throws(() => state.get(), /released/);
  });
});
