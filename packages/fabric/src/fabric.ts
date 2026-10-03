/**
 * `global.nativeFabricUIManager` is a lazy caching proxy: every property access mints a
 * fresh host function. Read each method exactly once into a plain object (this is what
 * RN's own `FabricUIManager.js` does with its CACHED_PROPERTIES list).
 */
import type { FabricUIManager } from './engine.ts';

/**
 * Every method of `FabricUIManager`, and nothing else.
 *
 * A name missing here is `undefined` on device and nowhere else, because the fake the suite runs
 * against implements the interface directly - so every test passes and every device fails. That
 * is not hypothetical: `measureInWindow` was added to the interface and to the engine and left out
 * here, and the anchored overlays it was built for could never have worked.
 *
 * `AllMethodsListed` below is what makes that impossible now rather than merely tested for.
 * Exported because the facade test iterates it: there was a second copy of this list in that file,
 * which is how the two managed to be wrong in the same way at the same time.
 */
export const FABRIC_METHODS = [
  'createNode',
  'cloneNodeWithNewChildren',
  'cloneNodeWithNewProps',
  'cloneNodeWithNewChildrenAndProps',
  'appendChild',
  'createChildSet',
  'appendChildToSet',
  'completeRoot',
  'registerEventHandler',
  'setIsJSResponder',
  'dispatchCommand',
  'measureInWindow',
] as const satisfies readonly (keyof FabricUIManager)[];

/**
 * A method the interface declares and the list above forgets.
 *
 * `satisfies` already checks that every name in the list is a real method. This is the other
 * direction, which is the one that bites: it resolves to `never` when the list is complete, and to
 * the missing name when it is not - so forgetting one is a compile error naming it rather than a
 * silent no-op on every phone.
 */
type AssertNever<T extends never> = T;
type AllMethodsListed = AssertNever<
  Exclude<keyof FabricUIManager, (typeof FABRIC_METHODS)[number]>
>;

export function getFabricUIManager(): FabricUIManager {
  const raw = (globalThis as { nativeFabricUIManager?: Record<string, unknown> })
    .nativeFabricUIManager;

  if (!raw) {
    throw new Error(
      'nativeFabricUIManager is not available. The New Architecture must be enabled, ' +
        'and mount() must run inside an AppRegistry runnable.',
    );
  }

  // Typed with the check above, which is `never` when the list is complete and so adds nothing; a
  // check nothing refers to is an unused local to a consumer compiling with `noUnusedLocals`.
  const facade: Record<string, unknown> & { [name in AllMethodsListed]?: never } = {};
  for (const name of FABRIC_METHODS) {
    const value = raw[name];
    if (typeof value === 'function') facade[name] = value.bind(raw);
  }
  return facade as unknown as FabricUIManager;
}
