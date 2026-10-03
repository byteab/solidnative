import { createSignal, onCleanup, type Accessor } from 'solid-js';
import { expoModule } from '../native.ts';
import { ownedRequests, silence, sourcedService } from './owned.ts';
import { Permission, type PermissionResponse } from './permissions.ts';

// Neutral handles mirror the installed Expo SDK 57 contextual media-library API.
export const MediaType = {
  UNKNOWN: 'unknown',
  IMAGE: 'image',
  AUDIO: 'audio',
  VIDEO: 'video',
} as const;
export type MediaType = (typeof MediaType)[keyof typeof MediaType];

export const AssetField = {
  CREATION_TIME: 'creationTime',
  MODIFICATION_TIME: 'modificationTime',
  MEDIA_TYPE: 'mediaType',
  WIDTH: 'width',
  HEIGHT: 'height',
  DURATION: 'duration',
  IS_FAVORITE: 'isFavorite',
} as const;
export type AssetField = (typeof AssetField)[keyof typeof AssetField];
export type AssetFieldValueMap = {
  [AssetField.CREATION_TIME]: number;
  [AssetField.MODIFICATION_TIME]: number;
  [AssetField.MEDIA_TYPE]: MediaType;
  [AssetField.WIDTH]: number;
  [AssetField.HEIGHT]: number;
  [AssetField.DURATION]: number;
  [AssetField.IS_FAVORITE]: boolean;
};

export const MediaSubtype = {
  DEPTH_EFFECT: 'depthEffect',
  HDR: 'hdr',
  HIGH_FRAME_RATE: 'highFrameRate',
  LIVE_PHOTO: 'livePhoto',
  PANORAMA: 'panorama',
  SCREENSHOT: 'screenshot',
  STREAM: 'stream',
  TIME_LAPSE: 'timelapse',
  SPATIAL_MEDIA: 'spatialMedia',
  VIDEO_CINEMATIC: 'videoCinematic',
} as const;
export type MediaSubtype = (typeof MediaSubtype)[keyof typeof MediaSubtype];

export type Shape = {
  width: number;
  height: number;
};

export type SortDescriptor = {
  key: AssetField;
  ascending?: boolean;
};

export type AssetInfo = {
  id: string;
  filename: string;
  uri: string;
  mediaType: MediaType;
  width: number;
  height: number;
  duration: number | null;
  creationTime: number | null;
  modificationTime: number | null;
  isFavorite: boolean;
};

export type AssetMetadata = {
  id: string;
  filename: string | null;
  mediaType: MediaType;
  width: number | null;
  height: number | null;
  duration: number | null;
  creationTime: number | null;
  modificationTime: number | null;
  isFavorite: boolean;
};

export type AssetLocation = {
  latitude: number;
  longitude: number;
};

export type MediaLibraryAssetsChangeEvent = {
  hasIncrementalChanges: boolean;
  insertedAssets?: string[];
  deletedAssets?: string[];
  updatedAssets?: string[];
};

export interface Asset {
  id: string;
  getCreationTime(): Promise<number | null>;
  getDuration(): Promise<number | null>;
  getFilename(): Promise<string>;
  getHeight(): Promise<number>;
  getMediaType(): Promise<MediaType>;
  getMediaSubtypes(): Promise<MediaSubtype[]>;
  getLivePhotoVideoUri(): Promise<string | null>;
  getIsInCloud(): Promise<boolean>;
  getOrientation(): Promise<number | null>;
  getModificationTime(): Promise<number | null>;
  getShape(): Promise<Shape | null>;
  getUri(): Promise<string>;
  getWidth(): Promise<number>;
  getInfo(): Promise<AssetInfo>;
  getAlbums(): Promise<Album[]>;
  getLocation(): Promise<AssetLocation | null>;
  getExif(): Promise<{
    [key: string]: unknown;
  }>;
  delete(): Promise<void>;
  getFavorite(): Promise<boolean>;
  setFavorite(isFavorite: boolean): Promise<void>;
}

export interface Album {
  id: string;
  getAssets(): Promise<Asset[]>;
  getTitle(): Promise<string>;
  delete(): Promise<void>;
  add(assets: Asset | Asset[]): Promise<void>;
  removeAssets(assets: Asset[]): Promise<void>;
}

export interface Query {
  eq<T extends AssetField>(field: T, value: AssetFieldValueMap[T]): Query;
  within<T extends AssetField>(field: T, value: AssetFieldValueMap[T][]): Query;
  gt(field: AssetField, value: number): Query;
  gte(field: AssetField, value: number): Query;
  lt(field: AssetField, value: number): Query;
  lte(field: AssetField, value: number): Query;
  limit(limit: number): Query;
  offset(offset: number): Query;
  orderBy(sortDescriptors: SortDescriptor | AssetField): Query;
  album(album: Album): Query;
  exe(): Promise<Asset[]>;
  exeForMetadata(): Promise<AssetMetadata[]>;
}

