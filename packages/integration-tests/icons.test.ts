/**
 * Icons: lucide-static's markup, react-native-svg's native shapes, drawn by Solid's `Icon`.
 *
 * Two halves, and the second is where the bugs would be. Parsing is a scanner over a trusted
 * constant. Translating is not: `fill` and `stroke` are brush structs rather than colours,
 * `stroke-linecap` is an integer rather than the word it is written as, and a shape has to
 * declare what it set so native knows what to inherit. Every one of those fails silently, so
 * every one is pinned here.
 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createNativeRoot, type NativeRoot } from '@solidnative/platform/solid';
import { parseSvg } from '../icons/src/parse-svg.ts';
import {
  brushOf,
  nativeProps,
  pointsToPath,
  styleAttributes,
  transformMatrix,
  viewBoxProps,
} from '../icons/src/svg-props.ts';
import { createFakeFabric, type FakeNode } from '../platform/solid-tests/fake-fabric.ts';
import { iconHost } from './metro-icon-host.tsx';

const flatten = (nodes: readonly FakeNode[]): FakeNode[] =>
  nodes.flatMap((node) => [node, ...flatten(node.children)]);

const colour = { color: (value: string) => `processed:${value}` };

describe('parsing an icon', () => {
  it('reads the tree, keeping only elements', () => {
    const root = parseSvg(
      '<svg viewBox="0 0 24 24"><!-- a comment --><g><path d="M0 0"/></g></svg>',
    );
    assert.equal(root?.tag, 'svg');
    assert.equal(root?.attrs['viewBox'], '0 0 24 24');
    assert.equal(root?.children[0]?.tag, 'g');
    assert.equal(root?.children[0]?.children[0]?.attrs['d'], 'M0 0');
  });

  it('skips a comment even when it holds markup', () => {
    const root = parseSvg('<svg><!-- <path d="M0 0"/> --><circle r="1"/></svg>');
    assert.deepEqual(
      root?.children.map((child) => child.tag),
      ['circle'],
    );
  });

  it('handles both quote styles and an unclosed root', () => {
    const root = parseSvg(`<svg fill='none'><path d="M1 1"></path></svg>`);
    assert.equal(root?.attrs['fill'], 'none');
    assert.equal(root?.children.length, 1);
  });

  it('keeps self-closing elements as siblings, which the greedy attribute run hides', () => {
    const root = parseSvg('<svg><circle r="1"/><circle r="2"/><path d="M0 0"/></svg>');
    assert.equal(root?.children.length, 3);
    assert.deepEqual(
      root?.children.map((child) => child.children.length),
      [0, 0, 0],
      'nesting them would inherit paint that was never meant for them',
    );
  });

  it('is nothing for markup with no element in it', () => {
    assert.equal(parseSvg('<!-- nothing here -->'), null);
  });
});

describe('translating an icon', () => {
  it('turns paint into a brush, because native does not take a colour', () => {
    assert.deepEqual(brushOf('#fff', colour), { type: 0, payload: 'processed:#fff' });
    assert.equal(brushOf('none', colour), null);
    assert.deepEqual(brushOf('currentColor', colour), { type: 2 }, 'resolved by the view, later');
    assert.deepEqual(brushOf('url(#grad)', colour), { type: 1, brushRef: 'grad' });
  });

  it('turns the keyword props into the integers they really are', () => {
    const props = nativeProps(
      'path',
      { 'stroke-linecap': 'round', 'stroke-linejoin': 'bevel', 'fill-rule': 'evenodd', d: 'M0 0' },
      colour,
    );
    assert.equal(props['strokeLinecap'], 1);
    assert.equal(props['strokeLinejoin'], 2);
    assert.equal(props['fillRule'], 0);
    assert.equal(props['d'], 'M0 0');
  });

  it('turns the opacity props into numbers, because Android takes a float', () => {
    const props = nativeProps(
      'path',
      {
        opacity: '0.5',
        'fill-opacity': '.4',
        'stroke-opacity': '1',
        'stroke-dashoffset': '2',
        'stroke-miterlimit': '10',
        d: 'M0 0',
      },
      colour,
    );
    assert.equal(props['opacity'], 0.5);
    assert.equal(props['fillOpacity'], 0.4);
    assert.equal(props['strokeOpacity'], 1);
    assert.equal(props['strokeDashoffset'], 2);
    assert.equal(props['strokeMiterlimit'], 10);
  });

  it('falls back to the native default when an opacity does not parse', () => {
    const props = nativeProps(
      'path',
      { opacity: 'inherit', 'stroke-dashoffset': 'nonsense', 'stroke-miterlimit': 'nope' },
      colour,
    );
    assert.equal(props['opacity'], 1);
    assert.equal(props['strokeDashoffset'], 0);
    assert.equal(props['strokeMiterlimit'], 4);
  });

  it('reads an unknown fill rule as nonzero, the SVG default', () => {
    assert.equal(nativeProps('path', { 'fill-rule': 'sideways' }, colour)['fillRule'], 1);
  });

  it('leaves strokeWidth a string, which native takes either way', () => {
    const props = nativeProps('path', { 'stroke-width': '1.5' }, colour);
    assert.equal(props['strokeWidth'], '1.5');
  });

  it('lists what the shape set, which is what native inherits around', () => {
    const props = nativeProps('path', { stroke: 'currentColor', d: 'M0 0' }, colour);
    assert.deepEqual(props['propList'], ['stroke']);

    const bare = nativeProps('path', { d: 'M0 0' }, colour);
    assert.equal(bare['propList'], undefined, 'nothing of its own, so everything is inherited');
  });

  it('makes a path out of a polyline, which has no component of its own', () => {
    assert.equal(pointsToPath('4,4 8,8 12,4', false), 'M4,4L8,8L12,4');
    assert.equal(pointsToPath('4 4 8 8', true), 'M4,4L8,8Z', 'a polygon closes');
    assert.equal(nativeProps('polygon', { points: '0,0 4,0 4,4' }, colour)['d'], 'M0,0L4,0L4,4Z');
  });

  it('reads a style attribute as attributes, a custom property as its fallback', () => {
    assert.deepEqual(styleAttributes('stroke-width: 1.5; opacity:.5'), {
      'stroke-width': '1.5',
      opacity: '.5',
    });
    assert.deepEqual(
      styleAttributes('stroke-width:var(--width, 1.5);fill:var(--paint)'),
      { 'stroke-width': '1.5' },
      'nothing defines a custom property here, so one without a fallback is dropped',
    );
  });

  it('reads a viewBox as the four props the view takes', () => {
    assert.deepEqual(viewBoxProps('0 0 24 24'), {
      minX: 0,
      minY: 0,
      vbWidth: 24,
      vbHeight: 24,
      align: 'xMidYMid',
      meetOrSlice: 0,
    });
    assert.deepEqual(viewBoxProps('nonsense'), {}, 'rather than committing NaN geometry');
    assert.deepEqual(viewBoxProps('0,0,24,24'), viewBoxProps('0 0 24 24'), 'commas separate too');
  });

  it('composes a transform into the matrix native takes', () => {
    assert.deepEqual(transformMatrix('matrix(1,2,3,4,5,6)'), [1, 2, 3, 4, 5, 6]);
    assert.deepEqual(transformMatrix('translate(4 5)'), [1, 0, 0, 1, 4, 5]);
    assert.deepEqual(transformMatrix('scale(2)'), [2, 0, 0, 2, 0, 0]);
    const rotated = transformMatrix('rotate(90)')!;
    assert.ok(Math.abs(rotated[0]!) < 1e-9 && Math.abs(rotated[1]! - 1) < 1e-9);
    const about = transformMatrix('rotate(90 12 12)')!.map((n) => Math.round(n * 1e9) / 1e9 || 0);
    assert.deepEqual(about, [0, 1, -1, 0, 24, 0], 'turned about its own centre');
    assert.deepEqual(
      transformMatrix('translate(10 0) scale(2)'),
      [2, 0, 0, 2, 10, 0],
      'applied right to left, as SVG composes a list',
    );
  });
});

describe('an icon in the tree', () => {
  const fixture = iconHost();
  const fabric = createFakeFabric();
  let root: NativeRoot;

  before(() => {
    root = createNativeRoot({
      fabric,
      rootTag: 1,
      engineOptions: { processColor: (value) => `processed:${String(value)}` },
    });
    root.render(fixture.IconHost);
  });
  after(() => root.dispose());

  const byId = (id: string) => {
    const node = flatten(fabric.roots.get(1) ?? []).find((entry) => entry.props['testID'] === id);
    assert.ok(node, id);
    return node;
  };

  it('commits the host as the native svg view', () => {
    assert.equal(byId('named').viewName, 'RNSVGSvgView');
    // Style is flattened into props by the engine, so the size arrives as two of them.
    assert.equal(byId('named').props['width'], 24);
    assert.equal(byId('named').props['height'], 24);
    assert.equal(byId('named').props['name'], undefined, 'the input is not a native prop');
  });

  it('takes a size written as a string, as the web writes it', () => {
    // A string width is one native drops, and the icon lost its size.
    assert.equal(byId('static').props['width'], 32);
    assert.equal(byId('static').props['bbWidth'], 32);
  });

  it('finds the icon through its provider, by the name a web app uses', () => {
    const paths = flatten([byId('named')]).filter((n) => n.viewName === 'RNSVGPath');
    assert.equal(paths.length, 1, 'the lucide icon drew');
    assert.match(String(paths[0]?.props['d']), /^M12 3q1 4/);
  });

  it('carries the root presentation on a group, so the shapes inherit it', () => {
    const group = byId('named').children[0]!;
    assert.equal(group.viewName, 'RNSVGGroup');
    assert.deepEqual(group.props['stroke'], { type: 2 }, 'currentColor, for the view to resolve');
    assert.equal(group.props['strokeWidth'], '2', 'from the root stroke-width attribute');
    assert.equal(group.props['strokeLinecap'], 1, 'round, as an integer');
  });

  it('hands the view the colour a currentColor brush paints from', () => {
    assert.equal(byId('named').props['color'], 'processed:#ff9f0a');
  });

  it('reads the viewBox off the markup rather than assuming one', () => {
    assert.equal(byId('named').props['vbWidth'], 24);
    assert.equal(byId('named').props['minX'], 0);
  });

  it('draws geometry and a polyline from raw markup, with the stroke width the app set', () => {
    const shapes = flatten([byId('raw')]).map((node) => node.viewName);
    assert.deepEqual(shapes, [
      'RNSVGSvgView',
      'RNSVGGroup',
      'RNSVGCircle',
      'RNSVGCircle',
      'RNSVGCircle',
      'RNSVGPath',
    ]);
    const group = byId('raw').children[0]!;
    assert.equal(group.children.length, 4, 'siblings, not one inside the next');
    assert.equal(group.props['strokeWidth'], '3', "the prop replaced the root's stroke width");
  });

  it('draws only the elements native has a view for, and is labelled for a screen reader', () => {
    const labelled = byId('labelled');
    assert.deepEqual(
      flatten([labelled])
        .map((n) => n.viewName)
        .filter((name) => name !== 'RNSVGSvgView'),
      ['RNSVGGroup', 'RNSVGCircle'],
    );
    assert.equal(labelled.props['accessible'], true);
    assert.equal(labelled.props['accessibilityRole'], 'image');
  });

  it('takes the old drawing down when the markup changes', () => {
    fixture.setOdd('<svg viewBox="0 0 24 24"><rect width="2" height="2"/></svg>');
    root.flush();
    assert.deepEqual(
      flatten([byId('labelled')])
        .map((n) => n.viewName)
        .filter((name) => name !== 'RNSVGSvgView'),
      ['RNSVGGroup', 'RNSVGRect'],
    );
  });

  it('redraws when the size changes, without leaving the old drawing behind', () => {
    fixture.setSize(40);
    root.flush();
    assert.equal(byId('named').props['width'], 40);
    assert.equal(
      flatten([byId('named')]).filter((n) => n.viewName === 'RNSVGGroup').length,
      1,
      'one group, not two',
    );
  });
});
