import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createNativeRoot } from '@solid-native/platform/solid';
import type { LayoutEvent, ScrollPayload, TextInputChangeEvent } from '@solid-native/components';
import { untrack } from 'solid-js';
import { View } from '../src/solid/primitive.ts';
import { createFakeFabric, createClock } from '../../platform/solid-tests/fake-fabric.ts';

const packageRoot = fileURLToPath(new URL('..', import.meta.url));
function resolveFor(conditions: string[], specifier: string) {
  return execFileSync(
    process.execPath,
    [
      ...conditions.map((condition) => `--conditions=${condition}`),
      '--input-type=module',
      '-e',
      `console.log(import.meta.resolve(${JSON.stringify(specifier)}))`,
    ],
    { cwd: packageRoot, encoding: 'utf8' },
  ).trim();
}

test('a browser build resolves both animation subpaths to the React-Native-free module', () => {
  for (const specifier of [
    '@solid-native/components/animations',
    '@solid-native/components/solid/animations',
  ]) {
    assert.match(resolveFor(['browser'], specifier), /\/src\/solid\/animations-web\.ts$/);
    assert.match(resolveFor([], specifier), /\/src\/solid\/animations\.ts$/);
  }
});

test('browser animations drive a Solid binding without loading react-native', async () => {
  const hook = registerHooks({
    resolve(specifier, context, next) {
      if (/^react(?:-native)?(?:\/|$)/.test(specifier))
        throw new Error(`browser animations imported ${specifier}`);
      return next(specifier, context);
    },
  });
  let web: typeof import('../src/solid/animations-web.ts');
  try {
    web = await import('../src/solid/animations-web.ts');
  } finally {
    hook.deregister();
  }
  const { Animated, Easing, AnimatedStyle, nativeAnimationBackend } = web;
  assert.equal(typeof Easing.inOut, 'function');
  const fabric = createFakeFabric(),
    clock = createClock();
  const root = createNativeRoot({ fabric, clock, rootTag: 1 });
  const opacity = new Animated.Value(0.25);
  root.render(() => untrack(() => View({ ref: AnimatedStyle(() => ({ opacity })) })));
  const written = () => fabric.roots.get(1)![0]!.props['opacity'];
  assert.equal(written(), 0.25);
  opacity.setValue(0.75);
  assert.equal(written(), 0.75);
  assert.equal(typeof nativeAnimationBackend.props, 'function');
  root.dispose();
});

test('the root entry is the Solid barrel and carries the event payload types', async () => {
  const root = await import('@solid-native/components');
  const solid = await import('@solid-native/components/solid');
  assert.equal(root.View, solid.View);
  assert.equal(root.Text, solid.Text);
  const layout: LayoutEvent['nativeEvent'] = { layout: { x: 0, y: 0, width: 1, height: 2 } };
  const change: TextInputChangeEvent['nativeEvent'] = { text: 'a', eventCount: 1, target: 3 };
  const scroll: ScrollPayload['contentOffset'] | undefined = undefined;
  assert.deepEqual([layout.layout.height, change.text, scroll], [2, 'a', undefined]);
});
