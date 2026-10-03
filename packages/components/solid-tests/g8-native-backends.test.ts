import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';

const state = {
  register: 0,
  failRegister: 0,
  unregister: [] as number[],
  drop: 0,
  attached: 0,
  failUnregister: false,
  prepared: undefined as { isMounted: boolean } | undefined,
  attach: 0,
  detach: 0,
  tag: 0,
  mapper: undefined as (() => void) | undefined,
  stopped: [] as number[],
  updates: [] as unknown[],
  names: [] as string[],
};
(globalThis as unknown as { g8Native: typeof state }).g8Native = state;
const base = 'const s=globalThis.g8Native; ';
const mocks: Record<string, string> = {
  'react-native': 'export const Animated={}; export const Easing={};',
  'react-native/Libraries/Animated/nodes/AnimatedProps':
    base +
    'export default class { constructor(props,frame){this.props=props;this.frame=frame;} __attach(){s.attach++;} __detach(){s.detach++;} __getValue(){return this.props;} setNativeView(tag){s.tag=tag;} }',
  'react-native-reanimated':
    base +
    'export const makeMutable=value=>({value}); export const startMapper=(callback,values)=>{s.mapper=callback;return 17}; export const stopMapper=id=>s.stopped.push(id);',
  'react-native-reanimated/src/updateProps/index.ts':
    base + 'export const updateProps=(descriptors,updates)=>s.updates.push({descriptors,updates});',
  'react-native-reanimated/src/core.ts':
    base +
    'export const registerEventHandler=(fn,name,tag)=>{s.names.push(name);const id=++s.register;if(id===s.failRegister)throw Error("registration failed");return id;}; export const unregisterEventHandler=id=>{s.unregister.push(id);if(s.failUnregister)throw Error("unregister failed")};',
  'react-native-gesture-handler': 'export {};',
  'react-native-gesture-handler/src/handlers/gestures/GestureDetector/attachHandlers.ts':
    base + 'export const attachHandlers=config=>{s.attached++;s.prepared=config.preparedGesture;};',
  'react-native-gesture-handler/src/handlers/gestures/GestureDetector/dropHandlers.ts':
    base +
    'export const dropHandlers=prepared=>{s.drop++;if(prepared.isMounted)throw Error("still mounted")};',
  'react-native-gesture-handler/src/init.ts': 'export const maybeInitializeFabric=()=>{};',
  'react-native-gesture-handler/src/handlers/gestures/gestureStateManager.ts':
    'export const GestureStateManager={create:()=>({})};',
};
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier in mocks)
      return {
        url: `data:text/javascript,${encodeURIComponent(mocks[specifier]!)}`,
        shortCircuit: true,
      };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith('data:text/javascript,'))
      return {
        format: 'module',
        source: decodeURIComponent(url.slice('data:text/javascript,'.length)),
        shortCircuit: true,
      };
    if (/\/components\/src\/solid\/(gestures|reanimated)\.ts$/.test(url))
      return {
        format: 'module-typescript',
        source:
          "import { createRequire as __g8Require } from 'node:module'; const require = __g8Require(import.meta.url);\n" +
          readFileSync(new URL(url), 'utf8'),
        shortCircuit: true,
      };
    return next(url, context);
  },
});
const { nativeGestureBackend } = await import('../src/solid/gestures.ts');
const { nativeWorkletBackend } = await import('../src/solid/reanimated.ts');
const { nativeAnimationBackend } = await import('../src/solid/animations.ts');
hooks.deregister();
const gesture = { toGestureArray: () => [{ handlers: {}, shouldUseReanimated: true }] };
test('actual native gesture backend rolls back partial event registration and drops native handlers', () => {
  state.failRegister = 2;
  assert.throws(() => nativeGestureBackend.attach({ tag: 4 }, gesture), /registration failed/);
  assert.deepEqual(state.unregister, [1]);
  assert.equal(state.drop, 1);
  assert.equal(state.prepared?.isMounted, false);
});
test('actual gesture cleanup contains remover failures and drops once even after a second disposal', () => {
  state.failRegister = 0;
  state.unregister = [];
  const stop = nativeGestureBackend.attach({ tag: 8 }, gesture);
  state.failUnregister = true;
  assert.throws(stop, /cleanup failed/);
  stop();
  assert.deepEqual(state.unregister, [3, 4]);
  assert.equal(state.drop, 2);
  state.failUnregister = false;
});
test('actual worklet backend uses shadow descriptors, UI mapper values and the onScroll registration', () => {
  const value = { value: 3 };
  const stop = nativeWorkletBackend.bind(
    { tag: 7, shadowNode: 'shadow' },
    { values: [value], updater: (v) => ({ opacity: (v as typeof value).value }) },
  );
  state.mapper!();
  assert.deepEqual(state.updates, [
    { descriptors: { value: [{ tag: 7, shadowNodeWrapper: 'shadow' }] }, updates: { opacity: 3 } },
  ]);
  stop();
  assert.deepEqual(state.stopped, [17]);
  nativeWorkletBackend.scroll(
    { tag: 7, shadowNode: 'shadow' },
    { values: [], handler: () => {} },
  )();
  assert.equal(state.names.at(-1), 'onScroll');
});
test('actual AnimatedProps backend uses graph attach/read/native tag/detach without a React wrapper', () => {
  const graph = nativeAnimationBackend.props({ opacity: 0.5 }, () => {});
  graph.attach();
  assert.deepEqual(graph.read(), { opacity: 0.5 });
  graph.connect(51);
  graph.detach();
  assert.equal(state.attach, 1);
  assert.equal(state.detach, 1);
  assert.equal(state.tag, 51);
});
