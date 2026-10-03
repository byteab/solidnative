/** @jsxImportSource @solidnative/platform/solid */
import { createSignal, onCleanup } from 'solid-js';
import { Show } from '@solidnative/platform/solid';
import {
  SafeArea,
  Screen,
  ServiceScope,
  provideService,
  useService,
  type Sizes,
} from '@solidnative/device/solid';
import type { HostNode } from '@solidnative/fabric';
import { FullWindowOverlay } from '../src/solid/full-window-overlay.ts';

export function overlayFixture() {
  const [visible, setVisible] = createSignal(true);
  const [content, setContent] = createSignal(true);
  const [modal, setModal] = createSignal<boolean>();
  const [opacity, setOpacity] = createSignal(0.75);
  const [label, setLabel] = createSignal('Loading');
  const counts = { subscriptions: 0, stops: 0, mounts: 0, cleanups: 0 };
  let listener!: (sizes: Sizes) => void;
  let area!: SafeArea;
  let ref!: HostNode;
  const errors: unknown[] = [];
  const services = [
    provideService(Screen.SOURCE, () => ({
      current: () => ({ window: { width: 390, height: 800 }, screen: { width: 390, height: 844 } }),
      subscribe(callback: typeof listener) {
        counts.subscriptions++;
        listener = callback;
        return () => counts.stops++;
      },
    })),
  ];
  function Toast() {
    counts.mounts++;
    onCleanup(() => counts.cleanups++);
    return <text testID="toast">{label()}</text>;
  }
  function Body() {
    area = useService(SafeArea);
    return (
      <view testID="app">
        <view testID="screen" />
        <Show when={visible()}>
          <FullWindowOverlay
            testID="overlay"
            id="global-overlay"
            class="overlay"
            classList={{ active: modal() }}
            modal={modal()}
            style={{
              opacity: opacity(),
              width: 1,
              height: 1,
              top: 50,
              left: 50,
              position: 'relative',
            }}
            ref={(node) => (ref = node)}
          >
            <Show when={content()}>
              <Toast />
            </Show>
          </FullWindowOverlay>
        </Show>
      </view>
    );
  }
  function Scene() {
    return (
      <ServiceScope services={services} onError={(error) => errors.push(error)}>
        <Body />
      </ServiceScope>
    );
  }
  return {
    Scene,
    counts,
    errors,
    setVisible,
    setContent,
    setModal,
    setOpacity,
    setLabel,
    emit: (sizes: Sizes) => listener(sizes),
    report: (width: number, height: number) =>
      area.report({ top: 0, right: 0, bottom: 0, left: 0 }, { x: 0, y: 0, width, height }),
    ref: () => ref,
  };
}

export function InvalidOverlayModal() {
  // @ts-expect-error Solid boolean props are typed values, not string attributes.
  return <FullWindowOverlay modal="false" />;
}
