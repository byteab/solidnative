import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Engine, markComponentHost, type EngineNode, type StyleSheet } from '@solid-native/fabric';
import { createFakeFabric, type FakeNode } from './fake-fabric.ts';

const flatten = (nodes: readonly FakeNode[]): FakeNode[] =>
  nodes.flatMap((node) => [node, ...flatten(node.children)]);

function setup(sheet: StyleSheet) {
  const fabric = createFakeFabric();
  const engine = new Engine(fabric, 1);
  const parent = engine.createElement('view');
  const peer = engine.createElement('view');
  const host = engine.createElement('view');
  // Component hosts can carry a sheet without creating any element under its scope.
  host.hostSheet = sheet;
  markComponentHost(host);
  engine.appendChild(engine.root, parent);
  engine.appendChild(parent, peer);
  engine.appendChild(parent, host);
  const props = (node: EngineNode) =>
    flatten(fabric.roots.get(1) ?? []).find((entry) => entry.instanceHandle === node)!.props;
  return { engine, parent, peer, host, props };
}

describe('framework-neutral host-only structural styles', () => {
  it('invalidates a host when an earlier sibling changes its selector state', () => {
    const { engine, peer, host, props } = setup({
      structural: true,
      rules: [
        {
          compounds: [{ classes: ['active'] }, { classes: [], host: true }],
          combinators: ['later-sibling'],
          specificity: 2000,
          order: 0,
          declarations: { opacity: 0.25 },
        },
      ],
    });
    engine.setClasses(peer, 'active');
    engine.commit();
    assert.equal(props(host)['opacity'], 0.25);
    engine.setClasses(peer, '');
    engine.commit();
    assert.equal(props(host)['opacity'], null);
    engine.setClasses(peer, 'active');
    engine.commit();
    assert.equal(props(host)['opacity'], 0.25);
    assert.equal(engine.commit(), false);
  });

  it('invalidates a host when its position changes without changing its own props', () => {
    const { engine, parent, peer, host, props } = setup({
      structural: true,
      rules: [
        {
          compounds: [{ classes: [], host: true, nth: [{ a: 0, b: 1, fromEnd: true }] }],
          combinators: [],
          specificity: 2000,
          order: 0,
          declarations: { opacity: 0.5 },
        },
      ],
    });
    engine.commit();
    assert.equal(props(host)['opacity'], 0.5);
    const tag = engine.tagOf(host);
    assert.ok(tag, 'the retained host has a native tag before the move');
    engine.appendChild(parent, peer);
    engine.commit();
    assert.equal(props(host)['opacity'], null);
    assert.equal(engine.tagOf(host), tag);
    engine.removeChild(parent, peer);
    engine.commit();
    assert.equal(props(host)['opacity'], 0.5);
  });
});
