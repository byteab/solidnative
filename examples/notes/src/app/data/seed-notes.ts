import type { Note } from './note.ts';

const now = Date.now();
const hoursAgo = (n: number) => now - n * 1000 * 60 * 60;

/**
 * A handful of notes so the list has something to show, search and pin from first launch.
 *
 * Shared between the local cache's starting signal and the fake server's remote seed, so the two
 * agree: a first, online launch merges the server's list straight back over this one rather than
 * deleting it, the same as [Working offline](/guide/offline) describes for any note the merge
 * cannot confirm the server already has.
 */
export const SEED_NOTES: readonly Note[] = [
  {
    id: 'seed-groceries',
    title: 'Grocery list',
    body: 'Oat milk, coffee, sourdough, tomatoes, basil. Ask at the counter whether the good cheddar is back in.',
    pinned: true,
    updatedAt: hoursAgo(2),
  },
  {
    id: 'seed-standup',
    title: 'Standup notes',
    body: 'Ship the notes screen, then pick up the search bug. Ana is out Thursday, so review the PR before then.',
    pinned: true,
    updatedAt: hoursAgo(5),
  },
  {
    id: 'seed-reading',
    title: 'Books to read',
    body: 'Piranesi, The Employees, A Psalm for the Wild-Built. Library holds two of the three already.',
    pinned: false,
    updatedAt: hoursAgo(20),
  },
  {
    id: 'seed-recipe',
    title: 'Weeknight pasta',
    body: 'Garlic, chilli flakes, anchovy, lemon zest, a fried egg on top. Twelve minutes, start to plate.',
    pinned: false,
    updatedAt: hoursAgo(30),
  },
  {
    id: 'seed-gift',
    title: 'Gift ideas',
    body: 'A pour-over kettle, a print from the show we saw in March, or just the record she kept putting on at the flat.',
    pinned: false,
    updatedAt: hoursAgo(72),
  },
];
