export interface StressRow {
  readonly id: string;
  readonly symbol: string;
  readonly name: string;
  readonly note: string;
  readonly image: string;
}

const WORDS = ['alpha', 'bravo', 'delta', 'echo', 'foxtrot', 'kilo', 'lima', 'nova', 'oscar'];

/** Ten thousand rows of a quote list: a thumbnail, a name, a note of one to four lines. */
export function stressRows(count = 10_000): StressRow[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `s${i}`,
    symbol: `${WORDS[i % WORDS.length]!.slice(0, 3).toUpperCase()}${i}`,
    name: `${WORDS[i % WORDS.length]} ${WORDS[(i * 7) % WORDS.length]} ${i}`,
    note: 'Quarterly results beat the estimate. '.repeat(1 + (i % 4)),
    // Twenty images between them, so a fling is not a download test.
    image: `https://picsum.photos/seed/stress${i % 20}/96/96`,
  }));
}

/** Frame sampling has an epoch so a queued frame from an earlier run cannot restart it. */
export class FrameMonitor {
  private frames = 0;
  private late = 0;
  private worst = 0;
  private last = 0;
  private epoch = 0;
  private frame: number | undefined;
  start(): void {
    this.stop();
    const epoch = ++this.epoch;
    this.frames = this.late = this.worst = 0;
    this.last = performance.now();
    const tick = () => {
      if (epoch !== this.epoch) return;
      const now = performance.now(),
        gap = now - this.last;
      this.last = now;
      this.frames++;
      if (gap > 25) this.late++;
      this.worst = Math.max(this.worst, gap);
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }
  stop(): { frames: number; late: number; worst: number } {
    this.epoch++;
    if (this.frame !== undefined) cancelAnimationFrame(this.frame);
    this.frame = undefined;
    return { frames: this.frames, late: this.late, worst: this.worst };
  }
}
