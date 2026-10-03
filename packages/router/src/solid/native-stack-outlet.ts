import { createRenderEffect, onCleanup } from 'solid-js';
import { useHostAdapter } from '@solidnative/platform/solid';
import type { HostNode } from '@solidnative/fabric';
import type { NativeNavigation } from './native-navigation.ts';
import { useRouteOutlet } from './route-context.ts';
import { notifyNativeDismissAttempt } from './native-dismiss.ts';

export interface NativeStackOutletProps {
  /** Captured once. Remount the outlet to install a different navigation. */
  readonly navigation?: NativeNavigation;
  readonly testID?: string;
  readonly style?: Record<string, unknown>;
}

function dismissalCount(event: unknown): number | undefined {
  const payload = (event as { nativeEvent?: { dismissCount?: unknown } })?.nativeEvent;
  const count = payload?.dismissCount;
  return typeof count === 'number' ? count : undefined;
}

/** A direct RNSScreenStack with RNSScreen children, without a React rendering bridge. */
export function NativeStackOutlet(props: NativeStackOutletProps): HostNode {
  const adapter = useHostAdapter();
  const navigation = props.navigation ?? useRouteOutlet();
  if (navigation.kind !== 'stack') throw new Error('NativeStackOutlet requires a stack route.');
  const release = navigation.attachOutlet();
  onCleanup(release);
  const node = adapter.createElement('native-stack-outlet');
  adapter.spreadProps(node, () => ({ style: { flex: 1, ...props.style }, testID: props.testID }));
  // Removing the outgoing native child initiates pop. Its independent route owner remains
  // retained by the transition; completion releases it, cancellation reattaches the same node.
  adapter.insertChildren(node, () => navigation.entries().map((entry) => entry.owner.node));
  createRenderEffect(() => {
    const token = navigation.transition();
    const entries = navigation.entries();
    const events = navigation.nativeEvents(token);
    onCleanup(adapter.engine.setEventListener(node, 'topFinishTransitioning', events.finish));
    for (const entry of entries) {
      const screen = entry.owner.node;
      onCleanup(
        adapter.engine.setEventListener(screen, 'topDismissed', (event) => {
          const count = dismissalCount(event);
          if (count !== undefined) events.dismissed(entry.key, count);
        }),
      );
      onCleanup(
        adapter.engine.setEventListener(screen, 'topGestureCancel', () =>
          events.cancelled(entry.key),
        ),
      );
      onCleanup(
        adapter.engine.setEventListener(screen, 'topNativeDismissCancelled', () => {
          events.cancelled(entry.key);
          if (navigation.current() === entry) notifyNativeDismissAttempt(screen);
        }),
      );
    }
  });
  return node;
}
