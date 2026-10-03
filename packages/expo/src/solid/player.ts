import type {
  NativeVideoPlayer,
  NativeAudioPlayer,
  VideoSource,
  AudioSource,
} from './g11-features-player-types.ts';
export type * from './g11-features-player-types.ts';
import { createSignal, getOwner, onCleanup, type Accessor } from 'solid-js';
import { createServiceToken, useService } from '@solid-native/device/solid';
import { expoModule } from '../native.ts';
import { silence } from './owned.ts';

export type PlayerStatus = 'idle' | 'loading' | 'readyToPlay' | 'error';

/** The slice of a player this reads. Both modules' players satisfy it structurally. */
export interface NativePlayer {
  addListener(event: string, listener: (payload: never) => void): { remove(): void };
  release?(): void;
  /** Seconds between `timeUpdate` events. Zero, its default, means the event never fires. `expo-video` only. */
  timeUpdateEventInterval?: number;
  /** Read directly rather than from an event: `expo-audio`'s status carries no volume field. */
  readonly volume?: number;
}

/**
 * `expo-audio`'s one status event, `playbackStatusUpdate`. Unlike `expo-video`, which splits its
 * state across several named events, `AudioPlayer` reports everything - including errors - on a
 * single event, at the interval `updateInterval` was created with.
 */
export interface NativeAudioStatus {
  readonly playing: boolean;
  readonly mute: boolean;
  readonly duration: number;
  readonly currentTime: number;
  readonly isLoaded: boolean;
  readonly didJustFinish: boolean;
  readonly error: string | null;
}

export interface PlayerState {
  readonly playing: boolean;
  readonly status: PlayerStatus;
  /** Seconds. Only moves while `timeUpdateEventInterval` is non-zero. */
  readonly currentTime: number;
  readonly duration: number;
  readonly muted: boolean;
  readonly volume: number;
  /** Set once playback has run to the end, and cleared when it starts again. */
  readonly ended: boolean;
}

const INITIAL: PlayerState = {
  playing: false,
  status: 'idle',
  currentTime: 0,
  duration: 0,
  muted: false,
  volume: 1,
  ended: false,
};

export interface Player<T> {
  readonly native: T;
  readonly state: Accessor<PlayerState>;
  stop(): void;
}
export interface VideoPlayerSource {
  create(source: VideoSource): NativeVideoPlayer;
}
export interface AudioPlayerSource {
  create(source: AudioSource, options: { updateInterval?: number }): NativeAudioPlayer;
}

function watch(
  player: NativePlayer | null,
  setup: (
    listen: <T>(name: string, listener: (event: T) => void) => void,
    patch: (value: Partial<PlayerState>) => void,
    active: () => boolean,
  ) => void,
) {
  const [state, setState] = createSignal<PlayerState>({ ...INITIAL });
  let active = true;
  const subscriptions = new Set<() => void>();
  const stop = () => {
    if (!active) return;
    active = false;
    for (const remove of subscriptions) silence(remove);
    subscriptions.clear();
    if (player) silence(() => player.release?.());
  };
  if (getOwner()) onCleanup(stop);
  if (player) {
    const listen = <T>(name: string, listener: (event: T) => void) => {
      if (!active) return;
      const subscription = player.addListener(name, (event: T) => {
        if (active) listener(event);
      });
      const remove = () => subscription.remove();
      if (active) subscriptions.add(remove);
      else silence(remove);
    };
    try {
      setup(
        listen,
        (change) => {
          if (active) setState((last) => ({ ...last, ...change }));
        },
        () => active,
      );
    } catch (error) {
      stop();
      throw error;
    }
  }
  return { state, stop };
}
export function watchPlayer(
  player: NativePlayer | null,
  options: { timeUpdate?: number } = {},
): { state: Accessor<PlayerState>; stop(): void } {
  return watch(player, (listen, patch, active) => {
    listen('statusChange', ({ status }: { status: PlayerStatus }) => patch({ status }));
    listen('playingChange', ({ isPlaying }: { isPlaying: boolean }) =>
      patch({ playing: isPlaying, ...(isPlaying ? { ended: false } : {}) }),
    );
    listen('mutedChange', ({ muted }: { muted: boolean }) => patch({ muted }));
    listen('volumeChange', ({ volume }: { volume: number }) => patch({ volume }));
    listen('playToEnd', () => patch({ ended: true, playing: false }));
    listen('timeUpdate', ({ currentTime }: { currentTime: number }) => patch({ currentTime }));
    listen('sourceChange', () => patch({ ...INITIAL, status: 'loading' }));
    listen('sourceLoad', ({ duration }: { duration: number }) => patch({ duration }));
    if (active() && player && options.timeUpdate !== undefined)
      player.timeUpdateEventInterval = options.timeUpdate;
  });
}
const VIDEO = createServiceToken<VideoPlayerSource | null>('expo.videoPlayer.source', () => {
  const expo = expoModule(
    'expo-video',
    () => require('expo-video') as typeof import('expo-video'),
    ['ios', 'android', 'web'],
  );
  return expo
    ? {
        create: (source) =>
          expo.createVideoPlayer(
            source as Parameters<typeof expo.createVideoPlayer>[0],
          ) as NativeVideoPlayer,
      }
    : null;
});
const AUDIO = createServiceToken<AudioPlayerSource | null>('expo.audioPlayer.source', () => {
  const expo = expoModule(
    'expo-audio',
    () => require('expo-audio') as typeof import('expo-audio'),
    ['ios', 'android', 'web'],
  );
  return expo
    ? { create: (source, options) => expo.createAudioPlayer(source, options) as NativeAudioPlayer }
    : null;
});
function own<T extends NativePlayer>(
  module: string,
  source: (() => T) | null,
  setup: (native: T) => { state: Accessor<PlayerState>; stop(): void },
): Player<T> {
  if (!getOwner()) throw new Error('Players require an active Solid owner.');
  if (!source) throw new Error(`[solid-native] ${module} is not installed`);
  let active = true;
  onCleanup(() => {
    active = false;
  });
  const native = source();
  if (!active) {
    silence(() => native.release?.());
    throw new Error('Player owner was disposed during acquisition.');
  }
  return { native, ...setup(native) };
}
export const videoPlayer = Object.assign(
  (source: VideoSource, options: { timeUpdate?: number } = {}): Player<NativeVideoPlayer> => {
    const factory = useService(VIDEO);
    return own('expo-video', factory ? () => factory.create(source) : null, (native) =>
      watchPlayer(native, options),
    );
  },
  { SOURCE: VIDEO },
);
export const audioPlayer = Object.assign(
  (source: AudioSource, options: { timeUpdate?: number } = {}): Player<NativeAudioPlayer> => {
    const factory = useService(AUDIO);
    return own(
      'expo-audio',
      factory
        ? () =>
            factory.create(source, {
              updateInterval:
                options.timeUpdate === undefined ? undefined : options.timeUpdate * 1000,
            })
        : null,
      (native) =>
        watch(native, (listen, patch) => {
          listen('playbackStatusUpdate', (status: NativeAudioStatus) =>
            patch({
              playing: status.playing,
              status: status.error !== null ? 'error' : status.isLoaded ? 'readyToPlay' : 'loading',
              currentTime: status.currentTime,
              duration: status.duration,
              muted: status.mute,
              volume: native.volume ?? 1,
              ended: status.didJustFinish,
            }),
          );
        }),
    );
  },
  { SOURCE: AUDIO },
);
