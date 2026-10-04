/**
 * What a commit costs beyond the nodes that changed. These drive the engine directly, because the
 * questions are about the reconcile walk and have nothing to do with the UI framework.
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import {
  Engine,
  claimHost,
  markComponentHost,
  registerViewName,
  type EngineNode,
  type StyleSheet,
} from '@solidnative/fabric';
import { resetStyleStats, styleStats } from '../fabric/src/css.ts';
import { createFakeFabric, type FakeFabric } from '@solidnative/testing';

const sheet: StyleSheet = {
  rules: [
    {
      compounds: [{ classes: ['row'] }],
      combinators: [],
      specificity: 10,
      order: 0,
      declarations: { padding: 4, color: 'red' },
    },
  ],
};

describe('what a commit touches', () => {
  let fabric: FakeFabric;
  let colours: number;
  let assets: number;
  let engine: Engine;

  beforeEach(() => {
    fabric = createFakeFabric();
    colours = 0;
    assets = 0;
    engine = new Engine(fabric, 1, {
      processColor: (value) => (colours++, value),
      resolveAssetSource: (value) => (assets++, { uri: String(value) }),
    });
  });

  const rows = (container: EngineNode, count: number): EngineNode[] =>
    Array.from({ length: count }, () => {
      const row = engine.createElement('view', sheet);
      engine.addClass(row, 'row');
      const text = engine.createElement('text', sheet);
      engine.appendChild(text, engine.createText('hi'));
      engine.appendChild(row, text);
      engine.appendChild(container, row);
      return row;
    });

  it('processes no colour on an ancestor that only has a dirty subtree', () => {
    const outer = engine.createElement('view');
    engine.setProp(outer, 'style', { backgroundColor: 'red' });
    const inner = engine.createElement('view');
    engine.setProp(inner, 'style', { borderColor: 'blue' });
    const label = engine.createText('a');
    engine.appendChild(engine.root, outer);
    engine.appendChild(outer, inner);
    engine.appendChild(inner, label);
    engine.commit();
    assert.equal(colours, 2, 'each colour once on mount');

    colours = 0;
    engine.setText(label, 'b');
    engine.commit();
    assert.equal(colours, 0, 'the ancestors are clean; nothing about them is recomputed');
  });

  it('processes only the props that changed, so a stable source is not resolved again', () => {
    const image = engine.createElement('image');
    engine.setProp(image, 'source', 42);
    engine.appendChild(engine.root, image);
    engine.commit();
    assert.equal(assets, 1);

    engine.setProp(image, 'testID', 'hero');
    engine.commit();
    assert.equal(assets, 1, 'the source did not change, so it was not resolved again');
  });

  it('re-resolves nothing below a container whose inline style changed', () => {
    const container = engine.createElement('view', sheet);
    engine.appendChild(engine.root, container);
    rows(container, 200);
    engine.commit();

    resetStyleStats();
    engine.setProp(container, 'style', { opacity: 0.5 });
    engine.commit();
    assert.equal(styleStats.nodesResolved, 0, 'inline style is not part of the cascade');
    assert.equal(fabric.calls.cloneWithProps, 1, 'only the container re-cloned');
  });

  it('sends a command to the committed handle', () => {
    const input = engine.createElement('text-input');
    engine.appendChild(engine.root, input);
    engine.commit();

    engine.dispatchCommand(input, 'focus', []);
    assert.deepEqual(fabric.commands, [{ viewName: 'TextInput', name: 'focus', args: [] }]);
  });

  it('ignores a command for a node that has not been committed yet', () => {
    const input = engine.createElement('text-input');
    engine.dispatchCommand(input, 'focus', []);
    assert.deepEqual(fabric.commands, []);
  });
});

describe('a class change on the engine root', () => {
  it('restyles the descendants it matches, with nothing else changed', () => {
    const fabric = createFakeFabric();
    const engine = new Engine(fabric, 1);
    const dark: StyleSheet = {
      rules: [
        {
          compounds: [{ classes: ['dark'] }, { classes: ['row'] }],
          combinators: ['descendant'],
          specificity: 20,
          order: 0,
          declarations: { backgroundColor: 'black' },
        },
      ],
    };
    const row = engine.createElement('view', dark);
    engine.addClass(row, 'row');
    engine.appendChild(engine.root, row);
    engine.commit();
    const background = () => fabric.committed[0]?.props['backgroundColor'];
    assert.equal(background(), undefined);

    engine.addClass(engine.root, 'dark');
    engine.commit();
    assert.equal(background(), 'black');
  });
});

// The dev typo check must stay quiet for a primitive used without its component.
describe('a primitive used without its component', () => {
  const dev = { dev: true };

  it('is silent for a claimed node, a component host, and outside dev', () => {
    const reports: string[] = [];
    const original = console.error;
    console.error = (message: string) => reports.push(message);
    try {
      const engine = new Engine(createFakeFabric(), 1, dev);
      const text = engine.createElement('text');
      claimHost(text);
      engine.appendChild(engine.root, text);
      // A name no table knows is fine when a component is mounted on it; a bare one is a typo,
      // which `unknown-element.test.ts` covers.
      const card = engine.createElement('x-card');
      markComponentHost(card);
      engine.appendChild(engine.root, card);
      engine.commit();

      const release = new Engine(createFakeFabric(), 1);
      release.appendChild(release.root, release.createElement('text'));
      release.commit();
    } finally {
      console.error = original;
    }
    assert.deepEqual(reports, []);
  });
});

/**
 * The native animation driver writes to a view by react tag, so the tag the engine gave a node
 * has to be reachable from the outside. `findNodeHandle` returns a number it is handed
 * unchanged, which is what lets an animated graph point at one of our nodes with no React
 * instance anywhere.
 */
