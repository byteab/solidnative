/**
 * The system text size changing while the app runs.
 *
 * React Native's surface re-measures every text when the content size category changes, on a
 * commit of its own. The engine's next commit is built from the handles it already holds, which
 * are the nodes from before that, measured at the old size: every text whose content had not
 * changed kept its old box, with the glyphs drawn at the new size inside it and clipped. So the
 * engine has to re-measure too, by committing each text node again.
 */
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { Engine } from '@solid-native/fabric';
import { watchConditions } from '@solid-native/device';
import { createFakeFabric, type FakeFabric, type FakeFabricNode } from '@solid-native/testing';

function flatten(nodes: FakeFabricNode[]): FakeFabricNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}

describe('re-measuring text', () => {
  let fabric: FakeFabric;
  let engine: Engine;

  beforeEach(() => {
    fabric = createFakeFabric();
    engine = new Engine(fabric, 1);
  });

  /** The committed node for each view name, by its react tag. */
  const committed = (viewName: string) =>
    flatten(fabric.committed).filter((node) => node.viewName === viewName);

  it('commits every text and text input again, with its children, and nothing else', () => {
    const column = engine.createElement('view');
    const label = engine.createElement('text');
    engine.appendChild(label, engine.createText('Services'));
    const nested = engine.createElement('text');
    engine.appendChild(nested, engine.createText(' and more'));
    engine.appendChild(label, nested);
    const field = engine.createElement('text-input');
    const spacer = engine.createElement('view');
    engine.appendChild(column, label);
    engine.appendChild(column, field);
    engine.appendChild(column, spacer);
    engine.appendChild(engine.root, column);
    engine.commit();

    const before = new Map(
      flatten(fabric.committed).map((node) => [node.reactTag, node.handle] as const),
    );
    const cloned = fabric.calls.cloneWithChildren + fabric.calls.cloneWithChildrenAndProps;

    engine.remeasureText();

    const moved = (node: FakeFabricNode) => before.get(node.reactTag) !== node.handle;
    assert.equal(moved(committed('Paragraph')[0]!), true, 'the paragraph is a new revision');
    assert.equal(moved(committed('TextInput')[0]!), true, 'and so is the text input');
    const views = committed('View');
    assert.equal(moved(views.at(-1)!), false, 'a view with nothing to measure is left alone');
    assert.ok(
      fabric.calls.cloneWithChildren + fabric.calls.cloneWithChildrenAndProps > cloned,
      'cloned with its children, which is what makes Fabric measure it again',
    );
    assert.deepEqual(
      flatten(committed('Paragraph')[0]!.children).map((node) => node.props['text']),
      ['Services', undefined, ' and more'],
      'with the same content',
    );
  });

  it('re-measures nothing twice: the next ordinary commit is ordinary again', () => {
    const label = engine.createElement('text');
    engine.appendChild(label, engine.createText('Once'));
    engine.appendChild(engine.root, label);
    engine.commit();
    engine.remeasureText();
    const handle = committed('Paragraph')[0]!.handle;

    engine.updateConditions({ width: 1, height: 1, colorScheme: 'light' });
    assert.equal(committed('Paragraph')[0]!.handle, handle);
  });
});

describe('watchConditions and the text size', () => {
  type Listener = (sizes: { window: object; screen: object }) => void;
  let dimensions: Listener[];
  let appState: ((state: string) => void)[];
  let fontScale: number;
  let remeasured: number;
  const original = (globalThis as { require?: unknown }).require;

  beforeEach(() => {
    dimensions = [];
    appState = [];
    fontScale = 1;
    remeasured = 0;
    const subscription = { remove: () => {} };
    const native = {
      Dimensions: {
        get: () => ({ width: 390, height: 844, fontScale }),
        addEventListener: (_: string, listener: Listener) => (
          dimensions.push(listener),
          subscription
        ),
      },
      Appearance: {
        getColorScheme: () => 'light',
        addChangeListener: () => subscription,
      },
      AccessibilityInfo: {
        isScreenReaderEnabled: async () => false,
        isReduceMotionEnabled: async () => false,
        isBoldTextEnabled: async () => false,
        addEventListener: () => subscription,
      },
      AppState: {
        currentState: 'active',
        addEventListener: (_: string, listener: (state: string) => void) => (
          appState.push(listener),
          subscription
        ),
      },
      PixelRatio: { get: () => 3, getFontScale: () => fontScale },
    };
    // What `reactNative()` reaches for on a device, where the bundle is CommonJS.
    (globalThis as { require?: unknown }).require = () => native;
  });

  afterEach(() => {
    (globalThis as { require?: unknown }).require = original;
  });

  const engine = () => ({
    root: 'root',
    updateConditions: () => {},
    addClass: () => {},
    removeClass: () => {},
    remeasureText: () => remeasured++,
  });

  const resize = (scale: number) => {
    fontScale = scale;
    for (const listener of dimensions) {
      listener({ window: { width: 390, height: 844, fontScale: scale }, screen: {} });
    }
  };

  it('re-measures text when the text size changes, and only then', () => {
    const stop = watchConditions(engine());
    resize(1);
    assert.equal(remeasured, 0, 'a resize at the same text size is only a resize');
    resize(1.5);
    assert.equal(remeasured, 1);
    resize(1.5);
    assert.equal(remeasured, 1);
    stop();
  });

  it('re-measures when the app comes back at a different text size', () => {
    const stop = watchConditions(engine());
    fontScale = 2;
    for (const listener of appState) listener('active');
    assert.equal(remeasured, 1);
    resize(2);
    assert.equal(remeasured, 1, 'the same change reported twice is one change');
    stop();
  });
});
