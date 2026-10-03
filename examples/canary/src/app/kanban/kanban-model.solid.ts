import { createMemo, createSignal } from 'solid-js';
import { createServiceToken } from '@solidnative/device/solid';

export type ColumnId = 'backlog' | 'doing' | 'review' | 'done';
export type Tag = 'design' | 'build' | 'bug' | 'research';

export interface Column {
  readonly id: ColumnId;
  readonly name: string;
  /** The column's colour, bound as a CSS variable that its header, rail and highlight derive from. */
  readonly tone: string;
}

export interface Card {
  readonly id: string;
  readonly title: string;
  readonly tag: Tag;
  readonly points: number;
  readonly owner: string;
  readonly column: ColumnId;
}

export const COLUMNS: readonly Column[] = [
  { id: 'backlog', name: 'Backlog', tone: '#64748b' },
  { id: 'doing', name: 'Doing', tone: '#2563eb' },
  { id: 'review', name: 'Review', tone: '#c026d3' },
  { id: 'done', name: 'Done', tone: '#16a34a' },
];

export const TAG_TONES: Record<Tag, string> = {
  design: '#db2777',
  build: '#0891b2',
  bug: '#dc2626',
  research: '#ca8a04',
};

const card = (
  id: string,
  title: string,
  tag: Tag,
  points: number,
  owner: string,
  column: ColumnId,
) => ({ id, title, tag, points, owner, column }) satisfies Card;

export const CARDS: readonly Card[] = [
  card('k1', 'Onboarding illustrations', 'design', 3, 'Ines', 'backlog'),
  card('k2', 'Offline sync for drafts', 'build', 8, 'Kofi', 'backlog'),
  card('k3', 'Interview five power users', 'research', 5, 'Mei', 'backlog'),
  card('k4', 'Crash when a photo is huge', 'bug', 2, 'Tom', 'doing'),
  card('k5', 'Dark mode for settings', 'design', 3, 'Ines', 'doing'),
  card('k6', 'Search as you type', 'build', 5, 'Aisha', 'doing'),
  card('k7', 'Share sheet extension', 'build', 8, 'Kofi', 'review'),
  card('k8', 'Badge count is off by one', 'bug', 1, 'Tom', 'review'),
  card('k9', 'Pricing page copy', 'research', 2, 'Mei', 'done'),
  card('k10', 'App icon refresh', 'design', 2, 'Ines', 'done'),
];

/**
 * The board with one card moved: out of its column and into `to`, at `index` among the cards
 * already there, or last. Moving a card within its own column reorders it.
 */
export function moveCard(
  cards: readonly Card[],
  id: string,
  to: ColumnId,
  index?: number,
): readonly Card[] {
  const moving = cards.find((one) => one.id === id);
  if (!moving) return cards;
  const rest = cards.filter((one) => one.id !== id);
  const inTarget = rest.filter((one) => one.column === to);
  const at = Math.max(0, Math.min(index ?? inTarget.length, inTarget.length));
  const before = inTarget[at];
  const position = before ? rest.indexOf(before) : lastIndexIn(rest, to) + 1;
  return [...rest.slice(0, position), { ...moving, column: to }, ...rest.slice(position)];
}

function lastIndexIn(cards: readonly Card[], column: ColumnId): number {
  for (let i = cards.length - 1; i >= 0; i--) if (cards[i]!.column === column) return i;
  return cards.length - 1;
}

/**
 * Which column a finger at `x` across the screen is over, given how far the board is scrolled and
 * how its columns are laid out. Null over the padding before the first.
 */
export function columnAt(
  x: number,
  scrolled: number,
  layout: { readonly inset: number; readonly width: number; readonly gap: number },
): ColumnId | null {
  const along = x + scrolled - layout.inset;
  if (along < 0) return null;
  const index = Math.floor(along / (layout.width + layout.gap));
  return COLUMNS[Math.min(index, COLUMNS.length - 1)]!.id;
}

/** The one board the page shows. */
export class BoardModel {
  private readonly cardsState = createSignal<readonly Card[]>(CARDS);
  readonly cards = this.cardsState[0];
  readonly setCards = this.cardsState[1];
  readonly columns = createMemo(() =>
    COLUMNS.map((column) => {
      const cards = this.cards().filter((one) => one.column === column.id);
      return { ...column, cards, points: cards.reduce((sum, one) => sum + one.points, 0) };
    }),
  );
  readonly total = createMemo(() => this.cards().reduce((sum, one) => sum + one.points, 0));
  readonly done = createMemo(() => this.columns().find((column) => column.id === 'done')!.points);

  move(id: string, to: ColumnId, index?: number): void {
    this.setCards((cards) => moveCard(cards, id, to, index));
  }
}

export type Board = BoardModel;
export const Board = createServiceToken('Board', () => new BoardModel());
