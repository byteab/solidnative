/**
 * The prefix sums a list of rows that size themselves is placed by. A measurement arrives for one
 * row at a time, and in a list of ten thousand rebuilding every offset for each one costs most of
 * a frame on a phone; this answers each change and each query in logarithmic time.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { HeightIndex } from '../components/src/height-index.ts';

describe('height index', () => {
  const sizes = [10, 20, 30, 40, 50];

  it('answers where each row starts, and the total', () => {
    const index = new HeightIndex(sizes);
    assert.deepEqual(
      [0, 1, 2, 3, 4, 5].map((i) => index.topOf(i)),
      [0, 10, 30, 60, 100, 150],
    );
    assert.equal(index.total, 150);
    assert.equal(index.heightOf(3), 40);
  });

  it('finds the row a point falls in, as the last row starting at or before it', () => {
    const index = new HeightIndex(sizes);
    assert.deepEqual(
      [0, 9.5, 10, 29, 30, 149, 150, 1000, -5].map((y) => index.indexAt(y)),
      [0, 0, 1, 1, 2, 4, 4, 4, 0],
    );
  });

  it('moves every later row when one row changes size', () => {
    const index = new HeightIndex(sizes);
    index.set(1, 25);
    assert.equal(index.heightOf(1), 25);
    assert.deepEqual(
      [2, 5].map((i) => index.topOf(i)),
      [35, 155],
    );
    assert.equal(index.indexAt(34), 1);
    assert.equal(index.indexAt(35), 2);
  });

  it('is empty without rows', () => {
    const index = new HeightIndex([]);
    assert.equal(index.total, 0);
    assert.equal(index.indexAt(10), 0);
    assert.equal(index.topOf(0), 0);
  });

  it('agrees with plain sums over a long list after many changes', () => {
    const count = 1000;
    const plain = Array.from({ length: count }, (_, i) => 20 + (i % 7) * 13);
    const index = new HeightIndex(plain);
    for (let n = 0; n < 500; n++) {
      const at = (n * 7919) % count;
      plain[at] = 5 + ((n * 31) % 300);
      index.set(at, plain[at]!);
    }
    let top = 0;
    for (let i = 0; i < count; i++) {
      assert.equal(index.topOf(i), top, `row ${i}`);
      assert.equal(index.indexAt(top), i, `the row at ${top}`);
      top += plain[i]!;
    }
    assert.equal(index.total, top);
  });
});
