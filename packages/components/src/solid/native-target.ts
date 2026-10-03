import { Engine, type EngineNode, type HostNode, type HostEngine } from '@solidnative/fabric';
import { setNativeStyleHost } from '@solidnative/platform/solid';

/** Native stylesheet defaults sit below the caller's classes and inline styles. */
export function touchableStyleHost(engine: HostEngine, node: HostNode): boolean {
  if (!(engine instanceof Engine)) return false;
  setNativeStyleHost(node as EngineNode, {
    rules: [
      {
        compounds: [{ host: true, classes: [] }],
        combinators: [],
        specificity: 0,
        order: 0,
        declarations: { opacity: 1 },
      },
    ],
  });
  return true;
}

/** Called only after a host commit and attachment check. */
export function nativeTarget(engine: HostEngine, node: HostNode) {
  if (!(engine instanceof Engine) || node.host !== engine)
    throw new Error('Worklets and native gestures require a native Fabric host.');
  const tag = engine.tagOf(node as EngineNode);
  const shadowNode = engine.shadowNodeOf(node as EngineNode);
  return tag === null || shadowNode === null ? undefined : { tag, shadowNode };
}
export function nativeTag(engine: HostEngine, node: HostNode): number | undefined {
  if (!(engine instanceof Engine)) return undefined;
  return nativeTarget(engine, node)?.tag;
}
