import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHostElement, createNativeRoot, spreadHostProps } from '@solidnative/platform/solid';
import { registerPlatformComponents } from '@solidnative/fabric';
import { createFakeFabric, type FakeNode } from './fake-fabric.ts';

const flatten = (nodes: readonly FakeNode[]): FakeNode[] =>
  nodes.flatMap((node) => [node, ...flatten(node.children)]);

test('the root carries platform-<os>, so ios:/android: styles match with no app wrapper', () => {
  registerPlatformComponents('ios');
  const fabric = createFakeFabric();
  const root = createNativeRoot({
    fabric,
    rootTag: 1,
    engineOptions: {
      globalStyles: {
        rules: [
          {
            compounds: [{ classes: ['platform-ios'] }, { classes: ['card'] }],
            combinators: ['descendant'],
            specificity: 20,
            order: 0,
            declarations: { opacity: 0.5 },
          },
        ],
      },
    },
  });
  root.render(() => {
    const card = createHostElement('view');
    spreadHostProps(card, () => ({ testID: 'card', class: 'card' }), true);
    return card;
  });
  root.flush();
  assert.ok(root.engine.root.classes?.has('platform-ios'));
  const card = flatten(fabric.roots.get(1) ?? []).find((node) => node.props['testID'] === 'card');
  assert.equal(card?.props['opacity'], 0.5);
  root.dispose();
});
