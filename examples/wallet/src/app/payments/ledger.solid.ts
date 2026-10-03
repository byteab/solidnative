import { createMemo, createSignal } from 'solid-js';
import { createServiceToken } from '@solid-native/device/solid';

/** One line on the statement. Amounts are whole pence, so sums never drift. */
export interface Payment {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly pence: number;
  readonly date: Date;
  readonly note?: string;
}

/** £1,240.50, or - £4.80 with `signed`. */
export function money(pence: number, { signed = false } = {}): string {
  const pounds = (Math.abs(pence) / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (!signed) return `${pence < 0 ? '-' : ''}£${pounds}`;
  return `${pence < 0 ? '-' : '+'} £${pounds}`;
}

/** Pounds as typed - 12, 12.5, 1,200.00 - in whole pence, or NaN for anything else. */
export function toPence(text: string): number {
  const clean = text.replace(/[£,\s]/g, '');
  return /^\d+(\.\d{1,2})?$/.test(clean) ? Math.round(Number(clean) * 100) : Number.NaN;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Today, Yesterday, or 12 Sep. */
export function dayOf(date: Date, today = new Date()): string {
  const days = Math.round(
    (new Date(today.toDateString()).getTime() - new Date(date.toDateString()).getTime()) / 864e5,
  );
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/** A colour per category, for the avatar beside each payment. */
export const TINTS: Record<string, string> = {
  Coffee: '#2563eb',
  Groceries: '#16a34a',
  Transport: '#e11d48',
  Salary: '#059669',
  'Eating out': '#ea580c',
  Subscriptions: '#7c3aed',
  Transfer: '#0891b2',
};

const OPENING = 820_000;

const REGULARS: readonly (readonly [string, string, number])[] = [
  ['Blue Bottle', 'Coffee', 480],
  ['Waitrose', 'Groceries', 3_845],
  ['Citymapper', 'Transport', 1_240],
  ['Dishoom', 'Eating out', 6_210],
  ['Pret', 'Coffee', 395],
  ['Tesco', 'Groceries', 2_190],
  ['TfL', 'Transport', 280],
  ['Spotify', 'Subscriptions', 1_199],
];

/** Four months of everyday spending and a monthly salary, ending today. */
function history(today: Date): Payment[] {
  const payments: Payment[] = [];
  for (let day = 0; day < 120; day++) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - day, 18);
    if (date.getDate() === 1) {
      payments.push({
        id: `s${day}`,
        name: 'Salary',
        category: 'Salary',
        pence: 320_000,
        date,
        note: 'Analytical Engines Ltd',
      });
    }
    for (let n = 0; n < 1 + (day % 3); n++) {
      const [name, category, pence] = REGULARS[(day * 3 + n) % REGULARS.length]!;
      payments.push({ id: `h${day}-${n}`, name, category, pence: -pence, date });
    }
  }
  return payments;
}

/**
 * The account: every payment in and out, newest first, and the balance they add up to.
 *
 * A real app would load this over HTTP; the example builds a few months of history so the
 * activity list has enough rows to be worth virtualising.
 */
export function createLedger() {
  const [all, setAll] = createSignal<readonly Payment[]>(history(new Date()));
  const balance = createMemo(() => all().reduce((sum, p) => sum + p.pence, OPENING));
  return {
    payments: all,
    balance,
    find: (id: string) => all().find((p) => p.id === id),
    send(to: string, pence: number, note: string): Payment {
      const payment: Payment = {
        id: `p${all().length + 1}`,
        name: to,
        category: 'Transfer',
        pence: -pence,
        date: new Date(),
        note: note || undefined,
      };
      setAll((payments) => [payment, ...payments]);
      return payment;
    },
  };
}
export type Ledger = ReturnType<typeof createLedger>;
export const Ledger = createServiceToken<Ledger>('wallet.ledger', createLedger);
