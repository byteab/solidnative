/**
 * Row sizes and the offsets they add up to, as a Fenwick tree: changing one row's size, finding
 * where a row starts and finding the row at a point each cost a walk of about log2(n) steps.
 *
 * A list of rows that size themselves learns heights one row at a time as rows lay out, and a
 * fling through rows it has not seen yet measures a few every frame. Rebuilding a plain table of
 * offsets for each of those is a walk over every row, which at ten thousand rows is most of a
 * frame on a phone. This keeps that cost to building the index once per change of items.
 */
export class HeightIndex {
  /** Each row's size, for `heightOf` without a query. */
  private readonly sizes: Float64Array;
  /** The tree, one-based: `tree[i]` sums the `i & -i` sizes ending at row `i - 1`. */
  private readonly tree: Float64Array;
  /** The highest power of two within the row count, where a descent starts. */
  private readonly top: number;

  constructor(sizes: ArrayLike<number>) {
    const count = sizes.length;
    this.sizes = Float64Array.from(sizes);
    this.tree = new Float64Array(count + 1);
    // Linear construction: each node passes its sum to its parent once.
    for (let i = 1; i <= count; i++) {
      this.tree[i]! += this.sizes[i - 1]!;
      const parent = i + (i & -i);
      if (parent <= count) this.tree[parent]! += this.tree[i]!;
    }
    let top = 1;
    while (top * 2 <= count) top *= 2;
    this.top = count ? top : 0;
  }

  get length(): number {
    return this.sizes.length;
  }

  /** The sum of every row's size. */
  get total(): number {
    return this.topOf(this.sizes.length);
  }

  heightOf(index: number): number {
    return this.sizes[index] ?? 0;
  }

  /** Where row `index` starts: the sum of the sizes before it. Past the end, the total. */
  topOf(index: number): number {
    let sum = 0;
    for (let i = Math.min(index, this.sizes.length); i > 0; i -= i & -i) sum += this.tree[i]!;
    return sum;
  }

  /** Change one row's size, and with it where every later row starts. */
  set(index: number, size: number): void {
    const delta = size - this.sizes[index]!;
    if (delta === 0) return;
    this.sizes[index] = size;
    for (let i = index + 1; i <= this.sizes.length; i += i & -i) this.tree[i]! += delta;
  }

  /**
   * The row that `y` falls in: the last row starting at or before it, clamped to the rows there
   * are. A descent through the tree rather than a binary search over `topOf`, so one walk.
   */
  indexAt(y: number): number {
    const count = this.sizes.length;
    if (count === 0) return 0;
    let position = 0;
    let remaining = y;
    for (let step = this.top; step > 0; step >>= 1) {
      const next = position + step;
      if (next <= count && this.tree[next]! <= remaining) {
        position = next;
        remaining -= this.tree[next]!;
      }
    }
    // `position` rows end at or before `y`, so `y` is in the next one.
    return Math.min(position, count - 1);
  }
}
