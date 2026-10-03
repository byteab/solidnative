import { createEffect, createMemo, untrack } from 'solid-js';
import { createServiceToken, useService } from '@solid-native/device/solid';
import { KeepAwake } from '@solid-native/expo/solid/keep-awake';
import { TRACKS, type Track } from '../catalogue/catalogue.solid.ts';
import { Queue } from './queue.solid.ts';
import { TRACK_PLAYER, type TrackPlayer } from './track-player.solid.ts';

/**
 * Plays whatever the queue is on: one player, pointed at a new track with `replace()` rather than
 * recreated each time, so the player - and the OS's now-playing session - survives from one track
 * to the next.
 *
 * The queue is a separate class on purpose: it knows track order, this knows how to make a track
 * audible, and neither has to fake the other to be tested.
 */
export class PlaybackModel {
  private readonly queue = new Queue();
  private releaseKeepAwake: (() => void) | null = null;

  private readonly player: TrackPlayer;
  private readonly keepAwake: KeepAwake;

  readonly current = this.queue.current;
  readonly shuffled = this.queue.shuffled;
  readonly repeat = this.queue.repeat;
  readonly hasNext = this.queue.hasNext;
  readonly hasPrevious = this.queue.hasPrevious;
  readonly state: TrackPlayer['state'];
  readonly playing: () => boolean;
  readonly progress: () => number;

  constructor(
    // Created once and pointed at new sources from then on: one player, not one per track.
    player: TrackPlayer = useService(TRACK_PLAYER)(TRACKS[0]!.source),
    keepAwake: KeepAwake = useService(KeepAwake),
  ) {
    this.player = player;
    this.keepAwake = keepAwake;
    this.state = player.state;
    this.playing = createMemo(() => this.state().playing);
    this.progress = createMemo(() => {
      const { currentTime, duration } = this.state();
      return duration > 0 ? currentTime / duration : 0;
    });
    // `loop` is the native player's own repeat-one: letting it replay the track natively is
    // simpler, and smoother, than restarting it by hand from an `ended` event.
    createEffect(() => this.player.setLoop(this.queue.repeat() === 'one'));
    // A track that ends on its own (as opposed to a manual `next()`) advances the queue exactly
    // as pressing next would - unless `loop` is already handling it.
    const ended = createMemo(() => this.state().ended);
    createEffect(() => {
      if (ended() && this.queue.repeat() !== 'one' && this.queue.hasNext())
        untrack(() => {
          this.queue.next();
          this.playCurrent();
        });
    });
  }

  /** Starts the given tracks playing, at `startId` if it names one of them. */
  playQueue(tracks: readonly Track[], startId?: string): void {
    this.queue.load(tracks, startId);
    this.playCurrent();
  }

  toggle(): void {
    if (!this.queue.current()) return;
    if (this.state().playing) this.player.pause();
    else this.player.play();
  }

  next(): void {
    if (!this.queue.hasNext()) return;
    this.queue.next();
    this.playCurrent();
  }

  previous(): void {
    // Within the first couple of seconds, "previous" restarts the track, the way most players do.
    if (this.state().currentTime > 2 || !this.queue.hasPrevious()) {
      this.player.seekTo(0);
      return;
    }
    this.queue.previous();
    this.playCurrent();
  }

  seekTo(seconds: number): void {
    this.player.seekTo(seconds);
  }

  toggleShuffle(): void {
    this.queue.toggleShuffle();
  }

  cycleRepeat(): void {
    this.queue.cycleRepeat();
  }

  private playCurrent(): void {
    const track = this.queue.current();
    if (!track) return;
    this.player.replace(track.source);
    this.player.play();
    // The screen should not sleep while music plays.
    this.releaseKeepAwake?.();
    this.releaseKeepAwake = this.keepAwake.hold('music-playback');
  }
}

export type Playback = PlaybackModel;
export const Playback = createServiceToken('Playback', () => new PlaybackModel());
