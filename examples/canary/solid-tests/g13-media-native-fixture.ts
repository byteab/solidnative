import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { installNativeMocks, nativeMock } from './g9-native-mocks.ts';
export { nativeMock };
export interface TestGesture {
  kind: string;
  config: Record<string, unknown>;
  callbacks: Record<string, (event?: Record<string, number>) => void>;
}
/** External native libraries/Metro asset IDs only; renderer, components and Expo views are real. */
export function installMediaMocks() {
  const base = installNativeMocks();
  const source = `class Builder {
    constructor(kind){this.kind=kind;this.config={};this.callbacks={};}
    initialize(){} prepare(){} toGestureArray(){return [];}
    runOnJS(v){this.config.js=v;return this;} minDistance(v){this.config.minDistance=v;return this;}
    numberOfTaps(v){this.config.taps=v;return this;} activeOffsetY(v){this.config.activeOffsetY=v;return this;}
    failOffsetX(v){this.config.failOffsetX=v;return this;}
    onBegin(fn){this.callbacks.begin=fn;return this;} onUpdate(fn){this.callbacks.update=fn;return this;}
    onEnd(fn){this.callbacks.end=fn;return this;} onFinalize(fn){this.callbacks.finalize=fn;return this;}
  } export const Gesture={Pan:()=>new Builder('Pan'),Tap:()=>new Builder('Tap')};`;
  const hook = registerHooks({
    resolve(specifier, context, next) {
      if (specifier === 'react-native-gesture-handler')
        return { url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true };
      return next(specifier, context);
    },
    load(url, context, next) {
      if (url.endsWith('.wav')) {
        const bytes = readFileSync(new URL(url));
        if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE')
          throw new Error('Invalid source WAV');
        return {
          format: 'commonjs',
          source: `module.exports=${url.endsWith('tone-a.wav') ? 1 : url.endsWith('tone-b.wav') ? 2 : 3}`,
          shortCircuit: true,
        };
      }
      if (url.endsWith('/player/player-model.solid.ts'))
        return {
          format: 'module-typescript',
          source:
            "import {createRequire as __assetRequire} from 'node:module';const require=__assetRequire(import.meta.url);\n" +
            readFileSync(new URL(url), 'utf8'),
          shortCircuit: true,
        };
      return next(url, context);
    },
  });
  return () => {
    hook.deregister();
    base.deregister();
  };
}
export function gestures(kind: string, viewTag?: number): TestGesture[] {
  return [...nativeMock.gestures.values()]
    .filter((entry) => viewTag === undefined || viewTag === entry.viewTag)
    .map((entry) => entry.gestureConfig as unknown as TestGesture)
    .filter((gesture) => gesture.kind === kind);
}
