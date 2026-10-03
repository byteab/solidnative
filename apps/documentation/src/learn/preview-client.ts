/**
 * The lesson page's half of `protocol.ts`: sends work to the preview frame and resolves each
 * request with the frame's answer.
 *
 * The frame is reloaded to change platform, and a request made while it loads waits for it. It is
 * reloaded as well if it stops answering: the frame says it is alive every second, from its own
 * event loop, so a frame that goes quiet while there is work outstanding is stuck, not busy. The
 * loop guard stops a runaway loop in the learner's own code; this is for anything that gets past
 * it. A slow request on its own, such as the native CSS compiler downloading, is not a reason.
 */
import type {
  Appearance,
  CheckOutcome,
  Files,
  FromPreview,
  Platform,
  Problem,
  RunTimings,
  TestOutcome,
  ToPreview,
} from './protocol.ts';

export interface RunResult {
  readonly ok: boolean;
  readonly problems: readonly Problem[];
  readonly timings?: RunTimings;
}

export interface PreviewEvents {
  /** A problem after a run: a press handler threw, or the app logged an error. */
  problem(problem: Problem): void;
  /** What a device would say about the last run that a browser does not. */
  notes(notes: readonly Problem[]): void;
  /** The frame was reloaded, and the app on it is gone until the next run. */
  reloaded(): void;
}

type Pending = { resolve(message: FromPreview): void; reject(error: Error): void };

const PREVIEW_URL = '/learn-preview.html';

export class PreviewClient {
  private readonly frame: HTMLIFrameElement;
  private readonly events: PreviewEvents;
  private readonly pending = new Map<number, Pending>();
  private ready: Promise<void>;
  private markReady: () => void = () => {};
  private nextId = 1;
  private platform: Platform;
  private appearance: Appearance = { scheme: 'light', xray: false };
  private readonly silenceMs: number;
  private lastHeard = Date.now();
  private readonly watchdog: number;
  private readonly listener = (event: MessageEvent<FromPreview>) => this.receive(event);

  constructor(
    frame: HTMLIFrameElement,
    platform: Platform,
    events: PreviewEvents,
    silenceMs = 6000,
  ) {
    this.frame = frame;
    this.events = events;
    this.platform = platform;
    this.silenceMs = silenceMs;
    addEventListener('message', this.listener);
    this.ready = this.load();
    this.watchdog = window.setInterval(() => this.checkAlive(), 1000);
  }

  destroy(): void {
    removeEventListener('message', this.listener);
    clearInterval(this.watchdog);
    this.pending.clear();
  }

  /** Reload the frame on another platform. The next `run` puts the app back. */
  setPlatform(platform: Platform): Promise<void> {
    if (platform === this.platform) return this.ready;
    this.platform = platform;
    this.ready = this.load();
    return this.ready;
  }

  setAppearance(appearance: Appearance): void {
    this.appearance = appearance;
    void this.ready.then(() => this.post({ type: 'appearance', appearance }));
  }

  async run(files: Files, entry: string, baseline?: Files): Promise<RunResult> {
    const answer = await this.request((id) => ({ type: 'run', id, files, entry, baseline }));
    return answer.type === 'ran' ? answer : { ok: false, problems: [] };
  }

  async test(files: Files, file: string): Promise<readonly TestOutcome[]> {
    const answer = await this.request((id) => ({ type: 'test', id, files, file }));
    return answer.type === 'tested' ? answer.outcomes : [];
  }

  async check(files: Files, checks: string, step: number): Promise<readonly CheckOutcome[]> {
    const answer = await this.request((id) => ({ type: 'check', id, files, checks, step }));
    return answer.type === 'checked' ? answer.outcomes : [];
  }

  private load(): Promise<void> {
    this.rejectAll(new Error('The preview was reloaded.'));
    this.lastHeard = Date.now();
    const ready = new Promise<void>((resolve) => (this.markReady = resolve));
    this.frame.src = `${PREVIEW_URL}?platform=${this.platform}`;
    return ready.then(() => {
      this.post({ type: 'appearance', appearance: this.appearance });
      this.events.reloaded();
    });
  }

  private async request(make: (id: number) => ToPreview): Promise<FromPreview> {
    await this.ready;
    const id = this.nextId++;
    return new Promise<FromPreview>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.post(make(id));
    });
  }

  /** Reload a frame that has work outstanding and has said nothing for too long. */
  private checkAlive(): void {
    if (!this.pending.size || Date.now() - this.lastHeard < this.silenceMs) return;
    this.rejectAll(new Error('The preview stopped answering, so it was restarted.'));
    this.ready = this.load();
  }

  private rejectAll(error: Error): void {
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
  }

  /** To the frame's window, whatever it holds: its origin is opaque, so there is none to name. */
  private post(message: ToPreview): void {
    this.frame.contentWindow?.postMessage(message, '*');
  }

  private receive(event: MessageEvent<FromPreview>): void {
    // Every sandboxed frame's origin serialises as 'null', so the window has to match as well.
    if (event.source !== this.frame.contentWindow || event.origin !== 'null') return;
    const message = event.data;
    this.lastHeard = Date.now();
    if (message.type === 'alive') return;
    if (message.type === 'ready') this.markReady();
    else if (message.type === 'problem') this.events.problem(message.problem);
    else if (message.type === 'notes') this.events.notes(message.notes);
    else this.settle(message.id, message);
  }

  private settle(id: number, message: FromPreview): void {
    const pending = this.pending.get(id);
    if (!pending) return;
    this.pending.delete(id);
    pending.resolve(message);
  }
}
