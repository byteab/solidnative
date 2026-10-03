import type * as Background from 'expo-background-task';
import type * as Biometric from 'expo-local-authentication';
import type * as Document from 'expo-document-picker';
import type * as Editor from 'expo-image-manipulator';
import type * as Picker from 'expo-image-picker';
import type * as GPS from 'expo-location';
import type * as Media from 'expo-media-library';
import type * as Notification from 'expo-notifications';
import type * as Capture from 'expo-screen-capture';
import type * as Review from 'expo-store-review';
import type * as Track from 'expo-tracking-transparency';
import type { NativeBackgroundTask } from '../src/solid/background-task.ts';
import type { NativeBiometrics } from '../src/solid/biometrics.ts';
import type { NativeDocumentPicker } from '../src/solid/document-picker.ts';
import type { NativeImageEditor } from '../src/solid/image-editor.ts';
import type { NativeImagePicker } from '../src/solid/image-picker.ts';
import type { NativeLocation } from '../src/solid/location.ts';
import type { NativeMediaLibrary, Asset, Album, Query } from '../src/solid/media-library.ts';
import type { NativeNotifications } from '../src/solid/notifications.ts';
import type { NativeScreenCapture } from '../src/solid/screen-capture.ts';
import type { NativeStoreReview } from '../src/solid/store-review.ts';
import type { NativeTracking } from '../src/solid/tracking.ts';

type Satisfies<T, U extends T> = U;
export type BackgroundContract = Satisfies<NativeBackgroundTask, typeof Background>;
export type BiometricsContract = Satisfies<NativeBiometrics, typeof Biometric>;
export type DocumentContract = Satisfies<NativeDocumentPicker, typeof Document>;
export type EditorContract = Satisfies<NativeImageEditor, typeof Editor>;
export type PickerContract = Satisfies<NativeImagePicker, typeof Picker>;
export type LocationContract = Satisfies<NativeLocation, typeof GPS>;
export type MediaContract = Satisfies<Omit<NativeMediaLibrary, 'Query'>, typeof Media>;
export type NotificationContract = Satisfies<NativeNotifications, typeof Notification>;
export type CaptureContract = Satisfies<NativeScreenCapture, typeof Capture>;
export type ReviewContract = Satisfies<NativeStoreReview, typeof Review>;
export type TrackingContract = Satisfies<NativeTracking, typeof Track>;

export type AssetContract = Satisfies<Asset, Media.Asset>;
export type AlbumContract = Satisfies<Album, Media.Album>;
// Expo uses nominal enum keys in generic query methods. The neutral contract uses the
// exact same string values, while the rest of the handle is structurally checked.
export type QueryContract = Satisfies<Pick<Query, 'exe' | 'exeForMetadata'>, Media.Query>;
export type QueryMethodNames = Satisfies<Record<keyof Query, unknown>, Media.Query>;
export function queryEnumAdapter(query: Media.Query): Query {
  return {
    eq(field, value) {
      query.eq(field as Media.AssetField, value as never);
      return this;
    },
    within(field, values) {
      query.within(field as Media.AssetField, values as never[]);
      return this;
    },
    gt(field, value) {
      query.gt(field as Media.AssetField, value);
      return this;
    },
    gte(field, value) {
      query.gte(field as Media.AssetField, value);
      return this;
    },
    lt(field, value) {
      query.lt(field as Media.AssetField, value);
      return this;
    },
    lte(field, value) {
      query.lte(field as Media.AssetField, value);
      return this;
    },
    orderBy(sort) {
      query.orderBy(sort as Media.AssetField | Media.SortDescriptor);
      return this;
    },
    limit(count) {
      query.limit(count);
      return this;
    },
    offset(count) {
      query.offset(count);
      return this;
    },
    album(album) {
      query.album(album as Media.Album);
      return this;
    },
    exe() {
      return query.exe();
    },
    exeForMetadata() {
      return query.exeForMetadata();
    },
  };
}
