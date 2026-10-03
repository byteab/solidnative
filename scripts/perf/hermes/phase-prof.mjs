// CPU profile of one phase across iterations: node --expose-gc phase-prof.mjs <bundle.js> <mode> <iters> <phase>
import { Session } from 'node:inspector';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import vm from 'node:vm';
const [file, mode, iters, phase] = process.argv.slice(2);
const session = new Session();
session.connect();
session.post('Profiler.enable');
session.post('Profiler.setSamplingInterval', { interval: 20 });
const profiles = [];
Object.assign(globalThis, {
  print: () => {},
  nowMs: () => performance.now(),
  gcNow: () => globalThis.gc(),
  heapAllocated: () => process.memoryUsage().heapUsed,
  args: [mode, iters],
  onPhase(name, at) {
    if (name !== phase) return;
    if (at === 'start') session.post('Profiler.start');
    else session.post('Profiler.stop', (err, { profile }) => profiles.push(profile));
  },
});
vm.runInThisContext(readFileSync(file, 'utf8'), { filename: file });
mkdirSync('/tmp/phaseprof', { recursive: true });
profiles.forEach((p, i) => writeFileSync(`/tmp/phaseprof/${i}.cpuprofile`, JSON.stringify(p)));
console.log(profiles.length, 'profiles');
