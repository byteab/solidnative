import { batch, createMemo, createSignal, getOwner, onCleanup } from 'solid-js';
import { createServiceToken } from '@solid-native/device/solid';

export interface Slide {
  readonly id: string;
  readonly glyph: string;
  readonly caption: string;
  /** Two colours the slide's gradient runs between. */
  readonly from: string;
  readonly to: string;
}

export interface Story {
  readonly id: string;
  readonly name: string;
  readonly initial: string;
  readonly slides: readonly Slide[];
}

const slide = (id: string, glyph: string, caption: string, from: string, to: string): Slide => ({
  id,
  glyph,
  caption,
  from,
  to,
});

export const STORIES: readonly Story[] = [
  {
    id: 'mei',
    name: 'Mei',
    initial: 'M',
    slides: [
      slide('m1', '🏔', 'Up before the sun', '#1e3a8a', '#f59e0b'),
      slide('m2', '☕️', 'Worth the climb', '#78350f', '#fbbf24'),
    ],
  },
  {
    id: 'kofi',
    name: 'Kofi',
    initial: 'K',
    slides: [
      slide('k1', '🎸', 'New strings', '#581c87', '#ec4899'),
      slide('k2', '🎶', 'Gig on Friday', '#0f172a', '#6366f1'),
      slide('k3', '🍕', 'After party', '#7f1d1d', '#f97316'),
    ],
  },
  {
    id: 'ines',
    name: 'Ines',
    initial: 'I',
    slides: [slide('i1', '🌿', 'The garden is finally green', '#14532d', '#84cc16')],
  },
  {
    id: 'tom',
    name: 'Tom',
    initial: 'T',
    slides: [
      slide('t1', '🚲', 'Forty miles', '#0c4a6e', '#22d3ee'),
      slide('t2', '🥵', 'Regretting it', '#831843', '#fb7185'),
    ],
  },
];

/** Where the viewer is: which story, and which of its slides. */
export interface Place {
  readonly story: number;
  readonly slide: number;
}

/** The next place, into the next story at its end; null past the last. */
export function after(place: Place, stories: readonly Story[] = STORIES): Place | null {
  if (place.slide + 1 < stories[place.story]!.slides.length) {
    return { story: place.story, slide: place.slide + 1 };
  }
  return place.story + 1 < stories.length ? { story: place.story + 1, slide: 0 } : null;
}

/** The place before, into the previous story's last slide; the first slide stays put. */
export function before(place: Place, stories: readonly Story[] = STORIES): Place {
  if (place.slide > 0) return { story: place.story, slide: place.slide - 1 };
  if (place.story === 0) return place;
  return { story: place.story - 1, slide: stories[place.story - 1]!.slides.length - 1 };
}

export class ViewerModel {
  private readonly placeState = createSignal<Place>({ story: 0, slide: 0 });
  readonly place = this.placeState[0];
  private readonly seenState = createSignal<ReadonlySet<string>>(new Set());
  readonly seen = this.seenState[0];
  readonly story = createMemo(() => STORIES[this.place().story]!);
  readonly slide = createMemo(() => this.story().slides[this.place().slide]!);
  private active = true;
  constructor() {
    if (getOwner())
      onCleanup(() => {
        this.active = false;
      });
  }
  open(story: number): void {
    if (this.active && Number.isInteger(story) && STORIES[story])
      this.placeState[1]({ story, slide: 0 });
  }
  next(): boolean {
    if (!this.active) return false;
    const place = this.place(),
      to = after(place),
      id = this.story().id;
    batch(() => {
      if (!to || to.story !== place.story) this.seenState[1]((seen) => new Set([...seen, id]));
      if (to) this.placeState[1](to);
    });
    return !!to && this.active;
  }
  previous(): void {
    if (this.active) this.placeState[1](before(this.place()));
  }
}
export type Viewer = ViewerModel;
export const Viewer = createServiceToken('Viewer', () => new ViewerModel());
