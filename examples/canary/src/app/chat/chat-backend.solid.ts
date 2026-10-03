import { createServiceToken, useService } from '@solidnative/device/solid';

export interface ChatMessage {
  readonly id: string;
  readonly from: 'me' | 'sam';
  readonly text: string;
  /** Width over height of an attached picture, or undefined for text alone. */
  readonly image?: { readonly uri: string; readonly aspect: number };
  readonly sentAt: number;
  readonly state: 'sending' | 'sent' | 'failed';
}

export interface HistoryPage {
  /** Newest first, as the transcript holds them. */
  readonly messages: readonly ChatMessage[];
  readonly before: number | null;
}

const LINES = [
  'Are we still on for tomorrow?',
  'Yes! Ten o clock at the usual place.',
  'I found the photos from the trip, sending a few.',
  'That one is brilliant. The light over the water is exactly how I remember it.',
  'Can you bring the charger back? I need it for the weekend and the spare one stopped working, which is a long story involving a dog.',
  'ok',
  'Running five minutes late, sorry',
  'No rush.',
  'Did you see the match last night? Absolutely ridiculous finish, I still cannot believe the keeper came up for the corner and scored.',
  'Ha',
];

/** The conversation with Sam, simulated: a long history, replies, typing, and failures. */
export class ChatBackendSource {
  latency = 350;
  /** Every send fails while set, as it would with no signal. */
  offline = false;
  /** How many messages the history holds before the first one. */
  readonly historyLength = 3000;
  private readonly start = Date.UTC(2026, 0, 1);

  /** A page of history older than message `before` (a message number), newest first. */
  history(before: number | null, size = 40): Promise<HistoryPage> {
    return this.respond(() => {
      const from = before ?? this.historyLength;
      const messages: ChatMessage[] = [];
      for (let n = from - 1; n >= Math.max(0, from - size); n--) messages.push(this.historic(n));
      return { messages, before: from - size > 0 ? from - size : null };
    });
  }

  /** Deliver a message; resolves with what the server stored, rejects when it could not. */
  send(message: ChatMessage): Promise<ChatMessage> {
    const fail = this.offline;
    return this.respond(() => {
      if (fail) throw new Error('Not delivered');
      return { ...message, state: 'sent' as const };
    });
  }

  historic(n: number): ChatMessage {
    const text = LINES[(n * 7) % LINES.length]!;
    return {
      id: `h${n}`,
      from: n % 3 === 0 ? 'me' : 'sam',
      text,
      image:
        n % 11 === 0
          ? { uri: `https://picsum.photos/seed/chat${n}/500/400`, aspect: [1.25, 0.8, 1.5][n % 3]! }
          : undefined,
      sentAt: this.start + n * 60_000,
      state: 'sent',
    };
  }

  /** A reply from Sam. */
  reply(n: number): ChatMessage {
    return {
      id: `r${n}-${Date.now()}`,
      from: 'sam',
      text: LINES[(n * 3 + 1) % LINES.length]!,
      sentAt: Date.now(),
      state: 'sent',
    };
  }

  private respond<T>(answer: () => T): Promise<T> {
    return new Promise((resolve, reject) => {
      const settle = () => {
        try {
          resolve(answer());
        } catch (error) {
          reject(error);
        }
      };
      if (this.latency === 0) queueMicrotask(settle);
      else setTimeout(settle, this.latency);
    });
  }
}

/** Lazy scoped source seam; importing the data never loads a framework/native module. */
export type ChatBackend = Pick<ChatBackendSource, keyof ChatBackendSource>;
const source = createServiceToken<ChatBackend>('ChatBackend.source', () => new ChatBackendSource());
export const ChatBackend = Object.freeze({
  ...createServiceToken<ChatBackend>('ChatBackend', () => useService(source)),
  SOURCE: source,
});
