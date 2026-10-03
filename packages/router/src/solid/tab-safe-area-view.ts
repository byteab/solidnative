import { claimHost, type HostNode } from '@solidnative/fabric';
import { useHostAdapter, type HostChild } from '@solidnative/platform/solid';
import { registerScreenComponents } from './screens.ts';

/** The edges of the screen. */
export type TabSafeAreaEdge = 'top' | 'right' | 'bottom' | 'left';

const ALL: readonly TabSafeAreaEdge[] = ['top', 'right', 'bottom', 'left'];

export interface TabSafeAreaViewProps {
  children?: HostChild;
  /** Which edges to inset: usually `['bottom']`. Absent insets all four. */
  edges?: readonly TabSafeAreaEdge[];
  style?: Record<string, unknown> | readonly unknown[] | null;
  class?: string;
  classList?: Record<string, boolean | undefined>;
  testID?: string;
  ref?: (node: HostNode) => void;
}

/**
 * react-native-screens' `RNSSafeAreaView`: insets by what the tab screen it is in says is covered,
 * the tab bar included, where `SafeAreaView` only knows the window's own insets. The insets are
 * margin, not padding, so a background that must reach the screen's edge goes on a parent. It has
 * to be inside a tab, or a page of a stack inside one.
 */
export function TabSafeAreaView(props: TabSafeAreaViewProps): HostNode {
  registerScreenComponents();
  const adapter = useHostAdapter();
  const node = adapter.createElement('tab-safe-area-view');
  claimHost(node);
  adapter.spreadProps(
    node,
    () => ({
      class: props.class,
      classList: props.classList,
      style: props.style,
      testID: props.testID,
      // Native takes all four edges every time; a partial record leaves the others as they were.
      edges: Object.fromEntries(ALL.map((edge) => [edge, (props.edges ?? ALL).includes(edge)])),
    }),
    true,
  );
  adapter.insertChildren(node, () => props.children);
  props.ref?.(node);
  return node;
}
