/**
 * The tree both renderers build, the styles it is built from, and the script both run.
 *
 * Kept in one file so neither side can drift: the same rows, the same view and text per row, the
 * same style objects by identity, the same steps in the same order. A benchmark where the two
 * trees differ measures the trees.
 */

export const ROWS = 1000;

export interface Row {
  id: number;
  label: string;
  /** Built here rather than in a template or a render, so neither side pays for the other's. */
  style: Record<string, unknown>;
}

const TINTS = ['#1c1c1e', '#232326', '#2a2a33'];

export const styles = {
  page: { flex: 1, paddingTop: 60, paddingHorizontal: 12, backgroundColor: '#000000' },
  head: { color: '#ffffff', fontSize: 11, marginBottom: 8 },
  row: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, marginBottom: 4 },
  selected: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 4,
    backgroundColor: '#0a84ff',
  },
  label: { color: '#e5e5ea', fontSize: 12 },
};

let nextId = 0;

export function rows(count: number, generation = 0): Row[] {
  return Array.from({ length: count }, () => {
    const id = nextId++;
    return {
      id,
      label: `row ${id} - ${generation}`,
      style: { ...styles.row, backgroundColor: TINTS[(id + generation) % TINTS.length]! },
    };
  });
}

export interface State {
  rows: Row[];
  selected: number;
}

/**
 * js-framework-benchmark's operations, in its order. Each is a pure step from one state to the
 * next, so both sides apply exactly the same change and differ only in how they render it.
 */
export const STEPS: { name: string; apply(state: State): State }[] = [
  { name: 'mount', apply: (s) => s },
  { name: 'replace', apply: (s) => ({ ...s, rows: rows(ROWS, 1) }) },
  {
    name: 'update10th',
    apply: (s) => ({
      ...s,
      rows: s.rows.map((row, i) => (i % 10 ? row : { ...row, label: row.label + ' !!!' })),
    }),
  },
  { name: 'select', apply: (s) => ({ ...s, selected: s.rows[5]!.id }) },
  {
    name: 'label1',
    apply: (s) => ({
      ...s,
      rows: s.rows.map((row, i) => (i === 500 ? { ...row, label: row.label + ' ?' } : row)),
    }),
  },
  {
    name: 'swap',
    apply: (s) => {
      const next = s.rows.slice();
      [next[1], next[ROWS - 2]] = [next[ROWS - 2]!, next[1]!];
      return { ...s, rows: next };
    },
  },
  { name: 'remove', apply: (s) => ({ ...s, rows: s.rows.filter((_, i) => i !== 5) }) },
  { name: 'append', apply: (s) => ({ ...s, rows: [...s.rows, ...rows(ROWS, 2)] }) },
  { name: 'clear', apply: (s) => ({ ...s, rows: [] }) },
];

/** How long each step is given to commit and settle before the next starts. */
export const STEP_MS = 400;

export const initial = (): State => ({ rows: rows(ROWS), selected: -1 });
