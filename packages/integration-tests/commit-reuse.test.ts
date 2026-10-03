/**
 * Incremental commit through the Solid renderer. A full rebuild per update mints fresh shadow nodes
 * for untouched subtrees, which drops scroll offset, text cursor and keyboard focus; these prove
 * that an update reaches Fabric as only the nodes it changed.
 */
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import {
  cleanup,
  render,
  type ComponentRenderResult,
  type FakeFabricNode,
} from '@solid-native/testing';
import { CommitReuse, type CommitReuseProps } from './commit-reuse-fixture.tsx';

function byID(nodes: readonly FakeFabricNode[], id: string): FakeFabricNode | undefined {
  for (const node of nodes) {
    if (node.props['nativeID'] === id) return node;
    const hit = byID(node.children, id);
    if (hit) return hit;
  }
  return undefined;
}

const items = [
  { id: 1, label: 'a' },
  { id: 2, label: 'b' },
];

describe('incremental commit', () => {
  let view: ComponentRenderResult<CommitReuseProps>;

  beforeEach(() => {
    view = render(CommitReuse, { props: { items, padding: 4 } });
    view.fabric.reset();
  });
  afterEach(cleanup);

  it('creates nothing on a prop-only update', () => {
    view.setProps({ padding: 12 });
    assert.equal(view.fabric.calls.completeRoot, 1, 'the update committed');
    assert.equal(view.fabric.calls.createNode, 0, 'no new shadow nodes');
    assert.equal(view.fabric.calls.cloneWithProps, 1, 'only the changed node clones its props');
    assert.equal(byID(view.fabric.committed, 'dynamic')?.props['padding'], 12);
  });

  it('reuses an unchanged sibling subtree by reference', () => {
    const before = byID(view.fabric.committed, 'static')!;
    const childBefore = before.children[0]!;
    view.setProps({ items: [...items, { id: 3, label: 'c' }] });
    assert.equal(view.fabric.calls.completeRoot, 1, 'the update committed');
    const after = byID(view.fabric.committed, 'static')!;
    assert.equal(after, before, 'the untouched subtree is the same object');
    assert.equal(after.children[0], childBefore, 'and so are its descendants');
  });
});
