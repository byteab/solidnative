import { createComponent, createContext, useContext } from 'solid-js';
import {
  SafeArea,
  createSafeArea,
  provideService,
  useService,
  withServiceScope,
} from '@solidnative/device/solid';
import type { Insets, SafeAreaMetrics } from '@solidnative/device/solid';
import type { HostNode, NativeSyntheticEvent } from '@solidnative/fabric';
import { insertHostChildren, spreadHostProps } from '@solidnative/platform/solid';
import { registerSafeAreaComponents } from '../safe-area.ts';
import { hostProps, primitiveNode } from './primitive.ts';
import { createNativeRef } from './ref.ts';
import type { ViewProps } from './types.ts';

export interface SafeAreaProviderProps extends ViewProps {
  /**
   * The first provider reports the enclosing scope's SafeArea by default. False creates a
   * local service, as nested providers always do. This ownership choice is captured once;
   * remount the provider to change it.
   */
  reportInsets?: boolean;
  onInsetsChange?: (event: NativeSyntheticEvent<SafeAreaMetrics>) => void;
}

const providerContext = createContext(false);

function insetTokens(insets: Insets) {
  return {
    '--safe-area-inset-top': `${insets.top}px`,
    '--safe-area-inset-right': `${insets.right}px`,
    '--safe-area-inset-bottom': `${insets.bottom}px`,
    '--safe-area-inset-left': `${insets.left}px`,
  };
}

/** Direct native provider; JS services and CSS inset tokens are scoped to its descendants. */
export function SafeAreaProvider(props: SafeAreaProviderProps): HostNode {
  const isolated = useContext(providerContext) || props.reportInsets === false;
  return withServiceScope(
    isolated ? [provideService(SafeArea, () => createSafeArea())] : [],
    () => {
      registerSafeAreaComponents();
      const area = useService(SafeArea);
      const node = primitiveNode('safe-area-provider');
      const onInsetsChange = (event: NativeSyntheticEvent<SafeAreaMetrics>) => {
        const metrics = event.nativeEvent;
        if (metrics?.insets && metrics.frame) area.report(metrics.insets, metrics.frame);
        props.onInsetsChange?.(event);
      };
      spreadHostProps(
        node,
        () => ({
          ...hostProps(props, {}, ['reportInsets', 'onInsetsChange']),
          style: [props.style, insetTokens(area.insets())],
          onInsetsChange,
        }),
        true,
      );
      createComponent(providerContext.Provider, {
        value: true,
        get children() {
          insertHostChildren(node, () => props.children);
          return undefined;
        },
      });
      props.ref?.(createNativeRef(node));
      return node;
    },
  );
}
