/** @jsxImportSource @solid-native/platform/solid */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSignal } from 'solid-js';
import { createNativeRoot } from '@solid-native/platform/solid';
import { Icon, IconProvider } from '@solid-native/icons/solid';
import { createFakeFabric } from '../../platform/solid-tests/fake-fabric.ts';
import type { NativeRef } from '@solid-native/components/solid';
const path =
  '<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="1.5"><path d="M0 0L2 2"/></svg>';
const circle = '<svg viewBox="1 2 16 18"><circle cx="8" cy="8" r="4" /></svg>';

test('compiled nearest reactive providers resolve kebab names without injector-based icon DI', () => {
  const fabric = createFakeFabric();
  const root = createNativeRoot({ fabric, rootTag: 501 });
  const [icons, setIcons] = createSignal({ HeartPulse: circle });
  root.render(() => (
    <IconProvider icons={{ HeartPulse: path, outerOnly: path }}>
      <IconProvider icons={icons()}>
        <Icon name="heart-pulse" />
        <Icon name="outer-only" />
      </IconProvider>
    </IconProvider>
  ));
  const nodes = fabric.roots.get(501)!;
  assert.equal(nodes[0]!.viewName, 'RNSVGSvgView');
  assert.equal(nodes[0]!.children[0]!.children[0]!.viewName, 'RNSVGCircle');
  assert.equal(nodes[1]!.children[0]!.children[0]!.viewName, 'RNSVGPath');
  assert.equal(nodes[0]!.props['minX'], 1);
  assert.equal(nodes[0]!.props['accessible'], false);
  setIcons({ HeartPulse: path });
  root.flush();
  assert.equal(fabric.roots.get(501)![0]!.tag, nodes[0]!.tag);
  assert.equal(fabric.roots.get(501)![0]!.children[0]!.children[0]!.viewName, 'RNSVGPath');
  root.dispose();
});
test('raw SVG wins; size/color/stroke changes retain shape identities and markup cleanup releases old nodes', () => {
  const fabric = createFakeFabric();
  const root = createNativeRoot({ fabric, rootTag: 502 });
  const [svg, setSvg] = createSignal<string | undefined>(path);
  const [color, setColor] = createSignal('red');
  const [stroke, setStroke] = createSignal(2);
  const [size, setSize] = createSignal<number | string>('32');
  let ref!: NativeRef;
  root.render(() => (
    <IconProvider icons={{ choice: circle }}>
      <Icon
        name="choice"
        svg={svg()}
        color={color()}
        strokeWidth={stroke()}
        size={size()}
        accessibilityLabel="Favorite"
        ref={(value) => {
          ref = value;
        }}
      />
    </IconProvider>
  ));
  const icon = fabric.roots.get(502)![0]!;
  const group = icon.children[0]!;
  const shape = group.children[0]!;
  assert.equal(shape.viewName, 'RNSVGPath');
  assert.deepEqual(group.props['stroke'], { type: 2 });
  assert.equal(group.props['strokeWidth'], '2', 'the prop replaces the root stroke width');
  assert.equal(shape.props['strokeWidth'], undefined, 'and the shape inherits it');
  assert.equal(icon.props['bbWidth'], 32);
  assert.equal(icon.props['accessibilityRole'], 'image');
  setStroke(3);
  setColor('blue');
  setSize(40);
  root.flush();
  const updated = fabric.roots.get(502)![0]!;
  assert.equal(updated.tag, icon.tag);
  assert.equal(updated.children[0]!.tag, group.tag);
  assert.equal(updated.children[0]!.children[0]!.tag, shape.tag);
  assert.equal(updated.children[0]!.props['strokeWidth'], '3');
  assert.equal(updated.props['bbWidth'], 40);
  setSvg(undefined);
  root.flush();
  assert.equal(fabric.roots.get(502)![0]!.children[0]!.children[0]!.viewName, 'RNSVGCircle');
  assert.equal(group.instanceHandle.parent, null);
  assert.equal(shape.instanceHandle.committed, null);
  root.dispose();
  assert.equal(ref.isAttached(), false);
  assert.deepEqual(fabric.roots.get(502), []);
});
test('missing and malformed icons clear old native shapes; unsupported markup stays inert', () => {
  const fabric = createFakeFabric();
  const root = createNativeRoot({ fabric, rootTag: 503 });
  const [svg, setSvg] = createSignal(path);
  root.render(() => <Icon svg={svg()} />);
  setSvg('not SVG');
  root.flush();
  assert.deepEqual(fabric.roots.get(503)![0]!.children, []);
  setSvg(
    '<svg><script>ignored</script><polygon points="0,0 2,2 0,2"/><unknown><circle r="9"/></unknown></svg>',
  );
  root.flush();
  const children = fabric.roots.get(503)![0]!.children[0]!.children;
  assert.equal(children.length, 1);
  assert.equal(children[0]!.props['d'], 'M0,0L2,2L0,2Z');
  root.dispose();
});
