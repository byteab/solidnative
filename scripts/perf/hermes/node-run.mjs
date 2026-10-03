// Run a Hermes bench bundle (the .js beside the .hbc) under Node, for V8's CPU profiler.
//   node --expose-gc [--cpu-prof ...] node-run.mjs <bundle.js> <mode> <iterations>
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const [file, ...rest] = process.argv.slice(2);
Object.assign(globalThis, {
  print: (...a) => console.log(...a),
  nowMs: () => performance.now(),
  gcNow: () => globalThis.gc(),
  heapAllocated: () => process.memoryUsage().heapUsed,
  args: rest,
});
vm.runInThisContext(readFileSync(file, 'utf8'), { filename: file });
