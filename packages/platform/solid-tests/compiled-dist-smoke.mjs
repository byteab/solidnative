import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createNativeRoot } from '@solid-native/platform/solid';
import { createFixture } from './compiled-fixture.tsx';
import { createFakeFabric, createClock } from './fake-fabric.ts';

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
for (const entry of ['./solid', './solid/jsx-runtime']) {
  for (const target of Object.values(manifest.publishConfig.exports[entry]))
    assert.ok(
      existsSync(new URL(`../${target}`, import.meta.url)),
      `emitted export exists: ${entry} -> ${target}`,
    );
}

assert.match(import.meta.resolve('@solid-native/platform/solid'), /\/platform\/dist\/solid\.js$/);
assert.match(import.meta.resolve('@solid-native/fabric'), /\/fabric\/dist\/index\.js$/);
const fabric = createFakeFabric();
const clock = createClock();
const fixture = createFixture();
const root = createNativeRoot({ fabric, clock, rootTag: 1 });
root.render(fixture.View);
assert.equal(fabric.roots.get(1)[0].props.width, 100);
fixture.setCount(9);
fixture.setState('opacity', 0.7);
clock.flushMicrotasks();
assert.equal(fabric.roots.get(1)[0].props.width, 109);
assert.equal(fabric.roots.get(1)[0].props.opacity, 0.7);
root.dispose();
assert.deepEqual(fabric.roots.get(1), []);
console.log(
  'PASS: emitted platform + Fabric JS exports execute compiled TSX signal/store updates.',
);
