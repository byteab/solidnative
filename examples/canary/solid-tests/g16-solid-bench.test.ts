import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { mountNative } from '@solid-native/platform/solid';
import { registerPlatformComponents } from '@solid-native/fabric';
import {
  createClock,
  createFakeFabric,
  type FakeNode,
} from '../../../packages/platform/solid-tests/fake-fabric.ts';
import { SolidBench } from '../src/bench/solid-bench.solid.tsx';
import { ROWS, STEPS, STEP_MS } from '../src/bench/rows.ts';

const flatten = (nodes: FakeNode[]): FakeNode[] =>
  nodes.flatMap((node) => [node, ...flatten(node.children)]);
const text = (node: FakeNode): string =>
  flatten([node])
    .map((child) => child.props['text'])
    .filter((value) => typeof value === 'string')
    .join('');

test('the Solid benchmark runs the shared script with keyed rows and reports once', (t) => {
  registerPlatformComponents('ios');
  mock.timers.enable({ apis: ['setTimeout'] });
  t.after(() => mock.timers.reset());
  const phases: string[] = [];
  const logged: string[] = [];
  (globalThis as { __bench?: unknown }).__bench = {
    begin: (name: string) => phases.push(name),
    report: () => 'mount 1ms\nclear 1ms',
    gcKeys: () => 'none',
  };
  t.after(() => delete (globalThis as { __bench?: unknown }).__bench);
  t.mock.method(console, 'error', (line: string) => logged.push(String(line)));

  const fabric = createFakeFabric();
  const clock = createClock();
  const root = mountNative(SolidBench, { fabric: fabric as never, rootTag: 41, clock });
  t.after(() => root.dispose());
  clock.flushMicrotasks();
  const page = () => fabric.roots.get(41)![0]!;
  const rows = () => page().children.slice(1);
  const advance = () => {
    mock.timers.tick(STEP_MS);
    clock.flushMicrotasks();
  };

  assert.deepEqual(phases, ['mount']);
  assert.equal(text(page().children[0]!), 'solid: measuring...');
  assert.equal(rows().length, ROWS);
  const first = rows()[0]!;

  advance(); // replace: new ids, so new rows
  assert.equal(rows().length, ROWS);
  assert.notEqual(rows()[0]!.tag, first.tag);
  const replaced = rows().map((row) => row.tag);
  const label0 = text(rows()[0]!);

  advance(); // update10th: same rows, every tenth label changed in place
  assert.deepEqual(
    rows().map((row) => row.tag),
    replaced,
    'keyed by id: no row is recreated',
  );
  assert.equal(text(rows()[0]!), `${label0} !!!`);
  assert.equal(text(rows()[1]!).endsWith('!!!'), false);

  const tint = rows()[5]!.props['backgroundColor'];
  const selectedTag = rows()[5]!.tag;
  advance(); // select
  assert.equal(rows()[5]!.tag, selectedTag);
  assert.notEqual(rows()[5]!.props['backgroundColor'], tint);
  assert.equal(rows()[6]!.props['backgroundColor'] !== undefined, true);

  advance(); // label1
  assert.ok(text(rows()[500]!).endsWith(' ?'));

  const [second, penultimate] = [rows()[1]!.tag, rows()[ROWS - 2]!.tag];
  advance(); // swap: the same two native rows, moved
  assert.equal(rows()[1]!.tag, penultimate);
  assert.equal(rows()[ROWS - 2]!.tag, second);

  const sixth = rows()[6]!.tag;
  advance(); // remove the selected row
  assert.equal(rows().length, ROWS - 1);
  assert.equal(rows()[5]!.tag, sixth);

  advance(); // append
  assert.equal(rows().length, 2 * ROWS - 1);
  advance(); // clear
  assert.equal(rows().length, 0);

  assert.deepEqual(
    phases,
    STEPS.map((step) => step.name),
  );
  advance(); // report
  assert.equal(text(page().children[0]!), 'solid\nmount 1ms\nclear 1ms');
  assert.ok(logged.includes('[bench] solid | mount 1ms | clear 1ms'));
  assert.equal(logged.filter((line) => line.startsWith('[bench] solid |')).length, 1);
});
