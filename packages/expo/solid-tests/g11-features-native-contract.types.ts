import type * as Camera from 'expo-camera';
import type * as SQLite from 'expo-sqlite';
import type * as Video from 'expo-video';
import type * as Audio from 'expo-audio';
import type * as LLM from 'expo-local-llm';
import type * as Maps from 'expo-maps';
import type { PictureOptions, CameraPicture, CameraViewFunctions } from '../src/solid/camera.ts';
import type { SQLiteDatabase } from '../src/solid/database.ts';
import type {
  NativeVideoPlayer,
  NativeAudioPlayer,
  VideoSource,
  AudioSource,
} from '../src/solid/player.ts';
import type {
  LanguageModelSchema,
  LanguageModelSessionConfig,
} from '../src/solid/language-model.ts';
import type {
  MapCoordinates,
  MapMarker,
  MapCameraPosition,
  MapUiSettings,
} from '../src/solid/map-view.ts';
type Satisfies<T, U extends T> = U;
export type Picture = Satisfies<CameraPicture, Camera.CameraCapturedPicture>;
export type PictureInput = Satisfies<
  PictureOptions,
  Omit<Camera.CameraPictureOptions, 'onPictureSaved' | 'pictureRef'>
>;
export type PictureFunctions = Satisfies<
  CameraViewFunctions,
  Pick<Camera.CameraViewRef, 'takePicture'>
>;
export type Database = Satisfies<SQLiteDatabase, SQLite.SQLiteDatabase>;
export type VideoPlayer = Satisfies<NativeVideoPlayer, Video.VideoPlayer>;
export type AudioPlayer = Satisfies<NativeAudioPlayer, Audio.AudioPlayer>;
export type VideoInput = Satisfies<VideoSource, Video.VideoSource>;
export type AudioInput = Satisfies<AudioSource, Audio.AudioSource>;
export type Schema = Satisfies<LanguageModelSchema, LLM.Schema>;
export type Config = Satisfies<LLM.SessionConfig, LanguageModelSessionConfig>;
export type Coordinates = Satisfies<MapCoordinates, Maps.Coordinates>;
export type Position = Satisfies<MapCameraPosition, Maps.CameraPosition>;
export type AppleMarker = Satisfies<MapMarker, Maps.AppleMaps.Marker>;
export type GoogleMarker = Satisfies<MapMarker, Omit<Maps.GoogleMaps.Marker, 'icon'>>;
export type UiSettings = Satisfies<
  MapUiSettings,
  Maps.AppleMaps.MapUISettings & Maps.GoogleMaps.MapUISettings
>;

// Check both assignability and retained public keys: broad output types must not hide native APIs.
type Complete<T extends never> = T;
export type VideoKeys = Complete<Exclude<keyof Video.VideoPlayer, keyof NativeVideoPlayer>>;
export type AudioKeys = Complete<Exclude<keyof Audio.AudioPlayer, keyof NativeAudioPlayer>>;
export type VideoTrackKeys = Complete<
  Exclude<
    keyof NonNullable<Video.VideoPlayer['videoTrack']>,
    keyof NonNullable<NativeVideoPlayer['videoTrack']>
  >
>;
export type AudioStatusKeys = Complete<
  Exclude<keyof Audio.AudioPlayer['currentStatus'], keyof NativeAudioPlayer['currentStatus']>
>;
export type DatabaseKeys = Complete<Exclude<keyof SQLite.SQLiteDatabase, keyof SQLiteDatabase>>;
export type OpenOptionsKeys = Complete<
  Exclude<keyof SQLite.SQLiteDatabase['options'], keyof SQLiteDatabase['options']>
>;
export type NativeDatabaseKeys = Complete<
  Exclude<keyof SQLite.SQLiteDatabase['nativeDatabase'], keyof SQLiteDatabase['nativeDatabase']>
>;
