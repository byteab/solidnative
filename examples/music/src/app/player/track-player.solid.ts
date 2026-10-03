import { createSignal, type Accessor } from 'solid-js';
import { createServiceToken } from '@solid-native/device/solid';
import { audioPlayer, type PlayerState } from '@solid-native/expo/solid/player';

/** The slice of `audioPlayer()`'s player that `Playback` actually drives. */
export interface TrackPlayer {
  readonly state: Accessor<PlayerState>;
  replace(source: number): void;
  play(): void;
  pause(): void;
  seekTo(seconds: number): void;
  setLoop(loop: boolean): void;
}

/**
 * How `Playback` gets a player, so it is not wired to `audioPlayer()` directly.
 *
 * `audioPlayer()` throws when `expo-audio` is not installed rather than handing back a player that
 * quietly does nothing, which is right for a device missing a module but wrong for a test: the
 * Solid tests provide `fakeTrackPlayer` through this token instead of touching `expo-audio`.
 */
export const TRACK_PLAYER = createServiceToken<(initial: number) => TrackPlayer>(
  'TRACK_PLAYER',
  () => fromAudioPlayer,
);

function fromAudioPlayer(initial: number): TrackPlayer {
  const player = audioPlayer(initial, { timeUpdate: 0.5 });
  return {
    state: player.state,
    replace: (source) => player.native.replace(source),
    play: () => player.native.play(),
    pause: () => player.native.pause(),
    seekTo: (seconds) => void player.native.seekTo(seconds),
    setLoop: (loop) => {
      player.native.loop = loop;
    },
  };
}

/**
 * A `TrackPlayer` with no audio behind it, built on a real Solid signal so the memos and effects
 * in `Playback` still see every change - just driven by `play()`/`pause()`/`seekTo()` calls
 * directly rather than by anything a decoder reports.
 */
export function fakeTrackPlayer(_initial: number): TrackPlayer {
  const [state, setState] = createSignal<PlayerState>({
    playing: false,
    status: 'readyToPlay',
    currentTime: 0,
    duration: 8,
    muted: false,
    volume: 1,
    ended: false,
  });
  return {
    state,
    replace: () => setState((s) => ({ ...s, currentTime: 0, ended: false })),
    play: () => setState((s) => ({ ...s, playing: true, ended: false })),
    pause: () => setState((s) => ({ ...s, playing: false })),
    seekTo: (seconds) => setState((s) => ({ ...s, currentTime: seconds })),
    setLoop: () => {},
  };
}
