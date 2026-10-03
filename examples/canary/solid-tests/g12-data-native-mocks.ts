import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';

type Callback = (...args: never[]) => unknown;
export interface MockGesture {
  kind: string;
  callbacks: Record<string, Callback>;
  children: MockGesture[];
  activeX?: number;
  failX?: number;
  failY?: number[];
  duration?: number;
  blocks?: MockGesture;
}
export const nativeMock = {
  next: 0,
  mappers: new Map<number, () => void>(),
  events: new Map<number, { callback: Callback; name: string; tag: number }>(),
  gestures: new Map<object, { viewTag: number; gestureConfig: MockGesture }>(),
  updates: [] as { descriptors: { value: { tag: number }[] }; updates: Record<string, unknown> }[],
  animations: [] as { config: Record<string, unknown>; stopped: boolean }[],
  cancelled: [] as object[],
  completions: [] as (() => void)[],
  graphs: new Set<object>(),
};
(globalThis as unknown as { canaryG12DataNative: typeof nativeMock }).canaryG12DataNative =
  nativeMock;
const base = 'const s=globalThis.canaryG12DataNative; ';
const sources: Record<string, string> = {
  'react-native':
    base +
    `class Value { constructor(value){this.value=value;} setValue(value){this.value=value;} stopAnimation(){for(const a of s.animations)if(a.value===this)a.stopped=true;} }
    export const Animated={Value,timing:(value,config)=>({start(){s.animations.push({value,config,stopped:false});}})}; export const Easing={linear:x=>x};`,
  'react-native/Libraries/Animated/nodes/AnimatedProps':
    base +
    `export default class {
    constructor(props,frame){this.props=props;this.frame=frame;} __attach(){s.graphs.add(this);} __detach(){s.graphs.delete(this);}
    __getValue(){const flatten=v=>v&&typeof v==='object'?('value' in v?v.value:Array.isArray(v)?v.map(flatten):Object.fromEntries(Object.entries(v).map(([k,x])=>[k,flatten(x)]))):v;return flatten(this.props);}
    setNativeView(tag){this.tag=tag;}
  }`,
  'react-native-reanimated':
    base +
    `export const makeMutable=value=>({value}); export const startMapper=(callback,values)=>{const id=++s.next;s.mappers.set(id,callback);return id;}; export const stopMapper=id=>s.mappers.delete(id);
    export const cancelAnimation=value=>s.cancelled.push(value);export const withSpring=value=>value;export const withTiming=(value,config,done)=>{if(done)s.completions.push(()=>done(true));return value;};export const withRepeat=(animation,count,reverse)=>({animation,count,reverse});
    export const interpolate=(v,[a,b],[c,d])=>c+(d-c)*Math.min(1,Math.max(0,(v-a)/(b-a)));`,
  'react-native-reanimated/src/updateProps/index.ts':
    base + 'export const updateProps=(descriptors,updates)=>s.updates.push({descriptors,updates});',
  'react-native-reanimated/src/core.ts':
    base +
    'export const registerEventHandler=(callback,name,tag)=>{const id=++s.next;s.events.set(id,{callback,name,tag});return id;}; export const unregisterEventHandler=id=>s.events.delete(id);',
  'react-native-worklets': 'export const scheduleOnRN=(callback,...args)=>callback(...args);',
  'react-native-gesture-handler': `class GestureBuilder {
    constructor(kind){this.kind=kind;this.callbacks={};}runOnJS(value){this.js=value;return this;}initialize(){}prepare(){}toGestureArray(){return [];}
    activeOffsetX(value){this.activeX=value;return this;}failOffsetX(value){this.failX=value;return this;}failOffsetY(value){this.failY=value;return this;}blocksExternalGesture(value){this.blocks=value;return this;}minDuration(value){this.duration=value;return this;}onStart(fn){this.callbacks.start=fn;return this;}onEnd(fn){this.callbacks.end=fn;return this;}onChange(fn){this.callbacks.change=fn;return this;}onTouchesDown(fn){this.callbacks.down=fn;return this;}
    onTouchesMove(fn){this.callbacks.move=fn;return this;}onTouchesUp(fn){this.callbacks.up=fn;return this;}
  } export const Gesture=Object.fromEntries(['Tap','Pan','Manual','Native','LongPress','Race','Exclusive'].map(k=>[k,(...children)=>Object.assign(new GestureBuilder(k),{children})]));`,
  'react-native-gesture-handler/src/handlers/gestures/GestureDetector/attachHandlers.ts':
    base + 'export const attachHandlers=config=>s.gestures.set(config.preparedGesture,config);',
  'react-native-gesture-handler/src/handlers/gestures/GestureDetector/dropHandlers.ts':
    base + 'export const dropHandlers=prepared=>s.gestures.delete(prepared);',
  'react-native-gesture-handler/src/init.ts': 'export const maybeInitializeFabric=()=>{};',
  'react-native-gesture-handler/src/handlers/gestures/gestureStateManager.ts':
    'export const GestureStateManager={create:()=>({})};',
};
/** Mock external native libraries only; real public bindings, Solid screens and Fabric stay active. */
export function installNativeMocks() {
  return registerHooks({
    resolve(specifier, context, next) {
      if (specifier in sources)
        return {
          url: `data:text/javascript,${encodeURIComponent(sources[specifier]!)}`,
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
      if (/\/components\/(?:src|dist)\/solid\/(gestures|reanimated)\.(ts|js)$/.test(url))
        return {
          format: url.endsWith('.ts') ? 'module-typescript' : 'module',
          source:
            "import { createRequire as __nativeRequire } from 'node:module'; const require = __nativeRequire(import.meta.url);\n" +
            readFileSync(new URL(url), 'utf8'),
          shortCircuit: true,
        };
      return next(url, context);
    },
  });
}
