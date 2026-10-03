import { expoModule } from '../native.ts';
import { ownedRequests, sourcedService } from './owned.ts';
import { Permission, type PermissionResponse } from './permissions.ts';

export type PickedAsset = {
  uri: string;
  assetId?: string | null;
  width: number;
  height: number;
  type?: 'image' | 'video' | 'livePhoto' | 'pairedVideo' | null;
  fileName?: string | null;
  fileSize?: number;
  exif?: Record<string, unknown> | null;
  base64?: string | null;
  duration?: number | null;
  mimeType?: string;
  pairedVideoAsset?: PickedAsset | null;
  file?: File;
};
export type CropShape = 'rectangle' | 'oval';
export type PickerOptions = {
  allowsEditing?: boolean;
  aspect?: [number, number];
  shape?: CropShape;
  quality?: number;
  mediaTypes?:
    | ('images' | 'videos' | 'livePhotos')
    | ('images' | 'videos' | 'livePhotos')[]
    | ('All' | 'Videos' | 'Images');
  exif?: boolean;
  base64?: boolean;
  videoExportPreset?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
  videoQuality?: 0 | 1 | 2 | 3 | 4 | 5;
  allowsMultipleSelection?: boolean;
  selectionLimit?: number;
  orderedSelection?: boolean;
  defaultTab?: 'photos' | 'albums';
  videoMaxDuration?: number;
  presentationStyle?:
    | 'fullScreen'
    | 'pageSheet'
    | 'formSheet'
    | 'currentContext'
    | 'overFullScreen'
    | 'overCurrentContext'
    | 'popover'
    | 'automatic';
  cameraType?: 'back' | 'front';
  preferredAssetRepresentationMode?: 'automatic' | 'compatible' | 'current';
  legacy?: boolean;
  shouldDownloadFromNetwork?: boolean;
};

export interface PickerResult {
  readonly canceled: boolean;
  readonly assets: readonly PickedAsset[] | null;
}
export interface NativeImagePicker {
  launchImageLibraryAsync(options?: PickerOptions): Promise<PickerResult>;
  launchCameraAsync(options?: PickerOptions): Promise<PickerResult>;
  getMediaLibraryPermissionsAsync(): Promise<PermissionResponse>;
  requestMediaLibraryPermissionsAsync(): Promise<PermissionResponse>;
  getCameraPermissionsAsync(): Promise<PermissionResponse>;
  requestCameraPermissionsAsync(): Promise<PermissionResponse>;
}
export interface ImagePicker {
  readonly libraryPermission: Permission;
  readonly cameraPermission: Permission;
  pick(options?: PickerOptions): Promise<readonly PickedAsset[]>;
  capture(options?: PickerOptions): Promise<readonly PickedAsset[]>;
}
const UNAVAILABLE: PermissionResponse = { status: 'denied', granted: false, canAskAgain: false };
export const ImagePicker = sourcedService<ImagePicker, NativeImagePicker | null>(
  'expo.imagePicker',
  () => expoModule('expo-image-picker', () => require('expo-image-picker') as NativeImagePicker),
  (native) => {
    const requests = ownedRequests();
    const libraryPermission = Permission.of(
      () => native?.getMediaLibraryPermissionsAsync() ?? Promise.resolve(UNAVAILABLE),
      () => native?.requestMediaLibraryPermissionsAsync() ?? Promise.resolve(UNAVAILABLE),
    );
    const cameraPermission = Permission.of(
      () => native?.getCameraPermissionsAsync() ?? Promise.resolve(UNAVAILABLE),
      () => native?.requestCameraPermissionsAsync() ?? Promise.resolve(UNAVAILABLE),
    );
    return {
      libraryPermission,
      cameraPermission,
      pick: (options) =>
        requests.run<readonly PickedAsset[]>([], async () =>
          assetsOf(await native?.launchImageLibraryAsync(options)),
        ),
      capture: (options) =>
        requests.run<readonly PickedAsset[]>([], async (active) => {
          if (!native || !(await cameraPermission.ensure()) || !active()) return [];
          return assetsOf(await native.launchCameraAsync(options));
        }),
    };
  },
);
function assetsOf(result: PickerResult | undefined): readonly PickedAsset[] {
  return result?.canceled ? [] : (result?.assets ?? []);
}
