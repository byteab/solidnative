import { batch, createMemo, createSignal, getOwner, onCleanup } from 'solid-js';
import { createServiceToken } from '@solidnative/device/solid';

export interface Product {
  readonly id: string;
  readonly name: string;
  readonly maker: string;
  /** Pence. */
  readonly price: number;
  /** What it cost before the sale, if it is on one. */
  readonly was?: number;
  /** Out of five, to a tenth. */
  readonly rating: number;
  readonly reviews: number;
  /** Drawn large over the product's gradient, standing in for a photo. */
  readonly glyph: string;
  /** The product's colour, bound as a CSS variable its gradient and chips derive from. */
  readonly tone: string;
  readonly sizes?: readonly string[];
}

export const PRODUCTS: readonly Product[] = [
  {
    id: 'p1',
    name: 'Trail Runner 3',
    maker: 'Northfold',
    price: 11900,
    was: 14500,
    rating: 4.6,
    reviews: 812,
    glyph: '👟',
    tone: '#f97316',
    sizes: ['6', '7', '8', '9', '10', '11'],
  },
  {
    id: 'p2',
    name: 'Merino Crew',
    maker: 'Hale & Co',
    price: 6500,
    rating: 4.8,
    reviews: 1204,
    glyph: '🧶',
    tone: '#0ea5e9',
    sizes: ['S', 'M', 'L', 'XL'],
  },
  {
    id: 'p3',
    name: 'Canvas Tote',
    maker: 'Field Goods',
    price: 2800,
    rating: 4.2,
    reviews: 96,
    glyph: '👜',
    tone: '#84cc16',
  },
  {
    id: 'p4',
    name: 'Studio Headphones',
    maker: 'Arcwave',
    price: 17900,
    was: 21900,
    rating: 4.4,
    reviews: 431,
    glyph: '🎧',
    tone: '#8b5cf6',
  },
  {
    id: 'p5',
    name: 'Ceramic Pour-over',
    maker: 'Kiln',
    price: 3400,
    rating: 4.9,
    reviews: 57,
    glyph: '☕️',
    tone: '#d97706',
  },
  {
    id: 'p6',
    name: 'Rain Shell',
    maker: 'Northfold',
    price: 15500,
    rating: 3.9,
    reviews: 203,
    glyph: '🧥',
    tone: '#14b8a6',
    sizes: ['S', 'M', 'L'],
  },
];

/** Delivery is free from this much, in pence. */
export const FREE_DELIVERY = 7500;
export const DELIVERY = 495;

export interface Line {
  readonly product: Product;
  readonly size: string | null;
  readonly quantity: number;
}

/** A price as a shopper reads it: `£119`, or `£28.50` when there are pence. */
export function price(pence: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: pence % 100 === 0 ? 0 : 2,
  }).format(pence / 100);
}

/** How much a sale takes off, as a whole percentage. */
export const saving = (product: Product) =>
  product.was ? Math.round((1 - product.price / product.was) * 100) : 0;

/** The basket with a product added: one more of a line already in it, or a new line. */
export function added(lines: readonly Line[], product: Product, size: string | null): Line[] {
  const index = lines.findIndex((line) => line.product.id === product.id && line.size === size);
  if (index === -1) return [...lines, { product, size, quantity: 1 }];
  return lines.map((line, i) => (i === index ? { ...line, quantity: line.quantity + 1 } : line));
}

/** The basket with a line's quantity changed; at nothing, the line goes. */
export function changed(lines: readonly Line[], line: Line, by: number): Line[] {
  return lines
    .map((one) => (one === line ? { ...one, quantity: one.quantity + by } : one))
    .filter((one) => one.quantity > 0);
}

export class BasketModel {
  private readonly linesState = createSignal<readonly Line[]>([]);
  readonly lines = this.linesState[0];
  readonly count = createMemo(() => this.lines().reduce((sum, line) => sum + line.quantity, 0));
  readonly subtotal = createMemo(() =>
    this.lines().reduce((sum, line) => sum + line.product.price * line.quantity, 0),
  );
  readonly delivery = createMemo(() =>
    this.subtotal() === 0 || this.subtotal() >= FREE_DELIVERY ? 0 : DELIVERY,
  );
  readonly total = createMemo(() => this.subtotal() + this.delivery());
  private readonly addsState = createSignal(0);
  readonly adds = this.addsState[0];
  private active = true;
  constructor() {
    if (getOwner())
      onCleanup(() => {
        this.active = false;
      });
  }
  add(product: Product, size: string | null): void {
    if (!this.active) return;
    batch(() => {
      this.linesState[1]((lines) => added(lines, product, size));
      this.addsState[1]((n) => n + 1);
    });
  }
  change(line: Line, by: number): void {
    if (this.active) this.linesState[1]((lines) => changed(lines, line, by));
  }
}
export type Basket = BasketModel;
export const Basket = createServiceToken('Basket', () => new BasketModel());
