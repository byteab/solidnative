import type { ViewProps } from '@solidnative/components/solid';
import type { HostNode } from '@solidnative/fabric';
import { registerExpoViews } from '../register-expo-view.ts';
import { nativeView, viewProps } from './view.ts';

export type AppleButtonType = 'sign-in' | 'continue' | 'sign-up';
export type AppleButtonStyle = 'white' | 'white-outline' | 'black';
const TYPES: Record<AppleButtonType, number> = { 'sign-in': 0, continue: 1, 'sign-up': 2 };
const STYLES: Record<AppleButtonStyle, number> = { white: 0, 'white-outline': 1, black: 2 };
export interface AppleSignInButtonProps extends Omit<ViewProps, 'children'> {
  buttonType?: AppleButtonType;
  buttonStyle?: AppleButtonStyle;
  cornerRadius?: number;
  onButtonPress?: () => void;
}
/** Apple's native button, with the same owned ref and accessibility mapping as other views. */
export function AppleSignInButton(props: AppleSignInButtonProps): HostNode {
  registerExpoViews('apple-sign-in-button');
  return nativeView('apple-sign-in-button', props, () => ({
    ...viewProps(props, ['buttonType', 'buttonStyle']),
    buttonType: TYPES[props.buttonType ?? 'sign-in'],
    buttonStyle: STYLES[props.buttonStyle ?? 'black'],
  }));
}
