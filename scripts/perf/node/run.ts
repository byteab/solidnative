import { performance } from 'node:perf_hooks';
import { createNativeRoot } from '@solidnative/platform/solid';
import { Engine } from '@solidnative/fabric';
import {
  createFakeFabric,
  createClock,
} from '../../../packages/platform/solid-tests/fake-fabric.ts';
import { createBench, PlainBench } from './bench-fixture.solid.tsx';
import { RawBench } from './raw-fixture.solid.tsx';
import { initial, rows, styles, ROWS } from '../../../examples/canary/src/bench/rows.ts';

const gc = (globalThis as { gc?: () => void }).gc!;
const mode = process.argv[2] ?? 'solid';
const iterations = Number(process.argv[3] ?? 20);

function measure(label: string, fn: () => void) {
  gc();
  const before = process.memoryUsage().heapUsed;
  const t = performance.now();
  fn();
  const ms = performance.now() - t;
  const alloc = process.memoryUsage().heapUsed - before;
  return { label, ms, mb: alloc / 1048576 };
}

const results: Record<string, { ms: number[]; mb: number[] }> = {};
for (let i = 0; i < iterations; i++) {
  const fabric = createFakeFabric();
  const clock = createClock();
  let out: ReturnType<typeof measure>[] = [];
  if (mode === 'solid') {
    const bench = createBench();
    const root = createNativeRoot({ fabric, clock, rootTag: 1 });
    out.push(measure('mount', () => root.render(() => bench.Bench())));
    // MOUNT_ONLY=1 profiles the mount alone.
    for (const s of process.env.MOUNT_ONLY ? [] : ['replace', 'update10th', 'select', 'clear'])
      out.push(
        measure(s, () => {
          bench.step(s);
          clock.flushMicrotasks();
        }),
      );
    root.dispose();
  } else if (mode === 'plain') {
    const root = createNativeRoot({ fabric, clock, rootTag: 1 });
    out.push(measure('mount', () => root.render(() => PlainBench())));
    root.dispose();
  } else if (mode === 'raw') {
    const root = createNativeRoot({ fabric, clock, rootTag: 1 });
    out.push(measure('mount', () => root.render(() => RawBench())));
    root.dispose();
  } else {
    // Engine fed directly: same tree, no Solid.
    const engine = new Engine(fabric as never, 1, {});
    const build = () => {
      const page = engine.createElement('view', null);
      engine.setProp(page, 'style', { ...styles.page });
      const head = engine.createElement('text', null);
      engine.setProp(head, 'style', { ...styles.label });
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
    };
    out.push(measure('mount', build));
  }
  for (const r of out) {
    const e = (results[r.label] ??= { ms: [], mb: [] });
    e.ms.push(r.ms);
    e.mb.push(r.mb);
  }
}
const med = (a: number[]) => a.slice().sort((x, y) => x - y)[a.length >> 1]!;
for (const [k, v] of Object.entries(results))
  console.log(
    `${mode} ${k}: ${med(v.ms.slice(3)).toFixed(1)}ms ${med(v.mb.slice(3)).toFixed(1)}MB`,
  );
void rows;
void ROWS;
