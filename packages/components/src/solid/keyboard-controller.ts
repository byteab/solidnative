import {
  createServiceToken,
  provideService,
  withServiceScope,
  type ServiceBinding,
} from '@solidnative/device/solid';
import type { HostChild } from '@solidnative/platform/solid';

/** Whether the app has installed the native keyboard-controller views. No module is loaded. */
export const KEYBOARD_CONTROLLER = createServiceToken('KEYBOARD_CONTROLLER', () => false);

/** Opt in to the direct native keyboard-controller integration within a ServiceScope. */
export function provideKeyboardController(enabled = true): ServiceBinding<boolean> {
  return provideService(KEYBOARD_CONTROLLER, () => enabled);
}

export interface KeyboardControllerProviderProps {
  /** Captured at creation, as native installation cannot change while the app is running. */
  enabled?: boolean;
  children?: HostChild;
}

/** A local opt-in scope with no extra host view and no upstream React provider. */
export function KeyboardControllerProvider(props: KeyboardControllerProviderProps): HostChild {
  return withServiceScope([provideKeyboardController(props.enabled ?? true)], () => props.children);
}
