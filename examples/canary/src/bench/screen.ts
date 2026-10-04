/**
 * The page both renderers mount in the screen benchmark: a scroll view of cards, each pressable,
 * with an avatar, two lines of text and a button, the way an app writes a list page it navigates
 * to. Kept in one file so neither side can drift: the same styles by identity, the same people,
 * the same steps.
 */

export const CARDS = 40;

export const screenStyles = {
  root: { flex: 1, backgroundColor: '#000000' },
  head: { color: '#ffffff', fontSize: 11, marginTop: 60, marginHorizontal: 12 },
  page: { flex: 1, backgroundColor: '#f2f2f7' },
  content: { padding: 16, gap: 12 },
  title: { fontSize: 28, fontWeight: '700', color: '#000000', marginBottom: 8 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    gap: 12,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#d1d1d6' },
  column: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: '600', color: '#000000' },
  meta: { fontSize: 13, color: '#8e8e93' },
  button: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#0a84ff',
  },
  buttonText: { fontSize: 13, fontWeight: '600', color: '#ffffff' },
} as const;

export interface Person {
  id: number;
  name: string;
  city: string;
}

export const people: Person[] = Array.from({ length: CARDS }, (_, id) => ({
  id,
  name: `Person ${id}`,
  city: 'Lisbon',
}));

/** Mounted at start, then taken down and put back, as a navigation pushes and pops a page. */
export const SCREEN_STEPS = ['unmount', 'remount', 'unmount2', 'remount2'] as const;
