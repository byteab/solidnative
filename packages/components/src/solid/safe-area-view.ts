import type { HostNode } from '@solid-native/fabric';
import { insertHostChildren, spreadHostProps } from '@solid-native/platform/solid';
import { registerSafeAreaComponents, type SafeAreaEdge, type SafeAreaEdges } from '../safe-area.ts';
import { hostProps, primitiveNode } from './primitive.ts';
import { createNativeRef } from './ref.ts';
import type { ViewProps } from './types.ts';

export type { SafeAreaEdge, SafeAreaEdges } from '../safe-area.ts';
export type SafeAreaEdgeMode = 'additive' | 'maximum' | 'off';

export interface SafeAreaViewProps extends ViewProps {
  /** Omitted selects every edge; a partial selection explicitly turns the others off. */
  edges?: SafeAreaEdges;
  mode?: 'padding' | 'margin';
}

const ALL: readonly SafeAreaEdge[] = ['top', 'right', 'bottom', 'left'];

function resolvedEdges(edges: SafeAreaEdges | undefined): Record<SafeAreaEdge, SafeAreaEdgeMode> {
  const given: Readonly<Partial<Record<SafeAreaEdge, SafeAreaEdgeMode>>> = Array.isArray(edges)
    ? Object.fromEntries(edges.map((edge) => [edge, 'additive']))
    : ((edges as Readonly<Partial<Record<SafeAreaEdge, SafeAreaEdgeMode>>> | undefined) ?? {});
  return Object.fromEntries(
    ALL.map((edge) => [edge, edges === undefined ? 'additive' : (given[edge] ?? 'off')]),
  ) as Record<SafeAreaEdge, SafeAreaEdgeMode>;
}

/** Insets are applied by RNCSafeAreaView's native shadow node without a JS layout round trip. */
export function SafeAreaView(props: SafeAreaViewProps): HostNode {
  registerSafeAreaComponents();
  const node = primitiveNode('safe-area-view');
  spreadHostProps(node, () => ({ ...hostProps(props), edges: resolvedEdges(props.edges) }), true);
  insertHostChildren(node, () => props.children);
  props.ref?.(createNativeRef(node));
  return node;
}
