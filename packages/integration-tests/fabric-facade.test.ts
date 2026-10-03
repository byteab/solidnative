/**
 * The facade over `global.nativeFabricUIManager` binds each method the engine calls exactly once.
 *
 * A method missing from its list is `undefined` on device and nowhere else: the fake the rest of
 * the suite runs against implements the interface directly, so every test passes and every device
 * fails. That happened - `measureInWindow` was added to the interface and to the engine and left
 * out of the facade, and the anchored overlays it was built for could never have worked.
 *
 * The list is now proven complete against the interface at compile time, which is a stronger thing
 * than this file can do. What is left for a test is that each name is actually bound to the raw
 * object, and the list is imported rather than copied - a second copy here is how the facade and
 * its test managed to be wrong in the same way at the same time.
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { getFabricUIManager } from '@solid-native/fabric';
import { FABRIC_METHODS } from '../fabric/src/fabric.ts';

describe('the Fabric facade', () => {
  afterEach(() => {
    delete (globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager;
  });

  it('binds every method the interface declares, to the raw object', () => {
    const raw: Record<string, unknown> = {};
    for (const name of FABRIC_METHODS) {
      raw[name] = function (this: unknown) {
        return this === raw ? `${name}:bound` : `${name}:unbound`;
      };
    }
    (globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager = raw;

    const facade = getFabricUIManager() as unknown as Record<string, () => string>;
    for (const name of FABRIC_METHODS) {
      assert.equal(facade[name]?.(), `${name}:bound`, name);
    }
  });

  it('says what is wrong when the new architecture is off', () => {
    assert.throws(() => getFabricUIManager(), /New Architecture/);
  });
});
