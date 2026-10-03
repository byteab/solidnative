/** Neutral structural declarations for the installed Expo player handles. */
export interface PlayerSharedObject<
  T extends { [K in keyof T]: (...args: never[]) => void } = Record<never, never>,
> {
  _TEventsMap_DONT_USE_IT?: T;
  addListener<K extends keyof T>(event: K, listener: T[K]): { remove(): void };
  removeListener<K extends keyof T>(event: K, listener: T[K]): void;
  removeAllListeners(event: keyof T): void;
  emit<K extends keyof T>(event: K, ...args: Parameters<T[K]>): void;
  listenerCount<K extends keyof T>(event: K): number;
  startObserving?<K extends keyof T>(event: K): void;
  stopObserving?<K extends keyof T>(event: K): void;
  release(): void;
}
export interface NativeVideoPlayer extends PlayerSharedObject<VideoPlayerEvents> {
  readonly playing: boolean;
  loop: boolean;
  allowsExternalPlayback: boolean;
  audioMixingMode: AudioMixingMode;
  muted: boolean;
  currentTime: number;
  readonly currentLiveTimestamp: number | null;
  readonly currentOffsetFromLive: number | null;
  targetOffsetFromLive: number;
  readonly duration: number;
  volume: number;
  preservesPitch: boolean;
  timeUpdateEventInterval: number;
  playbackRate: number;
  keepScreenOnWhilePlaying: boolean;
  readonly isLive: boolean;
  readonly status: VideoPlayerStatus;
  showNowPlayingNotification: boolean;
  staysActiveInBackground: boolean;
  readonly bufferedPosition: number;
  bufferOptions: BufferOptions;
  subtitleTrack: SubtitleTrack | null;
  audioTrack: AudioTrack | null;
  readonly availableAudioTracks: AudioTrack[];
  readonly availableSubtitleTracks: SubtitleTrack[];
  readonly videoTrack: VideoTrack | null;
  readonly availableVideoTracks: VideoTrack[];
  readonly isExternalPlaybackActive: boolean;
  seekTolerance: SeekTolerance;
  scrubbingModeOptions: ScrubbingModeOptions;
  play(): void;
  pause(): void;
  replace(source: VideoSource, disableWarning?: boolean): void;
  replaceAsync(source: VideoSource): Promise<void>;
  seekBy(seconds: number): void;
  replay(): void;
  generateThumbnailsAsync(
    times: number | number[],
    options?: VideoThumbnailOptions,
  ): Promise<VideoThumbnail[]>;
}
export type VideoThumbnailOptions = {
  maxWidth?: number;
  maxHeight?: number;
};
export type VideoPlayerStatus = 'idle' | 'loading' | 'readyToPlay' | 'error';
export type VideoSource = string | number | null | VideoSourceObject;
export type VideoSourceObject = {
  uri?: string;
  assetId?: number;
  drm?: DRMOptions;
  metadata?: VideoMetadata;
  headers?: Record<string, string>;
  useCaching?: boolean;
  contentType?: ContentType;
};
export type PlayerError = {
  message: string;
};
export type VideoMetadata = {
  title?: string;
  artist?: string;
  artwork?: string;
};
export type DRMType = 'clearkey' | 'fairplay' | 'playready' | 'widevine';
export type DRMOptions = {
  type: DRMType;
  licenseServer: string;
  headers?: Record<string, string>;
  multiKey?: boolean;
  contentId?: string;
  certificateUrl?: string;
  base64CertificateData?: string;
};
export type BufferOptions = {
  readonly preferredForwardBufferDuration?: number;
  readonly waitsToMinimizeStalling?: boolean;
  readonly minBufferForPlayback?: number;
  readonly maxBufferBytes?: number | null;
  readonly prioritizeTimeOverSizeThreshold?: boolean;
};
export type ContentType = 'auto' | 'progressive' | 'hls' | 'dash' | 'smoothStreaming';
export type AudioMixingMode = 'mixWithOthers' | 'duckOthers' | 'auto' | 'doNotMix';
export type SubtitleTrack = {
  id?: string;
  language: string;
  label: string;
  name?: string;
  isDefault?: boolean;
  autoSelect?: boolean;
};
export type VideoTrack = {
  id: string;
  url: string | null;
  size: VideoSize;
  mimeType: string | null;
  isSupported: boolean;
  bitrate: number | null;
  averageBitrate: number | null;
  peakBitrate: number | null;
  frameRate: number | null;
  videoRange: VideoRange;
};
export type VideoSize = {
  width: number;
  height: number;
};
export type AudioTrack = {
  id?: string;
  language: string;
  label: string;
  name?: string;
  isDefault?: boolean;
  autoSelect?: boolean;
};
export type SeekTolerance = {
  toleranceBefore?: number;
  toleranceAfter?: number;
};
export type ScrubbingModeOptions = {
  scrubbingModeEnabled?: boolean;
  increaseCodecOperatingRate?: boolean;
  enableDynamicScheduling?: boolean;
  useDecodeOnlyFlag?: boolean;
  allowSkippingMediaCodecFlush?: boolean;
};
export type PlayerBuilderOptions = {
  seekBackwardIncrement?: number;
  seekForwardIncrement?: number;
};
export type VideoRange = 'sdr' | 'hlg' | 'pq';
export type VideoPlayerEvents = {
  statusChange(payload: StatusChangeEventPayload): void;
  playingChange(payload: PlayingChangeEventPayload): void;
  playbackRateChange(payload: PlaybackRateChangeEventPayload): void;
  volumeChange(payload: VolumeChangeEventPayload): void;
  mutedChange(payload: MutedChangeEventPayload): void;
  playToEnd(): void;
  timeUpdate(payload: TimeUpdateEventPayload): void;
  sourceChange(payload: SourceChangeEventPayload): void;
  availableSubtitleTracksChange(payload: AvailableSubtitleTracksChangeEventPayload): void;
  subtitleTrackChange(payload: SubtitleTrackChangeEventPayload): void;
  availableAudioTracksChange(payload: AvailableAudioTracksChangeEventPayload): void;
  audioTrackChange(payload: AudioTrackChangeEventPayload): void;
  videoTrackChange(payload: VideoTrackChangeEventPayload): void;
  sourceLoad(payload: SourceLoadEventPayload): void;
  isExternalPlaybackActiveChange(payload: IsExternalPlaybackActiveChangeEventPayload): void;
};
export type StatusChangeEventPayload = {
  status: VideoPlayerStatus;
  oldStatus?: VideoPlayerStatus;
  error?: PlayerError;
};
export type PlayingChangeEventPayload = {
  isPlaying: boolean;
  oldIsPlaying?: boolean;
};
export type PlaybackRateChangeEventPayload = {
  playbackRate: number;
  oldPlaybackRate?: number;
};
export type VolumeChangeEventPayload = {
  volume: number;
  oldVolume?: number;
};
export type MutedChangeEventPayload = {
  muted: boolean;
  oldMuted?: boolean;
};
export type SourceChangeEventPayload = {
  source: VideoSource;
  oldSource?: VideoSource;
};
export type TimeUpdateEventPayload = {
  currentTime: number;
  currentLiveTimestamp: number | null;
  currentOffsetFromLive: number | null;
  bufferedPosition: number;
};
export type SubtitleTrackChangeEventPayload = {
  subtitleTrack: SubtitleTrack | null;
  oldSubtitleTrack?: SubtitleTrack | null;
};
export type VideoTrackChangeEventPayload = {
  videoTrack: VideoTrack | null;
  oldVideoTrack?: VideoTrack | null;
};
export type AvailableSubtitleTracksChangeEventPayload = {
  availableSubtitleTracks: SubtitleTrack[];
  oldAvailableSubtitleTracks?: SubtitleTrack[];
};
export type SourceLoadEventPayload = {
  videoSource: VideoSource | null;
  duration: number;
  availableVideoTracks: VideoTrack[];
  availableSubtitleTracks: SubtitleTrack[];
  availableAudioTracks: AudioTrack[];
};
type AudioTrackChangeEventPayload = {
  audioTrack: AudioTrack | null;
  oldAudioTrack?: AudioTrack | null;
};
type AvailableAudioTracksChangeEventPayload = {
  availableAudioTracks: AudioTrack[];
  oldAvailableAudioTracks?: AudioTrack[];
};
export type IsExternalPlaybackActiveChangeEventPayload = {
  isExternalPlaybackActive: boolean;
  oldIsExternalPlaybackActive?: boolean;
};
export interface VideoThumbnail extends PlayerSharedObject {
  nativeRefType: string;
  _TNativeRefType_DONT_USE_IT?: 'image';
  width: number;
  height: number;
  requestedTime: number;
  actualTime: number;
}
export interface NativeAudioPlayer extends PlayerSharedObject<AudioEvents> {
  id: string;
  playing: boolean;
  muted: boolean;
  loop: boolean;
  paused: boolean;
  isLoaded: boolean;
  isAudioSamplingSupported: boolean;
  isBuffering: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playbackRate: number;
  shouldCorrectPitch: boolean;
  currentStatus: AudioStatus;
  play(): void;
  pause(): void;
  replace(source: AudioSource): void;
  seekTo(
    seconds: number,
    toleranceMillisBefore?: number,
    toleranceMillisAfter?: number,
  ): Promise<void>;
  setPlaybackRate(rate: number, pitchCorrectionQuality?: PitchCorrectionQuality): void;
  setAudioSamplingEnabled(enabled: boolean): void;
  setActiveForLockScreen(
    active: boolean,
    metadata?: AudioMetadata,
    options?: AudioLockScreenOptions,
  ): void;
  updateLockScreenMetadata(metadata: AudioMetadata): void;
  clearLockScreenControls(): void;
  remove(): void;
}
export type AudioSample = {
  channels: AudioSampleChannel[];
  timestamp: number;
};
export type AudioSampleChannel = {
  frames: number[];
};
export type AudioEvents = {
  playbackStatusUpdate(status: AudioStatus): void;
  audioSampleUpdate(data: AudioSample): void;
};

export type AudioSource =
  | string
  | number
  | null
  | {
      uri?: string;
      assetId?: number;
      headers?: Record<string, string>;
      name?: string;
    };
export type AudioStatus = {
  id: string;
  currentTime: number;
  playbackState: string;
  timeControlStatus: string;
  reasonForWaitingToPlay: string;
  mute: boolean;
  duration: number;
  playing: boolean;
  loop: boolean;
  didJustFinish: boolean;
  isBuffering: boolean;
  isLoaded: boolean;
  playbackRate: number;
  shouldCorrectPitch: boolean;
  mediaServicesDidReset?: boolean;
  isLive: boolean;
  currentOffsetFromLive: number | null;
  error: string | null;
};
export type AudioMetadata = {
  title?: string;
  artist?: string;
  albumTitle?: string;
  artworkUrl?: string;
};
export type PitchCorrectionQuality = 'low' | 'medium' | 'high';
export type AudioLockScreenOptions = {
  showSeekForward?: boolean;
  showSeekBackward?: boolean;
  isLiveStream?: boolean;
};
