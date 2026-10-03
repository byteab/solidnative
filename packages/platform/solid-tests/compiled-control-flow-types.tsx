/** @jsxImportSource @solidnative/platform/solid */
import { createSignal } from 'solid-js';
import { ErrorBoundary, Index, Match, Suspense, Switch } from '@solidnative/platform/solid';

/** Solid's remaining control flow, with host children and accessor children, like Show. */
export function NativeControlFlowTypes() {
  const [state] = createSignal<'idle' | 'busy' | { label: string }>('idle');
  return (
    <view>
      <Switch fallback={<text>fallback</text>}>
        <Match when={state() === 'idle'}>
          <text>idle</text>
        </Match>
        <Match when={typeof state() === 'object' && (state() as { label: string })}>
          {(item) => <text>{item().label}</text>}
        </Match>
        <Match when={typeof state() === 'object' && (state() as { label: string })} keyed>
          {(item) => <text>{item.label}</text>}
        </Match>
      </Switch>
      <Index each={['a']}>{(item) => <text>{item()}</text>}</Index>
      <ErrorBoundary fallback={(error: unknown) => <text>{String(error)}</text>}>
        <view />
      </ErrorBoundary>
      <Suspense fallback={<text>loading</text>}>
        <view />
      </Suspense>
      <Match when={{ n: 1 }} keyed>
        {/* @ts-expect-error Match item type comes from when. */}
        {(item: string) => <text>{item}</text>}
      </Match>
    </view>
  );
}
