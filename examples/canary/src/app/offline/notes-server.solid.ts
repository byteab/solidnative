import { createServiceToken } from '@solid-native/device/solid';

export interface ServerNote {
  readonly id: string;
  readonly text: string;
  readonly version: number;
}

/** A change sent to the server: which change it is, so sending it twice does it once. */
export interface Change {
  readonly op: string;
  readonly kind: 'save' | 'delete';
  readonly id: string;
  readonly text: string;
  /** The server version the change was made on; older than the server's is a conflict. */
  readonly base: number;
}

export type Answer =
  | { readonly ok: true; readonly note: ServerNote | null }
  | { readonly ok: false; readonly conflict: ServerNote };

/** The server, simulated: reachable or not, sometimes failing, and edited from elsewhere. */
export class NotesBackend {
  latency = 300;
  reachable = true;
  /** Fail this many requests with a server error, then answer again. */
  failNext = 0;
  /** Answer, then lose the reply this many times, so the client cannot know it arrived. */
  dropNext = 0;
  received = 0;
  private readonly notes = new Map<string, ServerNote>();
  private readonly applied = new Map<string, Answer>();

  all(): ServerNote[] {
    return [...this.notes.values()];
  }

  send(change: Change): Promise<Answer> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (!this.reachable) return reject(new Error('offline'));
        if (this.failNext > 0) {
          this.failNext--;
          return reject(new Error('500'));
        }
        this.received++;
        const answer = this.applied.get(change.op) ?? this.apply(change);
        this.applied.set(change.op, answer);
        if (this.dropNext > 0) {
          this.dropNext--;
          return reject(new Error('timeout'));
        }
        resolve(answer);
      }, this.latency);
    });
  }

  /** Someone else changes a note on another device. */
  editElsewhere(id: string, text: string): void {
    const note = this.notes.get(id);
    if (note) this.notes.set(id, { ...note, text, version: note.version + 1 });
  }

  private apply(change: Change): Answer {
    const current = this.notes.get(change.id);
    if (current && current.version !== change.base) return { ok: false, conflict: current };
    if (change.kind === 'delete') {
      this.notes.delete(change.id);
      return { ok: true, note: null };
    }
    const note = { id: change.id, text: change.text, version: (current?.version ?? 0) + 1 };
    this.notes.set(change.id, note);
    return { ok: true, note };
  }
}

export type NotesServer = NotesBackend;
export const NotesServer = createServiceToken('canary.notes-server', () => new NotesBackend());
