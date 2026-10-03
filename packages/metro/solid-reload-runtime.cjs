/** Metro accepts an edit solely to tear down Solid and request a new native JS VM. */
function registerModule(module, registry, reload, filename) {
  if (!module.hot) return true;
  module.hot.accept();
  module.hot.dispose(() => {
    if (!registry.disposeNativeRootsForReload()) return;
    try {
      reload(`Native Solid source changed: ${filename}`);
    } catch (error) {
      // Keep the pending guard closed. Running replacement code after failed reload is unsafe.
      try {
        console.error('[native-solid] Native reload failed; reload the app manually.', error);
      } catch {
        /* Reporting cannot undo the reload barrier. */
      }
    }
  });
  return !registry.isNativeReloadPending();
}

module.exports = { registerModule };
