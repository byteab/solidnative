import { describe, expect, it } from 'vitest';
import { checkFileName, findEntry, isTestFile, languageOf } from './file-name.ts';

describe('checkFileName', () => {
  it('takes a kebab-case component, test or stylesheet name', () => {
    expect(checkFileName('new-habit.tsx', ['app.tsx'])).toEqual({ name: 'new-habit.tsx' });
    expect(checkFileName('new-habit.ts', [])).toEqual({ name: 'new-habit.ts' });
    expect(checkFileName('new-habit.spec.tsx', [])).toEqual({ name: 'new-habit.spec.tsx' });
    expect(checkFileName('new-habit.native.css', [])).toEqual({ name: 'new-habit.native.css' });
  });

  it('adds .tsx when it is left off, and ignores spaces around the name', () => {
    expect(checkFileName('  habit-list ', [])).toEqual({ name: 'habit-list.tsx' });
  });

  it('refuses a name that is not kebab-case', () => {
    for (const typed of [
      'NewHabit.tsx',
      'new_habit.tsx',
      'new habit',
      '-habit.tsx',
      'a/b.tsx',
      'x.js',
      'x.spec.css',
    ]) {
      expect(checkFileName(typed, [])).toHaveProperty('error');
    }
  });

  it('refuses nothing at all, and a name the lesson already has', () => {
    expect(checkFileName(' ', [])).toHaveProperty('error');
    expect(checkFileName('app', ['app.tsx'])).toEqual({
      error: 'There is already a file called app.tsx.',
    });
  });
});

describe('lesson files', () => {
  it('finds the entry, the tests and the language of each file', () => {
    expect(findEntry({ 'habit-row.tsx': '', 'app.tsx': '' })).toBe('app.tsx');
    expect(findEntry({ 'src/app.tsx': '' })).toBe('src/app.tsx');
    expect(findEntry({ 'main.tsx': '' })).toBeUndefined();
    expect(isTestFile('app.spec.tsx')).toBe(true);
    expect(isTestFile('app.tsx')).toBe(false);
    expect(languageOf('app.native.css')).toBe('css');
    expect(languageOf('app.tsx')).toBe('tsx');
  });
});
