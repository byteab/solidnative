export type Section = 'next' | 'later';

export interface Track {
  readonly id: string;
  readonly title: string;
  readonly section: Section;
}

/** One row of the list: a section's heading, or a track under it. */
export type PlaylistRow =
  | {
      readonly kind: 'heading';
      readonly id: string;
      readonly section: Section;
      readonly count: number;
    }
  | { readonly kind: 'track'; readonly id: string; readonly track: Track };

const TITLES = [
  'So What',
  'Naima',
  'Blue in Green',
  'Footprints',
  'Maiden Voyage',
  'Cantaloupe Island',
  'Take Five',
  'Round Midnight',
  'Summertime',
  'Autumn Leaves',
];

let next = 0;

export function makeTrack(section: Section): Track {
  const n = next++;
  return { id: `k${n}`, title: `${TITLES[n % TITLES.length]} #${n}`, section };
}

export function initialTracks(count = 60): Track[] {
  return Array.from({ length: count }, (_, i) => makeTrack(i < 12 ? 'next' : 'later'));
}

/** The rows the list draws: each section's heading and then its tracks, in list order. */
export function rowsOf(tracks: readonly Track[], filter: string): PlaylistRow[] {
  const q = filter.trim().toLowerCase();
  const shown = q ? tracks.filter((track) => track.title.toLowerCase().includes(q)) : tracks;
  const rows: PlaylistRow[] = [];
  for (const section of ['next', 'later'] as const) {
    const inSection = shown.filter((track) => track.section === section);
    rows.push({ kind: 'heading', id: `h-${section}`, section, count: inSection.length });
    for (const track of inSection) rows.push({ kind: 'track', id: track.id, track });
  }
  return rows;
}

/** Move the track at `from` to sit at `to`, both indexes into `tracks`. */
export function moveTrack(tracks: readonly Track[], from: number, to: number): Track[] {
  const next = tracks.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return next;
}

/** A deterministic shuffle, so a test can say what it expects. */
export function shuffled(tracks: readonly Track[], seed: number): Track[] {
  const next = tracks.slice();
  let state = seed || 1;
  for (let i = next.length - 1; i > 0; i--) {
    state = (state * 16807) % 2147483647;
    const j = state % (i + 1);
    [next[i], next[j]] = [next[j]!, next[i]!];
  }
  return next;
}
