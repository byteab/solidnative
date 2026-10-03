/** @jsxImportSource @solidnative/platform/solid */
import { createSignal } from 'solid-js';
import { Show, withNativeStyles, setNativeStyleHost } from '@solidnative/platform/solid';
import type { EngineNode } from '@solidnative/fabric';
import outer from './css-compiled-outer.native.css';
import inner from './css-compiled-inner.native.css';

export function createCssFixture() {
  const [shown, setShown] = createSignal(false);
  const [active, setActive] = createSignal(false);
  const [ink, setInk] = createSignal<string | undefined>(undefined);
  const [hover, setHover] = createSignal(false);
  const nodes = new Map<string, EngineNode>();
  function Inner() {
    return withNativeStyles(inner, () => (
      <view testID="inner" ref={(node) => setNativeStyleHost(node, inner)}>
        <Show when={shown()}>
          <text testID="later" class="label" ref={(node) => nodes.set('later', node)}>
            Later
          </text>
        </Show>
      </view>
    ));
  }
  function Scoped() {
    return withNativeStyles(outer, () => (
      <view
        testID="outer"
        style={{ '--ink': ink() }}
        ref={(node) => {
          nodes.set('outer', node);
          setNativeStyleHost(node, outer);
        }}
      >
        <text
          testID="label"
          class="label"
          classList={{ active: active() }}
          data-hover={hover() ? '' : undefined}
          ref={(node) => nodes.set('label', node)}
        >
          Outer
        </text>
        <Inner />
      </view>
    ));
  }
  function View() {
    return (
      <view>
        <Scoped />
        <text testID="unscoped" class="label">
          Unscoped
        </text>
      </view>
    );
  }
  return { View, nodes, outer, inner, setShown, setActive, setInk, setHover };
}
