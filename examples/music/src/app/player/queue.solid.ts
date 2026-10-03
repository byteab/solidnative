import { createMemo, createSignal } from 'solid-js';
import type { Track } from '../catalogue/catalogue.solid.ts';

export type RepeatMode = 'off' | 'all' | 'one';

/**
 * Track order and position: what "next" and "previous" mean, kept apart from playback itself.
 * `Playback` (playback.solid.ts) points an audio player at whatever the queue is currently on;
 * this knows nothing about audio, which is what makes it a synchronous, no-mocking unit test.
 */
export class Queue {
  private readonly tracks = createSignal<readonly Track[]>([]);
  /** Indices into `tracks`, in play order. Shuffling reorders this, not `tracks` itself. */
  private readonly order = createSignal<readonly number[]>([]);
  private readonly position = createSignal(0);
  private readonly shuffledState = createSignal(false);
  private readonly repeatState = createSignal<RepeatMode>('off');

  readonly shuffled = this.shuffledState[0];
  readonly repeat = this.repeatState[0];

  readonly current = createMemo<Track | undefined>(() => {
    const order = this.order[0]();
    return order.length ? this.tracks[0]()[order[this.position[0]()]!] : undefined;
  });
  readonly upcoming = createMemo<readonly Track[]>(() => {
    const tracks = this.tracks[0]();
    return this.order[0]()
      .slice(this.position[0]() + 1)
      .map((i) => tracks[i]!);
  });
  readonly hasPrevious = createMemo(() => this.position[0]() > 0);
  readonly hasNext = createMemo(
    () => this.repeat() !== 'off' || this.position[0]() < this.order[0]().length - 1,
  );

  /** Replace the queue with a list of tracks, starting at one of them (or the first). */
  load(tracks: readonly Track[], startId?: string): void {
    this.tracks[1](tracks);
    const start = Math.max(0, startId ? tracks.findIndex((t) => t.id === startId) : 0);
    const shuffled = this.shuffled();
    // Shuffling puts the start track first, so position 0 is already correct there; in order,
    // position has to be the start track's own index instead.
    this.order[1](shuffled ? shuffledOrder(tracks.length, start) : tracks.map((_, i) => i));
    this.position[1](shuffled ? 0 : start);
  }

  /** Moves to the next track. Does nothing at the end of an un-repeated queue. */
  next(): void {
    const length = this.order[0]().length;
    if (this.position[0]() < length - 1) this.position[1]((p) => p + 1);
    else if (this.repeat() === 'all' && length) this.position[1](0);
  }

  /** Moves to the previous track, or wraps to the last one when repeating the whole queue. */
  previous(): void {
    const length = this.order[0]().length;
    if (this.position[0]() > 0) this.position[1]((p) => p - 1);
    else if (this.repeat() === 'all' && length) this.position[1](length - 1);
  }

  toggleShuffle(): void {
    const shuffled = !this.shuffled();
    const tracks = this.tracks[0]();
    const currentIndex = tracks.findIndex((t) => t.id === this.current()?.id);
    this.shuffledState[1](shuffled);
    this.order[1](shuffled ? shuffledOrder(tracks.length, currentIndex) : tracks.map((_, i) => i));
    this.position[1](0);
  }

  cycleRepeat(): void {
    const modes: readonly RepeatMode[] = ['off', 'all', 'one'];
    this.repeatState[1](modes[(modes.indexOf(this.repeat()) + 1) % modes.length]!);
  }
}

/** A Fisher-Yates shuffle that keeps `keepFirst` at the front, so the track playing stays put. */
function shuffledOrder(length: number, keepFirst: number): number[] {
  const rest = Array.from({ length }, (_, i) => i).filter((i) => i !== keepFirst);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j]!, rest[i]!];
  }
  return keepFirst >= 0 ? [keepFirst, ...rest] : rest;
}
