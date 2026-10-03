/** A stand-in for React Native's animated module that records what it is asked to build. */
import type { NativeAnimated } from '@solid-native/fabric';

export function recorder() {
  let next = 1;
  const calls: [string, ...unknown[]][] = [];
  const record =
    (name: string) =>
    (...args: unknown[]) =>
      void calls.push([name, ...args]);
  const native: NativeAnimated = {
    generateNewNodeTag: () => next++,
    API: {
      createAnimatedNode: record('create'),
      connectAnimatedNodes: record('connect'),
      disconnectAnimatedNodes: record('disconnect'),
      connectAnimatedNodeToView: record('toView'),
      disconnectAnimatedNodeFromView: record('fromView'),
      dropAnimatedNode: record('drop'),
      addAnimatedEventToView: record('event'),
      removeAnimatedEventFromView: record('removeEvent'),
      setAnimatedNodeValue: record('set'),
      flushQueue: record('flush'),
    },
  };
  const named = (name: string) => calls.filter((call) => call[0] === name);
  /** The interpolation driving each view still connected, by view tag. */
  const drives = () => {
    const configs = new Map(named('create').map(([, tag, config]) => [tag, config]));
    const parents = new Map<unknown, unknown[]>();
    for (const [, parent, child] of named('connect')) {
      parents.set(child, [...(parents.get(child) ?? []), parent]);
    }
    /** The interpolation up the graph from a node. */
    const interpolationOf = (node: unknown): unknown => {
      if ((configs.get(node) as { type?: string } | undefined)?.type === 'interpolation') {
        return configs.get(node);
      }
      for (const parent of parents.get(node) ?? []) {
        const found = interpolationOf(parent);
        if (found) return found;
      }
      return undefined;
    };
    const live = new Map<unknown, unknown>();
    for (const [name, props, view] of calls) {
      if (name === 'toView') live.set(view, props);
      if (name === 'fromView' && live.get(view) === props) live.delete(view);
    }
    return new Map(
      [...live].map(([view, props]) => [
        view as number,
        interpolationOf(props) as { inputRange: number[] },
      ]),
    );
  };
  return { native, calls, named, drives };
}
