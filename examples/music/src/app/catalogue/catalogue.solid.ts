/** One track on an album. `source` is a `require()`d asset id; `audioPlayer` resolves it itself. */
export interface Track {
  readonly id: string;
  readonly title: string;
  readonly albumId: string;
  readonly artist: string;
  readonly duration: number;
  readonly source: number;
}

/** `artwork` is a `require()`d asset id too: `<image>` resolves it the way `<native-tab>` does. */
export interface Album {
  readonly id: string;
  readonly title: string;
  readonly artist: string;
  readonly tint: string;
  readonly artwork: number;
}

/**
 * The catalogue: a handful of albums and their tracks, as fixed data. A real app would load this
 * over HTTP; the example ships its own audio and artwork so it plays without a network.
 */
export const ALBUMS: readonly Album[] = [
  {
    id: 'drift',
    title: 'Drift',
    artist: 'Analytical Engine',
    tint: '#2563eb',
    artwork: require('../../../assets/artwork/drift.png'),
  },
  {
    id: 'tide',
    title: 'Tide',
    artist: 'Analytical Engine',
    tint: '#0891b2',
    artwork: require('../../../assets/artwork/tide.png'),
  },
  {
    id: 'ember',
    title: 'Ember',
    artist: 'Lovelace Sessions',
    tint: '#e11d48',
    artwork: require('../../../assets/artwork/ember.png'),
  },
  {
    id: 'nocturne',
    title: 'Nocturne',
    artist: 'Lovelace Sessions',
    tint: '#7c3aed',
    artwork: require('../../../assets/artwork/nocturne.png'),
  },
];

export const TRACKS: readonly Track[] = [
  {
    id: 'drift-1',
    title: 'Low Tide',
    albumId: 'drift',
    artist: 'Analytical Engine',
    duration: 8,
    source: require('../../../assets/audio/drift-1.m4a'),
  },
  {
    id: 'drift-2',
    title: 'Open Water',
    albumId: 'drift',
    artist: 'Analytical Engine',
    duration: 8,
    source: require('../../../assets/audio/drift-2.m4a'),
  },
  {
    id: 'drift-3',
    title: 'Undertow',
    albumId: 'drift',
    artist: 'Analytical Engine',
    duration: 8,
    source: require('../../../assets/audio/drift-3.m4a'),
  },
  {
    id: 'tide-1',
    title: 'High Water',
    albumId: 'tide',
    artist: 'Analytical Engine',
    duration: 8,
    source: require('../../../assets/audio/tide-1.m4a'),
  },
  {
    id: 'tide-2',
    title: 'Slack Tide',
    albumId: 'tide',
    artist: 'Analytical Engine',
    duration: 8,
    source: require('../../../assets/audio/tide-2.m4a'),
  },
  {
    id: 'tide-3',
    title: 'Ebb',
    albumId: 'tide',
    artist: 'Analytical Engine',
    duration: 8,
    source: require('../../../assets/audio/tide-3.m4a'),
  },
  {
    id: 'ember-1',
    title: 'First Light',
    albumId: 'ember',
    artist: 'Lovelace Sessions',
    duration: 8,
    source: require('../../../assets/audio/ember-1.m4a'),
  },
  {
    id: 'ember-2',
    title: 'Kindling',
    albumId: 'ember',
    artist: 'Lovelace Sessions',
    duration: 8,
    source: require('../../../assets/audio/ember-2.m4a'),
  },
  {
    id: 'ember-3',
    title: 'Afterglow',
    albumId: 'ember',
    artist: 'Lovelace Sessions',
    duration: 8,
    source: require('../../../assets/audio/ember-3.m4a'),
  },
  {
    id: 'nocturne-1',
    title: 'Blue Hour',
    albumId: 'nocturne',
    artist: 'Lovelace Sessions',
    duration: 8,
    source: require('../../../assets/audio/nocturne-1.m4a'),
  },
  {
    id: 'nocturne-2',
    title: 'Small Hours',
    albumId: 'nocturne',
    artist: 'Lovelace Sessions',
    duration: 8,
    source: require('../../../assets/audio/nocturne-2.m4a'),
  },
  {
    id: 'nocturne-3',
    title: 'Daybreak',
    albumId: 'nocturne',
    artist: 'Lovelace Sessions',
    duration: 8,
    source: require('../../../assets/audio/nocturne-3.m4a'),
  },
];

export function album(id: string): Album | undefined {
  return ALBUMS.find((a) => a.id === id);
}

export function tracksOf(albumId: string): readonly Track[] {
  return TRACKS.filter((t) => t.albumId === albumId);
}

/** m:ss, for a track's duration or a seek position. */
export function formatDuration(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return `${minutes}:${rest.toString().padStart(2, '0')}`;
}
