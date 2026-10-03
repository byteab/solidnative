import { Screen, useService } from '@solid-native/device/solid';
import { claimHost, type HostNode } from '@solid-native/fabric';
import { useHostAdapter, type HostChild } from '@solid-native/platform/solid';
import { registerScreenComponents } from './screens.ts';

export interface FullWindowOverlayProps {
  children?: HostChild;
  /** iOS: keep VoiceOver within the overlay while it is shown. */
  modal?: boolean;
  style?: Record<string, unknown> | readonly unknown[] | null;
  class?: string;
  classList?: Record<string, boolean | undefined>;
  testID?: string;
  id?: string;
  nativeID?: string;
  ref?: (node: HostNode) => void;
}

/**
 * An iOS window above native sheets and modals; a full-window view on Android.
 * Place it last in the root on Android so it draws above its siblings. Empty areas pass touches
 * through. Its dimensions follow the measured app window, including rotation and edge-to-edge.
 */
export function FullWindowOverlay(props: FullWindowOverlayProps): HostNode {
  registerScreenComponents();
  const adapter = useHostAdapter();
  const screen = useService(Screen);
  const node = adapter.createElement('full-window-overlay');
  claimHost(node);
  adapter.spreadProps(
    node,
    () => {
      const { width, height } = screen.window();
      return {
        class: props.class,
        classList: props.classList,
        testID: props.testID,
        nativeID: props.nativeID ?? props.id,
        style: [props.style, { position: 'absolute', top: 0, left: 0, width, height }],
        accessibilityContainerViewIsModal: props.modal ?? false,
        pointerEvents: 'box-none',
      };
    },
    true,
  );
  adapter.insertChildren(node, () => props.children);
  props.ref?.(node);
  return node;
}
