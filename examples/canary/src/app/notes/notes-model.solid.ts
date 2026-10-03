import { createSignal } from 'solid-js';
import { createServiceToken } from '@solid-native/device/solid';

export type BlockKind = 'paragraph' | 'heading' | 'bullet' | 'check' | 'quote';

export interface Block {
  readonly id: string;
  readonly kind: BlockKind;
  readonly text: string;
  readonly done?: boolean;
}

export interface Note {
  readonly id: string;
  readonly title: string;
  readonly blocks: readonly Block[];
  readonly edited: number;
}

/** A run of text with the marks around it: what reading mode draws as nested text. */
export interface Span {
  readonly text: string;
  readonly bold?: boolean;
  readonly italic?: boolean;
  readonly code?: boolean;
  readonly strike?: boolean;
}

/** What typing at the start of a block turns it into, as Markdown writes each. */
const SHORTCUTS: readonly [RegExp, BlockKind, boolean?][] = [
  [/^# /, 'heading'],
  [/^[-*] /, 'bullet'],
  [/^\[ ?\] /, 'check'],
  [/^\[x\] /i, 'check', true],
  [/^> /, 'quote'],
];

/** A paragraph whose text starts with a shortcut, as the block it asks for; null otherwise. */
export function shortcut(text: string): { kind: BlockKind; text: string; done?: boolean } | null {
  for (const [pattern, kind, done] of SHORTCUTS) {
    if (pattern.test(text))
      return { kind, text: text.replace(pattern, ''), ...(done ? { done } : {}) };
  }
  return null;
}

const MARKS: readonly [string, keyof Omit<Span, 'text'>][] = [
  ['**', 'bold'],
  ['~~', 'strike'],
  ['`', 'code'],
  ['*', 'italic'],
];

/**
 * A block's text as spans: `**bold**`, `*italic*`, `` `code` `` and `~~struck~~`, nested as
 * they are written. An opening mark with no close is left as the characters it is.
 */
export function inline(text: string, marks: Omit<Span, 'text'> = {}): Span[] {
  const spans: Span[] = [];
  let plain = '';
  let i = 0;
  const flush = () => {
    if (plain) spans.push({ text: plain, ...marks });
    plain = '';
  };
  while (i < text.length) {
    const mark = MARKS.find(([token]) => text.startsWith(token, i));
    const close = mark ? text.indexOf(mark[0], i + mark[0].length) : -1;
    if (!mark || close === -1 || close === i + mark[0].length) {
      plain += text[i];
      i++;
      continue;
    }
    flush();
    const inner = text.slice(i + mark[0].length, close);
    const nested = { ...marks, [mark[1]]: true };
    spans.push(...(mark[1] === 'code' ? [{ text: inner, ...nested }] : inline(inner, nested)));
    i = close + mark[0].length;
  }
  flush();
  return spans;
}

/** `text` with `around` either side of the selection, or at the caret when nothing is selected. */
export function wrapped(
  text: string,
  selection: { start: number; end: number },
  around: string,
): { text: string; caret: number } {
  const { start, end } = selection;
  return {
    text: text.slice(0, start) + around + text.slice(start, end) + around + text.slice(end),
    caret: end + around.length * (start === end ? 1 : 2),
  };
}

let next = 1;
const id = () => `b${next++}`;
const block = (kind: BlockKind, text: string, done?: boolean): Block => ({
  id: id(),
  kind,
  text,
  ...(done === undefined ? {} : { done }),
});

const SEED: readonly Note[] = [
  {
    id: 'n1',
    title: 'Trip to Lisbon',
    edited: Date.now() - 3_600_000,
    blocks: [
      block('heading', 'Before we go'),
      block('check', 'Book the **airport** transfer', true),
      block('check', 'Pack *light* this time'),
      block('check', 'Download the ~~old~~ new metro map'),
      block('heading', 'Places'),
      block('bullet', 'Time Out Market, for `lunch`'),
      block('bullet', 'Miradouro da Senhora do Monte at sunset'),
      block('quote', 'Take the 28 tram early, before the queues.'),
    ],
  },
  {
    id: 'n2',
    title: 'Ideas',
    edited: Date.now() - 86_400_000 * 2,
    blocks: [block('paragraph', 'A canary screen for **every** bug we find.')],
  },
];

export class NotesModel {
  private readonly allState = createSignal<readonly Note[]>(SEED);
  readonly all = this.allState[0];
  readonly setAll = this.allState[1];

  get(noteId: string): Note | undefined {
    return this.all().find((note) => note.id === noteId);
  }

  create(): Note {
    const note: Note = {
      id: `n${Date.now()}`,
      title: '',
      edited: Date.now(),
      blocks: [block('paragraph', '')],
    };
    this.setAll((notes) => [note, ...notes]);
    return note;
  }

  update(noteId: string, change: (note: Note) => Partial<Note>): void {
    this.setAll((notes) =>
      notes.map((note) =>
        note.id === noteId ? { ...note, ...change(note), edited: Date.now() } : note,
      ),
    );
  }

  /** A new block after `after`, of the kind a list continues as: a list goes on being a list. */
  split(noteId: string, after: string): Block | undefined {
    const note = this.get(noteId);
    const index = note?.blocks.findIndex((one) => one.id === after) ?? -1;
    const previous = note?.blocks[index];
    if (!note || !previous) return undefined;
    const continues = (previous.kind === 'bullet' || previous.kind === 'check') && previous.text;
    const made = continues
      ? block(previous.kind, '', previous.kind === 'check' ? false : undefined)
      : block('paragraph', '');
    this.update(noteId, (current) => ({
      blocks: [...current.blocks.slice(0, index + 1), made, ...current.blocks.slice(index + 1)],
    }));
    return made;
  }

  /** Take an empty block out, as backspace at the start of one does. */
  remove(noteId: string, blockId: string): void {
    this.update(noteId, (note) => ({
      blocks:
        note.blocks.length > 1 ? note.blocks.filter((one) => one.id !== blockId) : note.blocks,
    }));
  }
}

export type Notes = NotesModel;
export const Notes = createServiceToken('Notes', () => new NotesModel());
