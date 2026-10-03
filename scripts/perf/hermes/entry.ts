// The canary bench's Solid tree and steps on the headless Hermes runner, against a stub Fabric
// that only builds the handles the engine keeps (no native work, so the time is the renderer's).
// args: [mode, iterations]  mode: solid (store) | signals | raw | engine
import { createNativeRoot } from '@solid-native/platform/solid';
import { Engine } from '@solid-native/fabric';
// React Native's own colour parser, as its processColor runs it on iOS.
import normalizeColor from '../../../node_modules/.pnpm/@react-native+normalize-colors@0.86.3/node_modules/@react-native/normalize-colors/index.js';
function processColor(color: unknown): unknown {
  if (color === undefined || color === null) return color;
  const n = normalizeColor(color as string);
  if (n === null || n === undefined) return undefined;
  return ((n << 24) | (n >>> 8)) >>> 0;
}
const engineOptions = { processColor };
import { createBench } from '../node/bench-fixture.solid.tsx';
import { createSignalsBench } from './signals-fixture.solid.tsx';
import { createRawSignalsBench } from './raw-signals-fixture.solid.tsx';
import { RawBench } from '../node/raw-fixture.solid.tsx';
import { STEPS, initial, styles } from '../../../examples/canary/src/bench/rows.ts';

declare const print: (...a: unknown[]) => void,
  nowMs: () => number,
  gcNow: () => void,
  heapAllocated: () => number,
  args: string[];

let calls = 0;
function stubFabric() {
  const node = (tag: number) => ({ tag, children: [] as unknown[] });
  return {
    createNode: (tag: number) => (calls++, node(tag)),
    cloneNodeWithNewChildren: (n: { tag: number }) => (calls++, node(n.tag)),
    cloneNodeWithNewProps: (n: { tag: number; children: unknown[] }) => (
      calls++,
      { tag: n.tag, children: n.children }
    ),
    cloneNodeWithNewChildrenAndProps: (n: { tag: number }) => (calls++, node(n.tag)),
    appendChild(p: { children: unknown[] }, c: unknown) {
      calls++;
      p.children.push(c);
      return p;
    },
    createChildSet: () => [] as unknown[],
    appendChildToSet: (s: unknown[], c: unknown) => {
      s.push(c);
    },
    completeRoot() {
      calls++;
    },
    registerEventHandler() {},
  };
}
function clock() {
  const q: (() => void)[] = [];
  return {
    queueMicrotask: (f: () => void) => {
      q.push(f);
    },
    requestFrame: () => 0,
    cancelFrame() {},
    flush() {
      while (q.length) q.shift()!();
    },
  };
}

const mode = args[0] ?? 'solid';
const iterations = Number(args[1] ?? 15);
const phases =
  (mode === 'solid' || mode === 'signals' || mode === 'rawsignals') && args[2] !== 'mount'
    ? STEPS.map((s) => s.name)
    : ['mount'];
const res: Record<string, { ms: number[]; mb: number[] }> = {};
function measure(name: string, fn: () => void) {
  gcNow();
  const hook = (globalThis as { onPhase?: (name: string, at: string) => void }).onPhase;
  hook?.(name, 'start');
  const a = heapAllocated(),
    t = nowMs();
  fn();
  hook?.(name, 'end');
  const ms = nowMs() - t,
    mb = (heapAllocated() - a) / 1048576;
  const e = (res[name] ??= { ms: [], mb: [] });
  e.ms.push(ms);
  e.mb.push(mb);
}
for (let i = 0; i < iterations; i++) {
  const c = clock();
  const root = createNativeRoot({
    fabric: stubFabric() as never,
    clock: c as never,
    rootTag: 1,
    engineOptions,
  });
  if (mode === 'engine') {
    // The same tree fed to the engine directly: no Solid, no platform.
    const engine = new Engine(stubFabric() as never, 1, engineOptions);
    measure('mount', () => {
      const page = engine.createElement('view', null);
      engine.setProp(page, 'style', { ...styles.page });
      const head = engine.createElement('text', null);
      engine.setProp(head, 'style', { ...styles.head });
      engine.insertBefore(head, engine.createText('engine'), null);
      engine.insertBefore(page, head, null);
      for (const row of initial().rows) {
        const v = engine.createElement('view', null);
        engine.setProp(v, 'style', { ...row.style });
        const t = engine.createElement('text', null);
        engine.setProp(t, 'style', { ...styles.label });
        engine.insertBefore(t, engine.createText(row.label), null);
        engine.insertBefore(v, t, null);
        engine.insertBefore(page, v, null);
      }
      engine.insertBefore(engine.root, page, null);
      engine.commit();
    });
    continue;
  }
  if (mode === 'raw') {
    measure('mount', () => root.render(() => RawBench()));
    root.dispose();
    continue;
  }
  const bench =
    mode === 'signals'
      ? createSignalsBench()
      : mode === 'rawsignals'
        ? createRawSignalsBench()
        : createBench();
  measure('mount', () => root.render(() => bench.Bench()));
  for (const s of phases.slice(1))
    measure(s, () => {
      bench.step(s);
      c.flush();
    });
  root.dispose();
}
const med = (a: number[]) => a.slice(3).sort((x, y) => x - y)[(a.length - 3) >> 1]!;
print(
  Object.entries(res)
    .map(([k, v]) => `${k} ${med(v.ms).toFixed(2)}ms ${med(v.mb).toFixed(2)}MB`)
    .join(' | '),
);