export type GranularPermission = 'audio' | 'photo' | 'video';
export interface NativeMediaLibrary {
  getPermissionsAsync(
    writeOnly?: boolean,
    granularPermissions?: GranularPermission[],
  ): Promise<PermissionResponse>;
  requestPermissionsAsync(
    writeOnly?: boolean,
    granularPermissions?: GranularPermission[],
  ): Promise<PermissionResponse>;
  presentPermissionsPicker(mediaTypes?: ('photo' | 'video')[]): Promise<void>;
  addListener(listener: (event: MediaLibraryAssetsChangeEvent) => void): { remove(): void };
  Asset: {
    new (id: string): Asset;
    create(uri: string, album?: Album): Promise<Asset>;
    delete(assets: Asset[]): Promise<void>;
  };
  Album: {
    new (id: string): Album;
    getAll(): Promise<Album[]>;
    get(title: string): Promise<Album | null>;
    create(name: string, assets: Asset[] | string[], move?: boolean): Promise<Album>;
    delete(albums: Album[], deleteAssets?: boolean): Promise<void>;
  };
  Query: { new (): Query };
}
export interface MediaLibrary {
  readonly permission: Permission;
  readonly writePermission: Permission;
  requestPermission(
    writeOnly?: boolean,
    granularPermissions?: GranularPermission[],
  ): Promise<boolean>;
  presentPermissionsPicker(mediaTypes?: ('photo' | 'video')[]): Promise<void>;
  save(uri: string, album?: Album): Promise<Asset | null>;
  assets(build?: (query: Query) => Query): Promise<Asset[]>;
  metadata(build?: (query: Query) => Query): Promise<AssetMetadata[]>;
  asset(id: string): Asset | null;
  deleteAssets(assets: Asset[]): Promise<void>;
  albums(): Promise<Album[]>;
  album(title: string): Promise<Album | null>;
  createAlbum(name: string, assets: Asset[] | string[], move?: boolean): Promise<Album | null>;
  deleteAlbums(albums: Album[], deleteAssets?: boolean): Promise<void>;
  watch(): Accessor<MediaLibraryAssetsChangeEvent | null>;
}
const UNAVAILABLE: PermissionResponse = { status: 'denied', granted: false, canAskAgain: false };
export const MediaLibrary = sourcedService<MediaLibrary, NativeMediaLibrary | null>(
  'expo.mediaLibrary',
  () => expoModule('expo-media-library', () => require('expo-media-library') as NativeMediaLibrary),
  (native) => {
    const requests = ownedRequests();
    const [changes, setChanges] = createSignal<MediaLibraryAssetsChangeEvent | null>(null);
    let watching = false;
    let subscription: { remove(): void } | undefined;
    onCleanup(() => {
      watching = false;
      silence(() => subscription?.remove());
    });
    const permissionFor = (writeOnly: boolean) =>
      Permission.of(
        () => native?.getPermissionsAsync(writeOnly) ?? Promise.resolve(UNAVAILABLE),
        () => native?.requestPermissionsAsync(writeOnly) ?? Promise.resolve(UNAVAILABLE),
      );
    const permission = permissionFor(false);
    const writePermission = permissionFor(true);
    return {
      permission,
      writePermission,
      requestPermission: (writeOnly, granular) =>
        requests.run(false, async (active) => {
          if (!native) return false;
          await native.requestPermissionsAsync(writeOnly, granular);
          return active() ? permission.check() : false;
        }),
      presentPermissionsPicker: (types) =>
        requests.run(undefined, () => native?.presentPermissionsPicker(types)),
      save: (uri, album) =>
        requests.run<Asset | null>(null, async (active) => {
          if (!native || !(await writePermission.ensure()) || !active()) return null;
          return native.Asset.create(uri, album);
        }),
      assets: (build = (query) => query) =>
        requests.run<Asset[]>([], (active) => {
          if (!native) return [];
          const query = build(new native.Query());
          return active() ? query.exe() : [];
        }),
      metadata: (build = (query) => query) =>
        requests.run<AssetMetadata[]>([], (active) => {
          if (!native) return [];
          const query = build(new native.Query());
          return active() ? query.exeForMetadata() : [];
        }),
      asset: (id) => (requests.active() && native ? new native.Asset(id) : null),
      deleteAssets: (assets) => requests.run(undefined, () => native?.Asset.delete(assets)),
      albums: () => requests.run<Album[]>([], async () => (await native?.Album.getAll()) ?? []),
      album: (title) =>
        requests.run<Album | null>(null, async () => (await native?.Album.get(title)) ?? null),
      createAlbum: (name, assets, move) =>
        requests.run<Album | null>(
          null,
          async () => (await native?.Album.create(name, assets, move)) ?? null,
        ),
      deleteAlbums: (albums, deleteAssets) =>
        requests.run(undefined, () => native?.Album.delete(albums, deleteAssets)),
      watch: () => {
        if (!native || !requests.active() || watching) return changes;
        watching = true;
        try {
          subscription = native.addListener((event) => {
            if (watching && requests.active()) setChanges(event);
          });
          if (!requests.active()) silence(() => subscription?.remove());
        } catch (error) {
          watching = false;
          throw error;
        }
        return changes;
      },
    };
  },
);
