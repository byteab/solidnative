import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { after, afterEach, test } from 'node:test';
import { Engine } from '@solid-native/fabric';
import { createFakeFabric } from '../../platform/solid-tests/fake-fabric.ts';

// Import the real public entry. A wrapper or optional module import is a startup regression.
const imports = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (/^(?:react(?:-native)?(?:\/|$)|expo(?:-|\/|$)|@expo\/|solid-js)/.test(specifier))
      throw new Error(`Native registration must not import ${specifier}`);
    return nextResolve(specifier, context);
  },
});
after(() => imports.deregister());
const { registerExpoViews, registerExpoUiViews, registerExpoMap, registerNativeViews } =
  await import('@solid-native/expo/views');

const host = globalThis as { expo?: { __expo_app_identifier__?: string } };
const original = host.expo;
afterEach(() => {
  if (original === undefined) delete host.expo;
  else host.expo = original;
});

function commit(names: readonly string[]) {
  const fabric = createFakeFabric();
  const engine = new Engine(fabric, 1);
  for (const name of names) engine.appendChild(engine.root, engine.createElement(name));
  engine.commit();
  const nodes = fabric.roots.get(1)!;
  for (const node of [...engine.root.children]) {
    engine.removeChild(engine.root, node);
    engine.destroyNode(node);
  }
  engine.commit();
  engine.destroyNode(engine.root);
  return nodes;
}

test('isolated public registrations commit canary Expo views and wrapper defaults', () => {
  delete host.expo;
  registerExpoViews(
    'expo-image',
    'expo-glass',
    'expo-glass-container',
    'expo-symbol',
    'apple-sign-in-button',
  );
  const views = commit([
    'expo-image',
    'expo-glass',
    'expo-glass-container',
    'expo-symbol',
    'apple-sign-in-button',
  ]);
  assert.deepEqual(
    views.map((node) => node.viewName),
    [
      'ViewManagerAdapter_ExpoImage',
      'ViewManagerAdapter_ExpoGlassEffect_GlassView',
      'ViewManagerAdapter_ExpoGlassEffect_GlassContainer',
      'ViewManagerAdapter_SymbolModule',
      'ViewManagerAdapter_ExpoAppleAuthentication',
    ],
  );
  assert.equal(views[0]!.props['contentFit'], 'cover');
  assert.equal(views[3]!.props['type'], 'monochrome');
});

test('map and Expo UI registration preserve Expo Go namespacing and platform names', () => {
  host.expo = { __expo_app_identifier__: 'shell-test' };
  registerExpoMap('ios');
  registerExpoUiViews('ios');
  assert.deepEqual(
    commit(['expo-map', 'ui-host', 'ui-slot', 'ui-toggle']).map((node) => node.viewName),
    [
      'ViewManagerAdapter_ExpoAppleMaps_shell-test',
      'ViewManagerAdapter_ExpoUI_HostView_shell-test',
      'ViewManagerAdapter_ExpoUI_SlotView_shell-test',
      'ViewManagerAdapter_ExpoUI_ToggleView_shell-test',
    ],
  );
  registerExpoMap('android');
  registerExpoUiViews('android');
  assert.deepEqual(
    commit(['expo-map', 'ui-host', 'ui-slot', 'ui-toggle']).map((node) => node.viewName),
    [
      'ViewManagerAdapter_ExpoGoogleMaps_shell-test',
      'ViewManagerAdapter_ExpoUI_HostView_shell-test',
      'ViewManagerAdapter_ExpoUI_SlotView_shell-test',
      'ViewManagerAdapter_ExpoUI_SwitchView_shell-test',
    ],
  );
  registerExpoUiViews('web');
  registerExpoUiViews('native');
  assert.equal(commit(['ui-host'])[0]!.viewName, 'ViewManagerAdapter_ExpoUI_HostView_shell-test');
});

test('community registrations retain native defaults without loading optional modules', () => {
  registerNativeViews('web-view', 'slider', 'segmented-control');
  const views = commit(['web-view', 'slider', 'segmented-control']);
  assert.equal(views[0]!.viewName, 'RNCWebView');
  assert.equal(views[0]!.props['javaScriptEnabled'], true);
  assert.equal(views[1]!.props['maximumValue'], 1);
  assert.equal(views[1]!.props['minimumValue'], 0);
  assert.equal(views[2]!.props['onChange'], true);
  assert.throws(() => registerNativeViews('unknown-native-view'), /no native view is known/);
  assert.throws(() => registerExpoViews('unknown-expo-view'), /no Expo view is known/);
});
