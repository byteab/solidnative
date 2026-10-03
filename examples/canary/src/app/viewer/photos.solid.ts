export interface Photo {
  readonly id: string;
  readonly uri: string;
  readonly title: string;
}

export const PHOTOS: readonly Photo[] = Array.from({ length: 12 }, (_, i) => ({
  id: `ph${i}`,
  uri: `https://picsum.photos/seed/viewer${i}/1200/900`,
  title: `Photo ${i + 1}`,
}));
