import { createRenderEffect, untrack } from 'solid-js';
import type { HostNode, NativeSyntheticEvent } from '@solid-native/fabric';
import { Direction, useService } from '@solid-native/device/solid';
import {
  insertHostChildren,
  onHostCleanup,
  spreadHostProps,
  useHostEngine,
} from '@solid-native/platform/solid';
import type { OrientationChangeEvent } from '../events.ts';
import { hostProps, primitiveNode, View } from './primitive.ts';
import { createNativeRef } from './ref.ts';
import type { ViewProps } from './types.ts';

export type ModalPresentationStyle = 'fullScreen' | 'pageSheet' | 'formSheet' | 'overFullScreen';
export type ModalOrientation =
  'portrait' | 'portrait-upside-down' | 'landscape' | 'landscape-left' | 'landscape-right';

export interface ModalProps extends ViewProps {
  visible?: boolean;
  transparent?: boolean;
  backdropColor?: string;
  animationType?: 'none' | 'slide' | 'fade';
  presentationStyle?: ModalPresentationStyle;
  supportedOrientations?: readonly ModalOrientation[];
  allowSwipeDismissal?: boolean;
  statusBarTranslucent?: boolean;
  navigationBarTranslucent?: boolean;
  hardwareAccelerated?: boolean;
  onRequestClose?: (event: NativeSyntheticEvent) => void;
  onShow?: (event: NativeSyntheticEvent) => void;
  onDismiss?: (event: NativeSyntheticEvent) => void;
  onOrientationChange?: (event: OrientationChangeEvent) => void;
}
export function Modal(props: ModalProps): HostNode {
  const node = primitiveNode('modal');
  const direction = useService(Direction);
  createRenderEffect(() => {
    if (
      props.transparent &&
      props.presentationStyle &&
      props.presentationStyle !== 'overFullScreen'
    )
      console.warn(
        `[native-solid] A transparent Modal needs presentationStyle="overFullScreen"; '${props.presentationStyle}' will not be see-through on iOS.`,
      );
    if (props.navigationBarTranslucent && !props.statusBarTranslucent)
      console.warn(
        '[native-solid] Modal navigationBarTranslucent has no effect without statusBarTranslucent.',
      );
  });
  spreadHostProps(
    node,
    () => ({
      ...hostProps(props, {}, ['backdropColor']),
      visible: props.visible ?? true,
      transparent: props.transparent ?? false,
      presentationStyle:
        props.presentationStyle ?? (props.transparent ? 'overFullScreen' : undefined),
    }),
    true,
  );
  const container = untrack(() =>
    View({
      collapsable: false,
      get style() {
        return {
          [direction.rtl() ? 'right' : 'left']: 0,
          top: 0,
          flex: 1,
          backgroundColor: props.transparent ? 'transparent' : (props.backdropColor ?? 'white'),
        };
      },
      get children() {
        return props.children;
      },
    }),
  );
  insertHostChildren(node, container);
  onHostCleanup(
    node,
    useHostEngine().setResponder(node, { onStartShouldSetResponder: () => true }),
  );
  props.ref?.(createNativeRef(node));
  return node;
}
