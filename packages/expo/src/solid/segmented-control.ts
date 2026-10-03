import type { ViewProps } from '@solid-native/components/solid';
import type { NativeSyntheticEvent, HostNode } from '@solid-native/fabric';
import { registerNativeViews } from '../community-views.ts';
import { nativeView } from './view.ts';
export interface SegmentedControlFont {
  readonly color?: string;
  readonly fontSize?: number;
  readonly fontFamily?: string;
  readonly fontWeight?: string;
}

/** What the control sends when the user picks a segment. */
export type SegmentedControlChangeEvent = NativeSyntheticEvent<{
  readonly value: string;
  readonly selectedSegmentIndex: number;
}>;

export interface SegmentedControlProps extends Omit<ViewProps, 'children'> {
  values?: readonly string[];
  selectedIndex?: number;
  enabled?: boolean;
  momentary?: boolean;
  tintColor?: string;
  backgroundColor?: string;
  fontStyle?: SegmentedControlFont;
  activeFontStyle?: SegmentedControlFont;
  apportionsSegmentWidthsByContent?: boolean;
  onChange?: (event: SegmentedControlChangeEvent) => void;
}
export function SegmentedControl(props: SegmentedControlProps): HostNode {
  registerNativeViews('segmented-control');
  return nativeView('segmented-control', props);
}
