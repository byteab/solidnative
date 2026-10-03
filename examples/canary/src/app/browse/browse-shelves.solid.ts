import { createServiceToken, useService } from '@solid-native/device/solid';

export interface Album {
  readonly id: string;
  readonly title: string;
  readonly hue: number;
}

export interface Shelf {
  readonly id: string;
  readonly genre: string;
  readonly albums: readonly Album[];
}

/** A heading pinned over its shelf, or the shelf itself: the rows of the browse screen. */
export type BrowseRow =
  | { readonly kind: 'heading'; readonly shelf: Shelf }
  | { readonly kind: 'shelf'; readonly shelf: Shelf };

const GENRES = [
  'Jazz',
  'Soul',
  'Blues',
  'Funk',
  'Gospel',
  'Bossa nova',
  'Bebop',
  'Swing',
  'Fusion',
  'Latin',
  'Big band',
  'Cool jazz',
  'Hard bop',
  'Modal',
  'Free jazz',
  'Vocal',
  'Piano trios',
  'Soundtracks',
  'Reggae',
  'Afrobeat',
  'Ambient',
  'Folk',
  'Classical',
  'Electronic',
];

export function shelves(round = 0): Shelf[] {
  return GENRES.map((genre, g) => ({
    id: `g${g}`,
    genre,
    albums: Array.from({ length: 30 }, (_, a) => ({
      id: `g${g}a${a}`,
      title: `${genre} ${a + 1}${round ? ` (${round})` : ''}`,
      hue: (g * 37 + a * 11) % 360,
    })),
  }));
}

export function rowsOf(list: readonly Shelf[]): BrowseRow[] {
  return list.flatMap((shelf) => [
    { kind: 'heading', shelf },
    { kind: 'shelf', shelf },
  ]);
}

/**
 * How far along each shelf the user had scrolled, by shelf. A shelf's row is recycled once it
 * leaves the window, and its horizontal list with it, so the position cannot live in the row.
 */
export class ShelfPositionsSource {
  private readonly offsets = new Map<string, number>();

  get(id: string): number {
    return this.offsets.get(id) ?? 0;
  }

  set(id: string, offset: number): void {
    this.offsets.set(id, offset);
  }
}

/** Lazy scoped source seam; importing the data never loads a framework/native module. */
export type ShelfPositions = Pick<ShelfPositionsSource, keyof ShelfPositionsSource>;
const source = createServiceToken<ShelfPositions>(
  'ShelfPositions.source',
  () => new ShelfPositionsSource(),
);
export const ShelfPositions = Object.freeze({
  ...createServiceToken<ShelfPositions>('ShelfPositions', () => useService(source)),
  SOURCE: source,
});
