import assert from 'node:assert/strict';
import { test } from 'node:test';
import { excerpt, matchesQuery, sortNotes, wordCount, type Note } from '../src/app/data/note.ts';

function note(overrides: Partial<Note>): Note {
  return { id: 'n1', title: 'Title', body: 'Body', pinned: false, updatedAt: 0, ...overrides };
}

test('pinned notes come first, then most recently updated', () => {
  const notes = [
    note({ id: 'old', updatedAt: 1 }),
    note({ id: 'new', updatedAt: 3 }),
    note({ id: 'pinned-old', pinned: true, updatedAt: 0 }),
    note({ id: 'pinned-new', pinned: true, updatedAt: 2 }),
  ];
  assert.deepEqual(
    sortNotes(notes).map((n) => n.id),
    ['pinned-new', 'pinned-old', 'new', 'old'],
  );
});

test('a search matches the title or the body, ignoring case', () => {
  const shopping = note({ title: 'Grocery list', body: 'Oat milk, coffee' });
  assert.equal(matchesQuery(shopping, 'grocery'), true);
  assert.equal(matchesQuery(shopping, 'COFFEE'), true);
  assert.equal(matchesQuery(shopping, 'flowers'), false);
  assert.equal(matchesQuery(shopping, '  '), true);
});

test('word count treats empty and whitespace-only text as zero words', () => {
  assert.equal(wordCount(''), 0);
  assert.equal(wordCount('   '), 0);
  assert.equal(wordCount('one'), 1);
  assert.equal(wordCount('a couple of words'), 4);
  assert.equal(wordCount('  extra   space   between '), 3);
});

test('an excerpt is cut to length, and shorter text is left alone', () => {
  assert.equal(excerpt('short body'), 'short body');
  assert.equal(excerpt('line one\nline two'), 'line one line two');
  assert.equal(excerpt('x'.repeat(90), 10), `${'x'.repeat(10)}...`);
});
