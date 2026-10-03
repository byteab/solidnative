import { createMemo, createSignal } from 'solid-js';
import { createServiceToken } from '@solid-native/device/solid';

export type Currency = 'GBP' | 'EUR' | 'USD' | 'JPY';
export type Category = 'food' | 'transport' | 'shopping' | 'bills' | 'income';

/** How many of each currency a pound buys. Fixed: this is a canary, not a bank. */
export const RATES: Record<Currency, number> = { GBP: 1, EUR: 1.17, USD: 1.27, JPY: 188 };

export const CURRENCIES = Object.keys(RATES) as Currency[];

export interface Card {
  readonly id: string;
  readonly name: string;
  readonly last4: string;
  readonly holder: string;
  /** The card's colour, bound as a CSS variable its gradient, glow and chip derive from. */
  readonly tone: string;
}

export interface Transaction {
  readonly id: string;
  readonly merchant: string;
  readonly category: Category;
  /** In pence; spending is negative. */
  readonly amount: number;
  /** Days ago: 0 is today. */
  readonly daysAgo: number;
}

export const CATEGORY_TONES: Record<Category, string> = {
  food: '#f97316',
  transport: '#0ea5e9',
  shopping: '#d946ef',
  bills: '#64748b',
  income: '#16a34a',
};

export const CATEGORY_NAMES: Record<Category, string> = {
  food: 'Food',
  transport: 'Transport',
  shopping: 'Shopping',
  bills: 'Bills',
  income: 'Income',
};

export const CARDS: readonly Card[] = [
  { id: 'everyday', name: 'Everyday', last4: '4821', holder: 'A. Morgan', tone: '#7c3aed' },
  { id: 'travel', name: 'Travel', last4: '0917', holder: 'A. Morgan', tone: '#0d9488' },
  { id: 'saver', name: 'Saver', last4: '3360', holder: 'A. Morgan', tone: '#e11d48' },
];

const t = (id: string, merchant: string, category: Category, amount: number, daysAgo: number) =>
  ({ id, merchant, category, amount, daysAgo }) satisfies Transaction;

export const TRANSACTIONS: readonly Transaction[] = [
  t('t1', 'Borough Market', 'food', -1840, 0),
  t('t2', 'TfL', 'transport', -290, 0),
  t('t3', 'Salary', 'income', 312500, 1),
  t('t4', 'Oxfam Books', 'shopping', -650, 1),
  t('t5', 'Thames Water', 'bills', -3420, 2),
  t('t6', 'Pret', 'food', -745, 2),
  t('t7', 'Uber', 'transport', -1320, 3),
  t('t8', 'Uniqlo', 'shopping', -4999, 4),
  t('t9', 'Dishoom', 'food', -5260, 5),
  t('t10', 'Octopus Energy', 'bills', -8900, 6),
  t('t11', 'Lime', 'transport', -380, 6),
];

/** Pence, in a currency, as money is written in the UK: `£18.40`, `¥3,459`. */
export function money(pence: number, currency: Currency): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(
    (pence / 100) * RATES[currency],
  );
}

/** What was spent on each of the last seven days, oldest first, in pence. */
export function dailySpend(transactions: readonly Transaction[]): number[] {
  const days = Array.from({ length: 7 }, () => 0);
  for (const one of transactions) {
    if (one.amount < 0 && one.daysAgo < 7) days[6 - one.daysAgo]! += -one.amount;
  }
  return days;
}

/** Each spending category's share of what was spent, largest first. */
export function shares(
  transactions: readonly Transaction[],
): { category: Category; pence: number; share: number }[] {
  const totals = new Map<Category, number>();
  for (const one of transactions) {
    if (one.amount < 0) totals.set(one.category, (totals.get(one.category) ?? 0) - one.amount);
  }
  const spent = [...totals.values()].reduce((sum, pence) => sum + pence, 0);
  return [...totals]
    .map(([category, pence]) => ({ category, pence, share: spent ? pence / spent : 0 }))
    .sort((a, b) => b.pence - a.pence);
}

export function createWallet() {
  const [currency, setCurrency] = createSignal<Currency>('GBP');
  const [card, setCard] = createSignal<Card>(CARDS[0]!);
  const [transactions, setTransactions] = createSignal<readonly Transaction[]>(TRANSACTIONS);
  const balance = createMemo(
    () => 824_615 + transactions().reduce((sum, one) => sum + one.amount, 0),
  );
  const days = createMemo(() => dailySpend(transactions()));
  const categories = createMemo(() => shares(transactions()));
  return {
    currency,
    setCurrency,
    card,
    setCard,
    transactions,
    setTransactions,
    balance,
    days,
    categories,
    format: (pence: number) => money(pence, currency()),
  };
}
export type Wallet = ReturnType<typeof createWallet>;
export const Wallet = createServiceToken<Wallet>('canary.wallet', createWallet);
