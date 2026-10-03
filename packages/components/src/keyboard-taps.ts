import type { EngineNode, HostEngine, HostNode } from '@solidnative/fabric';

export type KeyboardShouldPersistTaps = 'always' | 'never' | 'handled';

/**
 * What a tap in a scrolling container does while a text input has the keyboard up, which is
 * `ScrollView.js`'s JavaScript in React Native rather than anything native. `never` (the default):
 * a tap anywhere but on the input is the container's before a child sees it, and all it does is
 * dismiss. `handled`: the child gets first refusal, and the tap dismisses only if nothing took it.
 * `always`: the keyboard stays.
 *
 * Returns the responder's release, for the container's destroy.
 */
export function dismissKeyboardOnTap(
  engine: HostEngine,
  node: HostNode,
  policy: () => KeyboardShouldPersistTaps,
): () => void {
  let dismissing = false;

  /** A keyboard is up for an input, and the tap is not on that input. */
  const tapDismisses = (target: EngineNode): boolean => {
    const focused = engine.focused;
    if (!focused) return false;
    for (let at: EngineNode | null = target; at; at = at.parent) {
      if (at === focused) return false;
    }
    return true;
  };

  // RN's `_observedScrollSinceBecomingResponder`: a touch that scrolled was a drag, and a drag
  // through the content is reading it, so its release leaves the keyboard up.
  const stopScroll = engine.setEventListener(node, 'topScroll', () => {
    dismissing = false;
  });
  const stopResponder = engine.setResponder(node, {
    onStartShouldSetResponderCapture: (_, target) => policy() === 'never' && tapDismisses(target),
    onStartShouldSetResponder: (_, target) => policy() === 'handled' && tapDismisses(target),
    onResponderGrant: () => {
      dismissing = true;
    },
    onResponderRelease: () => {
      if (!dismissing) return;
      dismissing = false;
      const focused = engine.focused;
      if (focused) engine.dispatchCommand(focused, 'blur');
    },
    onResponderTerminate: () => {
      dismissing = false;
    },
  });
  return () => {
    stopScroll();
    stopResponder();
  };
}
