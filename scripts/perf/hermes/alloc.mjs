// Allocation by site for a Hermes bench bundle run under Node (sampling heap profile that keeps
// collected objects), builtins folded into their caller. node --expose-gc alloc.mjs <bundle.js> <mode> <iters> [top]
import { Session } from 'node:inspector/promises';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const [file, mode, iters, top = 45] = process.argv.slice(2);
Object.assign(globalThis, {
  print: () => {},
  nowMs: () => performance.now(),
  gcNow: () => globalThis.gc(),
  heapAllocated: () => process.memoryUsage().heapUsed,
  args: [mode, iters, 'mount'],
});
const session = new Session();
session.connect();
await session.post('HeapProfiler.startSampling', {
  samplingInterval: 512,
  includeObjectsCollectedByMajorGC: true,
  includeObjectsCollectedByMinorGC: true,
});
vm.runInThisContext(readFileSync(file, 'utf8'), { filename: file });
const { profile } = await session.post('HeapProfiler.stopSampling');
const sites = new Map();
let total = 0;
(function walk(n, owner) {
  const { url, functionName, lineNumber } = n.callFrame;
  const site = url === file ? `${functionName || '(anon)'}:${lineNumber + 1}` : url ? null : owner;
  if (site && n.selfSize) {
    sites.set(site, (sites.get(site) ?? 0) + n.selfSize);
    total += n.selfSize;
  }
  for (const c of n.children) walk(c, url === file ? site : owner);
})(profile.head, null);
const mb = (b) => (b / 1048576 / iters).toFixed(3);
console.log('total MB/mount', mb(total));
for (const [k, s] of [...sites].sort((a, b) => b[1] - a[1]).slice(0, +top))
  console.log(' ', mb(s), k);
