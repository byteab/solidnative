import type { ViewProps } from '@solid-native/components/solid';
import type { HostNode, NativeSyntheticEvent } from '@solid-native/fabric';
import { registerExpoViews } from '../register-expo-view.ts';
import { nativeView, viewProps } from './view.ts';

/** `expo-video`'s fullscreen settings, as its `VideoView` takes them. */
export interface ExpoVideoFullscreenOptions {
  readonly enable?: boolean;
  readonly orientation?:
    | 'default'
    | 'portrait'
    | 'portraitUp'
    | 'portraitDown'
    | 'landscape'
    | 'landscapeLeft'
    | 'landscapeRight';
  readonly autoExitOnRotate?: boolean;
}

/**
 * `expo-video`'s `VideoViewProps`, for the Solid view. `player` is `videoPlayer(...).native` (or
 * its shared-object id): the view is handed the id, as `expo-video`'s own `VideoView` does.
 */
export interface ExpoVideoProps extends Omit<ViewProps, 'children'> {
  player?: { readonly __expo_shared_object_id__?: number } | number | null;
  nativeControls?: boolean;
  contentFit?: 'contain' | 'cover' | 'fill';
  fullscreenOptions?: ExpoVideoFullscreenOptions;
  allowsPictureInPicture?: boolean;
  startsPictureInPictureAutomatically?: boolean;
  requiresLinearPlayback?: boolean;
  /** iOS. */
  showsTimecodes?: boolean;
  /** iOS. */
  allowsVideoFrameAnalysis?: boolean;
  /** Android. */
  contentPosition?: { readonly dx?: number; readonly dy?: number };
  /** Android. */
  useExoShutter?: boolean;
  onFullscreenEnter?: (event: NativeSyntheticEvent<Record<string, unknown>>) => void;
  onFullscreenExit?: (event: NativeSyntheticEvent<Record<string, unknown>>) => void;
  onPictureInPictureStart?: (event: NativeSyntheticEvent<Record<string, unknown>>) => void;
  onPictureInPictureStop?: (event: NativeSyntheticEvent<Record<string, unknown>>) => void;
  onFirstFrameRender?: (event: NativeSyntheticEvent<Record<string, unknown>>) => void;
}

const playerId = (player: ExpoVideoProps['player']) =>
  typeof player === 'number' ? player : (player?.__expo_shared_object_id__ ?? null);

// ponytail: always the SurfaceView-backed `VideoView`; add Android's `surfaceType="textureView"`
// (a separate native view) when an app needs it.
/** The `<expo-video>` view: registers it on first use and renders a player's frames. */
export function ExpoVideo(props: ExpoVideoProps): HostNode {
  registerExpoViews('expo-video');
  return nativeView('expo-video', props, () => ({
    ...viewProps(props),
    player: playerId(props.player),
  }));
}
