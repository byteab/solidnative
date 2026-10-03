import type { HostNode } from '@solidnative/fabric';
import { insertHostChildren, spreadHostProps, useHostEngine } from '@solidnative/platform/solid';
import { hostProps, primitiveNode } from './primitive.ts';
import { createNativeRef } from './ref.ts';
import { installPressBehavior, PRESS_KEYS } from './pressable.ts';
import type { PressableProps } from './types.ts';
import { touchableStyleHost } from './native-target.ts';

export interface TouchableOpacityProps extends PressableProps {
  activeOpacity?: number;
}
/** The host transition clock preserves the native touchable's asymmetric fade timings. */
export function TouchableOpacity(props: TouchableOpacityProps): HostNode {
  const node = primitiveNode('view');
  const nativeStyles = touchableStyleHost(useHostEngine(), node);
  const state = installPressBehavior(node, props);
  spreadHostProps(
    node,
    () => {
      const current = state();
      return {
        ...hostProps(props, { accessible: true, focusable: true, disabled: props.disabled }, [
          ...PRESS_KEYS,
          'activeOpacity',
        ]),
        classList: { ...props.classList, pressed: current.pressed },
        style: [
          nativeStyles ? undefined : { opacity: 1 },
          typeof props.style === 'function' ? props.style(current) : props.style,
          {
            $transition: {
              opacity: {
                duration: current.pressed ? 150 : 250,
                delay: 0,
                easing: [0.42, 0, 0.58, 1],
              },
            },
          },
          current.pressed ? { opacity: props.activeOpacity ?? 0.2 } : undefined,
        ],
      };
    },
    true,
  );
  insertHostChildren(node, () =>
    typeof props.children === 'function' ? props.children(state()) : props.children,
  );
  props.ref?.(createNativeRef(node));
  return node;
}
