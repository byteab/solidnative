/**
 * Sticky section headers where the host drives scroll natively.
 *
 * The section list itself (headers, items, footers, windowing, end reached, pinning on and off
 * per platform) is the Solid `SectionList`, covered by `packages/components/solid-tests/g7-lists`
 * and `g13-sticky`; those run over a host that does not drive scroll, so the half of
 * `StickyHeaders` that hands each header to the native driver and only commits its translate once
 * scrolling pauses is exercised here, against a fake engine, with no UI framework at all.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { pinnedRange, type HostEngine, type HostNode, type ScrollRange } from '@solidnative/fabric';
// An internal the components entry points do not export (see eslint.config.mjs's allowlist).
// eslint-disable-next-line @nx/enforce-module-boundaries
import { StickyHeaders } from '../components/src/sticky-headers.ts';

function fakeEngine() {
  const props = new Map<object, Record<string, unknown>>();
  const layouts = new Map<object, (event: unknown) => void>();
  const drives: { node: object; axis: string; range: ScrollRange; updates: ScrollRange[] }[] = [];
  const stopped: object[] = [];
  const engine = {
    drivesScroll: true,
    setProp(node: object, key: string, value: unknown) {
      props.set(node, { ...props.get(node), [key]: value });
    },
    setEventListener(node: object, type: string, listener: (event: unknown) => void) {
      assert.equal(type, 'topLayout');
      layouts.set(node, listener);
      return () => layouts.delete(node);
    },
    driveByScroll(node: object, _scroll: object, axis: string, range: ScrollRange) {
      const drive = { node, axis, range, updates: [] as ScrollRange[] };
      drives.push(drive);
      return {
        update: (next: ScrollRange) => drive.updates.push(next),
        stop: () => stopped.push(node),
      };
    },
  };
  const layout = (
    node: object,
    frame: { x?: number; y?: number; width?: number; height?: number },
  ) => layouts.get(node)!({ nativeEvent: { layout: frame } });
  return { engine: engine as unknown as HostEngine, props, layouts, drives, stopped, layout };
}

const element = () => ({ kind: 'element', children: [] }) as unknown as HostNode;
const anchor = () => ({ kind: 'anchor', children: [] }) as unknown as HostNode;

describe('sticky headers driven by the native scroll', () => {
  it('hands each header to the driver, pinned until the next one pushes it off', () => {
    const fake = fakeEngine();
    const [first, row, second] = [element(), element(), element()];
    const content = { children: [first, anchor(), row, second] } as unknown as HostNode;
    const sticky = new StickyHeaders(fake.engine, element(), () => false);
    // Indices count committed elements only: the control-flow anchor is not a child in RN's sense.
    sticky.track(content, [0, 2]);
    assert.equal(fake.props.get(first)?.['zIndex'], 10);
    assert.equal(fake.props.get(second)?.['zIndex'], 10);
    assert.equal(fake.props.get(row), undefined);

    fake.layout(first, { y: 0, height: 40 });
    fake.layout(second, { y: 200, height: 40 });
    const byNode = (node: object) => fake.drives.filter((drive) => drive.node === node);
    assert.equal(byNode(first)[0]!.axis, 'y');
    assert.deepEqual(byNode(second)[0]!.range, pinnedRange(200));
    // The first header's range was first open-ended, then stopped where the second arrives.
    assert.deepEqual(byNode(first)[0]!.range, pinnedRange(0));
    assert.deepEqual(byNode(first)[0]!.updates.at(-1), pinnedRange(0, 160));
    assert.equal(byNode(first).length, 1, 'one drive per header, updated rather than replaced');
  });

  it('commits the translate only once scrolling pauses, as RN does after 64 ms', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const fake = fakeEngine();
    const header = element();
    const sticky = new StickyHeaders(fake.engine, element(), () => false);
    sticky.track({ children: [header] } as unknown as HostNode, [0]);
    fake.layout(header, { y: 0, height: 40 });

    sticky.scrolled(30);
    sticky.scrolled(60);
    assert.equal(fake.props.get(header)?.['transform'], undefined, 'nothing written mid-scroll');
    t.mock.timers.tick(63);
    assert.equal(fake.props.get(header)?.['transform'], undefined);
    t.mock.timers.tick(1);
    assert.deepEqual(fake.props.get(header)?.['transform'], [{ translateY: 60 }]);

    sticky.scrolled(90);
    sticky.destroy();
    t.mock.timers.tick(100);
    assert.equal(fake.props.get(header)?.['transform'], undefined, 'a pending settle dies with it');
    assert.equal(fake.props.get(header)?.['zIndex'], undefined);
    assert.deepEqual(fake.stopped, [header], 'and its native drive is stopped');
    assert.equal(fake.layouts.size, 0, 'and its layout listener released');
  });

  it('drives along x for a horizontal list, and releases a header that stops being sticky', () => {
    const fake = fakeEngine();
    const [a, b] = [element(), element()];
    const content = { children: [a, b] } as unknown as HostNode;
    const sticky = new StickyHeaders(fake.engine, element(), () => true);
    sticky.track(content, [0, 1]);
    fake.layout(a, { x: 0, width: 80 });
    fake.layout(b, { x: 300, width: 80 });
    assert.deepEqual(
      fake.drives.map((drive) => drive.axis),
      ['x', 'x'],
    );
    sticky.track(content, [1]);
    assert.deepEqual(fake.stopped, [a]);
    assert.equal(fake.props.get(a)?.['zIndex'], undefined);
    assert.equal(fake.props.get(b)?.['zIndex'], 10);
  });
});
