import type { NativeSyntheticEvent } from '@solidnative/fabric';
import { createNativeRef, type NativeRef, type ViewProps } from '@solidnative/components/solid';
import { createServiceToken, useService } from '@solidnative/device/solid';
import { expoModule } from '../native.ts';
import { ownedRequests } from './owned.ts';
import { nativeView, viewProps } from './view.ts';
import { viewFunctions, viewTarget } from './g11-features-view.ts';

export interface PictureOptions {
  quality?: number;
  base64?: boolean;
  exif?: boolean;
  additionalExif?: Record<string, unknown>;
  skipProcessing?: boolean;
  scale?: number;
  imageType?: 'png' | 'jpg';
  isImageMirror?: boolean;
  mirror?: boolean;
  id?: number;
  fastMode?: boolean;
  maxDownsampling?: number;
  shutterSound?: boolean;
}
export interface CameraPicture {
  width: number;
  height: number;
  format: 'jpg' | 'png';
  uri: string;
  base64?: string;
  exif?: unknown;
}
export interface CameraViewFunctions {
  takePicture(this: { nativeTag: number }, options: PictureOptions): Promise<CameraPicture>;
}
export interface CameraRef extends NativeRef {
  takePicture(options?: PictureOptions): Promise<CameraPicture | null>;
}
export interface CameraProps extends Omit<ViewProps, 'ref'> {
  ref?: (ref: CameraRef) => void;
  foreground?: () => boolean;
  facing?: 'front' | 'back';
  flashMode?: 'off' | 'on' | 'auto';
  enableTorch?: boolean;
  autoFocus?: 'on' | 'off';
  mute?: boolean;
  zoom?: number;
  active?: boolean;
  mirror?: boolean;
  animateShutter?: boolean;
  pictureSize?: string;
  selectedLens?: string;
  mode?: 'picture' | 'video';
  videoQuality?: '2160p' | '1080p' | '720p' | '480p' | '4:3';
  videoBitrate?: number;
  videoStabilizationMode?: 'off' | 'standard' | 'cinematic' | 'auto';
  ratio?: '4:3' | '16:9' | '1:1';
  poster?: string;
  responsiveOrientationWhenOrientationLocked?: boolean;
  barcodeScannerEnabled?: boolean;
  barcodeScannerSettings?: { barcodeTypes: readonly string[] };
  onCameraReady?: (event: NativeSyntheticEvent<unknown>) => void;
  onMountError?: (event: NativeSyntheticEvent<{ message: string }>) => void;
  onBarcodeScanned?: (
    event: NativeSyntheticEvent<{ type: string; data: string; [key: string]: unknown }>,
  ) => void;
}
const SOURCE = createServiceToken<CameraViewFunctions | null>('expo.camera.source', () =>
  expoModule('expo-camera', () => viewFunctions<CameraViewFunctions>('ExpoCamera')),
);
export const Camera = Object.assign(
  (props: CameraProps) => {
    const functions = useService(SOURCE);
    const requests = ownedRequests();
    const node = nativeView(
      'expo-camera',
      {
        get children() {
          return props.children;
        },
      },
      () => viewProps(props as ViewProps, ['ref', 'foreground']),
    );
    const target = viewTarget(node, props.foreground);
    const ref: CameraRef = {
      ...createNativeRef(node),
      takePicture: (options = {}) =>
        requests.run(null, async (active) => {
          const current = target.capture();
          const nativeTag = target.tag();
          if (!functions || nativeTag === null || !active()) return null;
          try {
            const picture = await functions.takePicture.call({ nativeTag }, options);
            return active() && current() ? picture : null;
          } catch (error) {
            if (!active() || !current()) return null;
            throw error;
          }
        }),
    };
    props.ref?.(ref);
    return node;
  },
  { SOURCE },
);