describe("a node's react tag", () => {
  it('is reported once the node has been committed, and not before', () => {
    const engine = new Engine(createFakeFabric(), 1);
    const view = engine.createElement('view');
    assert.equal(engine.tagOf(view), null, 'nothing exists natively yet');

    engine.appendChild(engine.root, view);
    engine.commit();

    const tag = engine.tagOf(view);
    assert.equal(typeof tag, 'number');
    assert.notEqual(tag, 0, 'root tags are odd, view tags are even and non-zero');
    assert.equal(tag! % 2, 0);
  });

  it('is stable across commits, so a connected animation keeps writing to the same view', () => {
    const engine = new Engine(createFakeFabric(), 1);
    const view = engine.createElement('view');
    engine.appendChild(engine.root, view);
    engine.commit();
    const tag = engine.tagOf(view);

    engine.setProp(view, 'testID', 'changed');
    engine.commit();

    assert.equal(engine.tagOf(view), tag);
  });

  it('stays the tag the node was created with when other nodes are created after it', () => {
    // A re-cloned node recorded the engine's newest tag rather than its own, so once anything
    // else had been created, a prop change on a map pointed its tag at another view, and
    // expo-maps' setCameraPosition failed with SwiftUIViewNotFound on every call after.
    const fabric = createFakeFabric();
    const engine = new Engine(fabric, 1);
    const map = engine.createElement('view');
    engine.appendChild(engine.root, map);
    engine.commit();
    const tag = engine.tagOf(map);
    assert.equal(tag, fabric.committed[0]!.reactTag);

    engine.appendChild(engine.root, engine.createElement('view'));
    engine.commit();
    engine.setProp(map, 'testID', 'moved');
    engine.commit();

    assert.equal(engine.tagOf(map), tag);
  });
});

