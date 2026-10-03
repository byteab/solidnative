import { registerHooks } from 'node:module';
import { installNativeMocks, nativeMock } from './g9-native-mocks.ts';
export { nativeMock };
export interface TestGesture {
  kind: string;
  children?: TestGesture[];
  callbacks: Record<string, (event?: Record<string, number>) => void>;
}
export function installRouteGestures() {
  const base = installNativeMocks();
  const source = `class Builder {
    constructor(kind,children){this.kind=kind;this.children=children;this.callbacks={};}
    runOnJS(){return this;} activateAfterLongPress(){return this;} simultaneousWithExternalGesture(){return this;}
    initialize(){} prepare(){} toGestureArray(){return [];}
    onStart(fn){this.callbacks.start=fn;return this;} onUpdate(fn){this.callbacks.update=fn;return this;}
    onEnd(fn){this.callbacks.end=fn;return this;} onFinalize(fn){this.callbacks.finalize=fn;return this;}
  } export const Gesture={Native:()=>new Builder('Native'),Pan:()=>new Builder('Pan'),Tap:()=>new Builder('Tap'),Exclusive:(...children)=>new Builder('Exclusive',children)};`;
  const hook = registerHooks({
    resolve(specifier, context, next) {
      if (specifier === 'react-native-gesture-handler')
        return { url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true };
      return next(specifier, context);
    },
  });
  return () => {
    hook.deregister();
    base.deregister();
  };
}
export function gestures(kind: string, viewTag?: number): TestGesture[] {
  const walk = (gesture: TestGesture): TestGesture[] => [
    gesture,
    ...(gesture.children ?? []).flatMap(walk),
  ];
  return [...nativeMock.gestures.values()]
    .filter((entry) => viewTag === undefined || viewTag === entry.viewTag)
    .flatMap((entry) => walk(entry.gestureConfig as unknown as TestGesture))
    .filter((gesture) => gesture.kind === kind);
}
