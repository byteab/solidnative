/** Development-only state shared across module replacements, never a state-preserving HMR API. */
interface ReloadRoot {
  dispose(): void;
}
interface ReloadState {
  pending: boolean;
  roots: Set<ReloadRoot>;
}
const reloadKey = Symbol.for('@solid-native/platform/solid/dev-reload/v1');

function state(): ReloadState {
  const host = globalThis as typeof globalThis & { [reloadKey]?: ReloadState };
  return (host[reloadKey] ??= { pending: false, roots: new Set() });
}

export function isNativeReloadPending(): boolean {
  return state().pending;
}

/** Used automatically by development native roots. Returns an idempotent unregister callback. */
export function registerNativeReloadRoot(root: ReloadRoot): () => void {
  const current = state();
  if (current.pending) throw new Error('Native Solid is awaiting a clean reload.');
  current.roots.add(root);
  return () => current.roots.delete(root);
}

/** Enter the irreversible old-VM barrier before cleanup; continue even if one root fails. */
export function disposeNativeRootsForReload(): boolean {
  const current = state();
  if (current.pending) return false;
  current.pending = true;
  const roots = [...current.roots];
  current.roots.clear();
  for (const root of roots) {
    try {
      root.dispose();
    } catch (error) {
      try {
        console.error('[native-solid] Root cleanup failed during native reload.', error);
      } catch {
        /* Cleanup of the remaining roots must continue. */
      }
    }
  }
  return true;
}