describe('the react tags a surface uses', () => {
  const tagsOf = (fabric: FakeFabric) => {
    const all: number[] = [];
    const walk = (nodes: FakeFabric['committed']) =>
      nodes.forEach((node) => (all.push(node.reactTag), walk(node.children)));
    walk(fabric.committed);
    return all;
  };

  const surface = (rootTag: number, count: number) => {
    const fabric = createFakeFabric();
    const engine = new Engine(fabric, rootTag);
    for (let i = 0; i < count; i++) engine.appendChild(engine.root, engine.createElement('view'));
    engine.commit();
    return tagsOf(fabric);
  };

  it('keeps clear of the tags React hands out in the same app', () => {
    // React numbers its views 2, 4, 6... on every surface it renders, and a development build
    // always has one: LogBox, which renders a warning on a surface of its own. Native keeps one
    // registry of views by tag for all surfaces, so a view of React's with a tag of ours was a
    // second view under one tag, and the first console.warn crashed the app natively in
    // -[RCTComponentViewRegistry dequeueComponentViewWithComponentHandle:tag:].
    const ours = surface(1, 50);
    const reactsFirstMillion = 2 * 1_000_000;
    assert.ok(
      ours.every((tag) => tag > reactsFirstMillion),
      `lowest tag ${Math.min(...ours)}`,
    );
    assert.ok(
      ours.every((tag) => tag % 2 === 0 && tag < 2 ** 31),
      'even, and an int32 as native keeps it',
    );
  });

  it('gives two surfaces different tags', () => {
    const first = new Set(surface(1, 20));
    assert.ok(surface(11, 20).every((tag) => !first.has(tag)));
  });
});

