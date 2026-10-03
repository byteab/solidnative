import type { TestGesture } from './gesture-handler.ts';
import { nativeState } from './native-internals.ts';
import type { FakeFabricNode } from './test-utils.ts';

/**
 * The gesture attached to a view with `NativeGesture`, or, given a kind, the gesture of that kind in
 * it, however deeply composed: `gestureOf(row, 'Pan').callbacks['onEnd']!(event)`. What a test
 * calls in place of a finger, since there is no native recogniser to drive.
 */
export function gestureOf(node: FakeFabricNode, kind?: string): TestGesture {
  const attached = nativeState.gestures.get(node.reactTag) as TestGesture | undefined;
  if (!attached) throw new Error(`gestureOf: the ${node.viewName} has no gesture attached.`);
  if (kind === undefined) return attached;
  const found = find(attached, kind);
  if (!found) throw new Error(`gestureOf: the ${node.viewName}'s gesture has no ${kind} gesture.`);
  return found;
}

function find(gesture: TestGesture, kind: string): TestGesture | undefined {
  if (gesture.kind === kind) return gesture;
  for (const inner of gesture.gestures) {
    const found = find(inner, kind);
    if (found) return found;
  }
  return undefined;
}
