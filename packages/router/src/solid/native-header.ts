import { createMemo } from 'solid-js';
import { useService, SCREEN_IN_FRONT } from '@solidnative/device/solid';
import { useHostAdapter, type HostChild } from '@solidnative/platform/solid';
import { nativePlatform, type HostNode } from '@solidnative/fabric';
import { useNativeBarDefaults } from './native-bar-defaults.ts';

/** RN Screens header configuration, frozen while its retained screen is covered. */
export interface NativeHeaderProps {
  readonly title?: string;
  readonly titleColor?: string | number;
  readonly titleFontFamily?: string;
  readonly titleFontSize?: number;
  readonly titleFontWeight?: string;
  readonly backgroundColor?: string | number;
  readonly color?: string | number;
  readonly blurEffect?:
    | 'none'
    | 'extraLight'
    | 'light'
    | 'dark'
    | 'regular'
    | 'prominent'
    | 'systemUltraThinMaterial'
    | 'systemThinMaterial'
    | 'systemMaterial'
    | 'systemThickMaterial'
    | 'systemChromeMaterial'
    | 'systemUltraThinMaterialLight'
    | 'systemThinMaterialLight'
    | 'systemMaterialLight'
    | 'systemThickMaterialLight'
    | 'systemChromeMaterialLight'
    | 'systemUltraThinMaterialDark'
    | 'systemThinMaterialDark'
    | 'systemMaterialDark'
    | 'systemThickMaterialDark'
    | 'systemChromeMaterialDark';
  readonly hidden?: boolean;
  readonly hideShadow?: boolean;
  readonly translucent?: boolean;
  readonly largeTitle?: boolean;
  readonly largeTitleColor?: string | number;
  readonly largeTitleBackgroundColor?: string | number;
  readonly largeTitleHideShadow?: boolean;
  readonly largeTitleFontFamily?: string;
  readonly largeTitleFontSize?: number;
  readonly largeTitleFontWeight?: string;
  readonly backTitle?: string;
  readonly backTitleVisible?: boolean;
  readonly backTitleFontFamily?: string;
  readonly backTitleFontSize?: number;
  readonly backButtonInCustomView?: boolean;
  readonly backButtonDisplayMode?: 'minimal' | 'default' | 'generic';
  readonly hideBackButton?: boolean;
  readonly disableBackButtonMenu?: boolean;
  readonly direction?: 'ltr' | 'rtl';
  readonly topInsetEnabled?: boolean;
  readonly consumeTopInset?: boolean;
  readonly consumeLeftInset?: boolean;
  readonly consumeRightInset?: boolean;
  readonly consumeBottomInset?: boolean;
  readonly userInterfaceStyle?: 'unspecified' | 'light' | 'dark';
  readonly testID?: string;
  readonly children?: HostChild;
}

function headerValues(props: NativeHeaderProps): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const key of Object.keys(props))
    if (key !== 'children') values[key] = props[key as keyof NativeHeaderProps];
  return values;
}

function withDefaults(
  props: NativeHeaderProps,
  defaults: NativeHeaderProps,
): Record<string, unknown> {
  const values = { ...defaults } as Record<string, unknown>;
  for (const [key, value] of Object.entries(headerValues(props)))
    if (value !== undefined) values[key] = value;
  return values;
}

export function NativeHeader(props: NativeHeaderProps): HostNode {
  const adapter = useHostAdapter();
  const inFront = useService(SCREEN_IN_FRONT);
  const defaults = useNativeBarDefaults();
  const node = adapter.createElement('native-header');
  // A covered screen keeps its native config (including the previous back title). Apply
  // reactive changes when it returns to the front, not while a different screen owns chrome.
  const configuration = createMemo<Record<string, unknown>>((previous) => {
    if (!inFront() && previous) return previous;
    const values = withDefaults(props, defaults.header());
    const large = nativePlatform() === 'ios' && values['largeTitle'];
    return {
      ...values,
      translucent: values['translucent'] ?? (large ? true : undefined),
      largeTitleHideShadow: values['largeTitleHideShadow'] ?? (large ? true : undefined),
      largeTitleBackgroundColor:
        values['largeTitleBackgroundColor'] ?? (large ? 'transparent' : undefined),
      consumeTopInset: values['consumeTopInset'] ?? nativePlatform() === 'android',
    };
  });
  adapter.spreadProps(node, configuration, true);
  adapter.insertChildren(node, () => props.children);
  return node;
}
