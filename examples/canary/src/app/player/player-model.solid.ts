import {
  createEffect,
  createMemo,
  createSignal,
  getOwner,
  onCleanup,
  untrack,
  type Accessor,
} from 'solid-js';
import { createServiceToken, useService } from '@solid-native/device/solid';
import { audioPlayer, type PlayerState } from '@solid-native/expo/solid/player';

export interface Track {
  readonly id: string;
  readonly title: string;
  readonly artist: string;
  /** The artwork's colour: the app draws its own covers. */
  readonly colour: string;
  readonly source: number;
}

const SOURCES = [
  require('./assets/tone-a.wav') as number,
  require('./assets/tone-b.wav') as number,
  require('./assets/tone-c.wav') as number,
];

export const TRACKS: readonly Track[] = [
  ['So What', 'Miles Davis', '#1d4ed8'],
  ['Naima', 'John Coltrane', '#b45309'],
  ['Blue in Green', 'Bill Evans', '#0f766e'],
  ['Feeling Good', 'Nina Simone', '#be123c'],
  ['Summertime', 'Ella Fitzgerald', '#7c3aed'],
  ['Take Five', 'Dave Brubeck', '#15803d'],
  ['Round Midnight', 'Thelonious Monk', '#334155'],
  ['Moanin', 'Art Blakey', '#c2410c'],
].map(([title, artist, colour], i) => ({
  id: `t${i + 1}`,
  title: title!,
  artist: artist!,
  colour: colour!,
  source: SOURCES[i % SOURCES.length]!,
}));

/** m:ss, as a player shows elapsed and remaining time. */
export function clock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/** Where a drag across the scrubber lands, as seconds into the track, clamped to its length. */
export function seekTarget(x: number, width: number, duration: number): number {
  if (width <= 0 || duration <= 0) return 0;
  return Math.min(duration, Math.max(0, (x / width) * duration));
}

/** The next index in the queue: in order, or wrapping round with repeat. Null at the end. */
export function nextIndex(index: number, length: number, repeat: boolean): number | null {
  if (index + 1 < length) return index + 1;
  return repeat ? 0 : null;
}

/** Previous: to the start of this track when it is more than a few seconds in, as players do. */
export function previousIndex(index: number, elapsed: number): number {
  return elapsed > 3 || index === 0 ? index : index - 1;
}

/** The slice of `audioPlayer()` the app drives. */
export interface TrackPlayer {
  readonly state: Accessor<PlayerState>;
  replace(source: number): void;
  play(): void;
  pause(): void;
  seekTo(seconds: number): void;
  setVolume(volume: number): void;
  stop?(): void;
}

export const TRACK_PLAYER = createServiceToken<(initial: number) => TrackPlayer>(
  'TRACK_PLAYER',
  () => (initial) => {
    const player = audioPlayer(initial, { timeUpdate: 0.25 });
    return {
      state: player.state,
      replace: (source) => player.native.replace(source),
      play: () => player.native.play(),
      pause: () => player.native.pause(),
      seekTo: (seconds) => {
        void player.native.seekTo(seconds);
      },
      setVolume: (volume) => {
        player.native.volume = volume;
      },
      stop: () => player.stop(),
    };
  },
);
export class PlaybackModel {
  private readonly indexState = createSignal<number | null>(null);
  readonly index = this.indexState[0];
  private readonly repeatState = createSignal(false);
  readonly repeat = this.repeatState[0];
  readonly setRepeat = this.repeatState[1];
  private readonly volumeState = createSignal(1);
  readonly volume = this.volumeState[0];
  readonly track = createMemo(() => (this.index() === null ? null : TRACKS[this.index()!]!));
  readonly state: Accessor<PlayerState>;
  readonly playing: Accessor<boolean>;
  private active = true;
  private epoch = 0;
  private readonly player: TrackPlayer;
  constructor(player: TrackPlayer = useService(TRACK_PLAYER)(TRACKS[0]!.source)) {
    this.player = player;
    this.state = player.state;
    this.playing = createMemo(() => this.state().playing);
    if (getOwner())
      onCleanup(() => {
        this.active = false;
        this.epoch++;
        player.stop?.();
      });
    const ended = createMemo(() => this.state().ended);
    createEffect(() => {
      if (ended()) untrack(() => this.next());
    });
  }
  playTrack(index: number): void {
    if (!this.active || !Number.isInteger(index) || !TRACKS[index]) return;
    const request = ++this.epoch;
    this.indexState[1](index);
    if (!this.active || request !== this.epoch) return;
    this.player.replace(TRACKS[index]!.source);
    if (this.active && request === this.epoch) this.player.play();
  }
  toggle(): void {
    if (!this.active) return;
    if (this.index() === null) return this.playTrack(0);
    this.epoch++;
    if (this.playing()) this.player.pause();
    else this.player.play();
  }
  next(): void {
    const index = this.index();
    if (!this.active || index === null) return;
    const next = nextIndex(index, TRACKS.length, this.repeat());
    if (next === null) {
      this.epoch++;
      this.player.pause();
    } else this.playTrack(next);
  }
  previous(): void {
    const index = this.index();
    if (!this.active || index === null) return;
    const previous = previousIndex(index, this.state().currentTime);
    if (previous === index) this.seek(0);
    else this.playTrack(previous);
  }
  seek(seconds: number): void {
    if (this.active) this.player.seekTo(seconds);
  }
  setVolume(volume: number): void {
    if (!this.active) return;
    const request = ++this.epoch;
    this.volumeState[1](volume);
    if (this.active && request === this.epoch) this.player.setVolume(volume);
  }
}
export type Playback = PlaybackModel;
export const Playback = createServiceToken('Playback', () => new PlaybackModel());