describe('what a commit sends', () => {
  const committed = (props: Record<string, unknown>) => {
    const fabric = createFakeFabric();
    const engine = new Engine(fabric, 1);
    const view = engine.createElement('view');
    for (const [key, value] of Object.entries(props)) engine.setProp(view, key, value);
    engine.appendChild(engine.root, view);
    engine.commit();
    return fabric.committed[0]!.props;
  };

  it("converts a drop-shadow filter's colour, which Android refuses as a string", () => {
    // Android's filter parser reads the colour as a number and throws on a string, taking the
    // whole surface down, where a box shadow's string colour is only dropped.
    const fabric = createFakeFabric();
    const engine = new Engine(fabric, 1, { processColor: (value) => `processed ${value}` });
    const view = engine.createElement('view');
    engine.setProp(view, 'style', {
      filter: [{ brightness: 0.5 }, { dropShadow: { offsetX: 0, offsetY: 4, color: 'red' } }],
    });
    engine.appendChild(engine.root, view);
    engine.commit();
    assert.deepEqual(fabric.committed[0]!.props['filter'], [
      { brightness: 0.5 },
      { dropShadow: { offsetX: 0, offsetY: 4, color: 'processed red' } },
    ]);
  });

  it("keeps an inline style's transition to the engine, and still eases what it names", () => {
    // TouchableOpacity writes `$transition` into its inline style: only the full merge reads it.
    const fabric = createFakeFabric();
    const engine = new Engine(fabric, 1);
    const view = engine.createElement('view');
    const style = (opacity: number) => ({
      opacity,
      $transition: { opacity: { duration: 100, delay: 0, easing: [0, 0, 1, 1] } },
    });
    engine.setProp(view, 'style', style(1));
    engine.appendChild(engine.root, view);
    engine.commit();
    assert.equal(fabric.committed[0]!.props['$transition'], undefined);
    engine.setProp(view, 'style', style(0));
    engine.commit();
    assert.ok(engine.animating, 'the opacity eases rather than jumping');
  });

  it('starts an element with the props compiled for it, which later writes replace', () => {
    const fabric = createFakeFabric();
    const engine = new Engine(fabric, 1, { processColor: (value) => `processed ${value}` });
    const statics = { testID: 'row', style: { color: 'red', direction: 'rtl' } };
    const view = engine.createElement('view', null, statics);
    engine.appendChild(engine.root, view);
    engine.commit();
    assert.equal(fabric.committed[0]!.props['testID'], 'row');
    assert.equal(fabric.committed[0]!.props['color'], 'processed red');
    engine.setProp(view, 'testID', 'other');
    engine.commit();
    assert.equal(view.props['testID'], 'other');
    assert.equal(statics.testID, 'row', 'the compiled object is shared, never written');
  });

  it('merges the props of nodes made from one compiled element and one style object once', () => {
    const fabric = createFakeFabric();
    const sent: { viewName: string; props: object }[] = [];
    const createNode = fabric.createNode.bind(fabric);
    fabric.createNode = (tag, viewName, rootTag, props, instance) => {
      sent.push({ viewName, props });
      return createNode(tag, viewName, rootTag, props, instance);
    };
    const engine = new Engine(fabric, 1);
    const statics = { testID: 'label' };
    const style = { color: 'red', fontSize: 12 };
    const make = () => {
      const text = engine.createElement('text', null, statics);
      engine.setProp(text, 'style', style);
      engine.appendChild(text, engine.createText('a'));
      engine.appendChild(engine.root, text);
      return text;
    };
    make();
    make();
    engine.commit();
    const paragraphs = sent.filter((call) => call.viewName === 'Paragraph');
    assert.equal(paragraphs.length, 2);
    assert.equal(paragraphs[0]!.props, paragraphs[1]!.props, 'one props object for both');
    assert.equal(fabric.committed[1]!.props['color'], 'red');
    assert.equal(fabric.committed[1]!.props['testID'], 'label');
  });

  it('merges a node again once its style or any other prop differs', () => {
    const fabric = createFakeFabric();
    const engine = new Engine(fabric, 1);
    const statics = { testID: 'row' };
    const shared = { opacity: 0.5 };
    const views = [0, 1, 2].map(() => {
      const view = engine.createElement('view', null, statics);
      engine.appendChild(engine.root, view);
      return view;
    });
    engine.setProp(views[0]!, 'style', shared);
    engine.setProp(views[1]!, 'style', { opacity: 0.25 });
    engine.setProp(views[2]!, 'style', shared);
    engine.setProp(views[2]!, 'accessibilityLabel', 'third');
    engine.commit();
    assert.equal(fabric.committed[0]!.props['opacity'], 0.5);
    assert.equal(fabric.committed[1]!.props['opacity'], 0.25);
    assert.equal(fabric.committed[2]!.props['opacity'], 0.5);
    assert.equal(fabric.committed[2]!.props['accessibilityLabel'], 'third');
    assert.equal(fabric.committed[0]!.props['accessibilityLabel'], undefined);
    // A node that shared the props and then changes its style gets its own.
    engine.setProp(views[0]!, 'style', { opacity: 1 });
    engine.commit();
    assert.equal(fabric.committed[0]!.props['opacity'], 1);
    assert.equal(fabric.committed[2]!.props['opacity'], 0.5);
  });

  it("converts the colours in a registered view's defaults", () => {
    registerViewName('tinted-default-view', 'RCTView', { backgroundColor: 'red' });
    const fabric = createFakeFabric();
    const engine = new Engine(fabric, 1, { processColor: (value) => `processed ${value}` });
    engine.appendChild(engine.root, engine.createElement('tinted-default-view'));
    engine.commit();
    assert.equal(fabric.committed[0]!.props['backgroundColor'], 'processed red');
  });

  it('keeps hyphenated attributes to the engine, since no native prop is spelt that way', () => {
    const props = committed({ 'data-row': '3', testID: 'row' });
    assert.equal(props['data-row'], undefined);
    assert.equal(props['testID'], 'row');
  });

  it('sizes from an intrinsic size, leaving the height to an aspect ratio the style sets', () => {
    const props = committed({
      intrinsicSize: { width: 100, height: 50 },
      style: { aspectRatio: 1 },
    });
    assert.deepEqual([props['width'], props['height'], props['aspectRatio']], [100, undefined, 1]);
  });
});
