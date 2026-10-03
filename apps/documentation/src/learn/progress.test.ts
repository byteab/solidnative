import { describe, expect, it } from 'vitest';
import { parseProgress } from './progress.ts';

const valid = { files: { 'app.tsx': 'export function App() {}' }, step: 1, done: [0] };
const stored = (value: unknown) => JSON.stringify(value);

describe('parseProgress', () => {
  it('reads progress this version of the site saved', () => {
    expect(parseProgress(stored(valid))).toEqual(valid);
    expect(parseProgress(stored({ ...valid, files: { ...valid.files, 'habit.tsx': '' } }))).toEqual(
      {
        ...valid,
        files: { ...valid.files, 'habit.tsx': '' },
      },
    );
  });

  it('starts afresh from nothing, and from what is not JSON', () => {
    expect(parseProgress(null)).toBeUndefined();
    expect(parseProgress('{not json')).toBeUndefined();
  });

  it('starts afresh from progress another version saved in a shape this one cannot open', () => {
    for (const broken of [
      null,
      [],
      'app.tsx',
      { ...valid, files: null },
      { ...valid, files: ['app.tsx'] },
      { ...valid, files: { 'app.tsx': 42 } },
      { ...valid, files: { 'main.tsx': '' } },
      { ...valid, step: -1 },
      { ...valid, step: 1.5 },
      { ...valid, step: '1' },
      { ...valid, done: null },
      { ...valid, done: ['0'] },
      { ...valid, done: [-1] },
    ]) {
      expect(parseProgress(stored(broken)), JSON.stringify(broken)).toBeUndefined();
    }
  });
});
