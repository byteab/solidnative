/** @jsxImportSource @solidnative/platform/solid */
import { createSignal, onCleanup } from 'solid-js';
import { createStore } from 'solid-js/store';
import { For, Show, onNativeCleanup } from '@solidnative/platform/solid';
import type { EngineNode } from '@solidnative/fabric';

export function createFixture() {
  const [count, setCount] = createSignal(0);
  const [state, setState] = createStore({ label: 'initial', opacity: 0.5 });
  const [visible, setVisible] = createSignal(true);
  const [items, setItems] = createSignal([1, 2, 3]);
  const calls: string[] = [];
  const [touchHandler, setTouchHandler] = createSignal<() => void>(() => {
    calls.push('first');
  });
  const rows = new Map<number, EngineNode>();
  const cleanedRows: number[] = [];
  const cleanups = { root: 0, branch: 0 };
  const responder = {
    onStartShouldSetResponder: () => true,
    onResponderRelease: () => setCount((value) => value + 1),
  };

  function Branch() {
    onCleanup(() => cleanups.branch++);
    return <text testID="branch">Visible {state.label}</text>;
  }

  function View() {
    onCleanup(() => cleanups.root++);
    return (
      <view testID="surface" style={{ width: 100 + count(), opacity: state.opacity }}>
        <view testID="counter" responder={responder} onTouchEnd={touchHandler()}>
          <text testID="label">
            Count <text>{count()}</text> / {state.label}
          </text>
        </view>
        <Show when={visible()} fallback={<text testID="fallback">Hidden</text>}>
          <Branch />
        </Show>
        <view testID="rows">
          <For each={items()} fallback={<text testID="empty">Empty</text>}>
            {(id, index) => (
              <text
                testID={`row-${id}`}
                ref={(node) => {
                  rows.set(id, node);
                  onNativeCleanup(node, () => cleanedRows.push(id));
                }}
              >
                {id}:{index()}
              </text>
            )}
          </For>
        </view>
      </view>
    );
  }

  return {
    View,
    count,
    setCount,
    state,
    setState,
    setVisible,
    setItems,
    setTouchHandler,
    calls,
    rows,
    cleanedRows,
    cleanups,
  };
}

/** Type-only acceptance of native Show accessor/keyed render functions and For fallbacks. */
export function TypedControls(props: { item: { label: string } | undefined }) {
  return (
    <view>
      <Show when={props.item}>{(item) => <text>{item().label}</text>}</Show>
      <Show when={props.item} keyed>
        {(item) => <text>{item.label}</text>}
      </Show>
      <For each={[1, 2]} fallback={<text>None</text>}>
        {(id) => <text>{id}</text>}
      </For>
    </view>
  );
}

export function UnknownIntrinsic() {
  // @ts-expect-error Runtime diagnostics also reject a name outside native intrinsic types.
  return <unknown-native-element />;
}
/** Numeric array children reach universal createTextNode as numbers in Solid 1.9.15. */
export function NumericChildren(props: { value: () => number }) {
  function Label(props: { children?: import('../src/solid.ts').NativeChild }) {
    return <text testID="numeric-label">{props.children}</text>;
  }
  return (
    <view>
      <Label>Count {props.value()}</Label>
      <text testID="numeric-single">{[props.value()]}</text>
      <text testID="numeric-array">{[1, 0, -1]}</text>
      <text testID="numeric-nested">{[[props.value()], [1, -1]]}</text>
    </view>
  );
}
