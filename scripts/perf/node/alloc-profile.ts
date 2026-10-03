// Sampling allocation profile that keeps objects collected by GC (the default --heap-prof drops them).
// Usage: node --expose-gc --import ./register.mjs alloc-profile.ts <out.heapprofile> <mode> <iterations>
import { Session } from 'node:inspector/promises';
import { writeFileSync } from 'node:fs';
const [out, ...rest] = process.argv.slice(2);
process.argv.splice(2, process.argv.length, ...rest);
const session = new Session();
session.connect();
await session.post('HeapProfiler.startSampling', {
  samplingInterval: 1024,
  includeObjectsCollectedByMajorGC: true,
  includeObjectsCollectedByMinorGC: true,
});
await import('./run.ts');
const { profile } = await session.post('HeapProfiler.stopSampling');
writeFileSync(out!, JSON.stringify(profile));
