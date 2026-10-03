import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { createRoot } from 'solid-js';
import {
  CARDS,
  CURRENCIES,
  TRANSACTIONS,
  RATES,
  CATEGORY_NAMES,
  CATEGORY_TONES,
  dailySpend,
  shares,
  money,
  createWallet,
} from '../src/app/wallet/wallet-model.solid.ts';
import { GROUPS, ROWS, NETWORKS, search } from '../src/app/settings/settings-model.solid.ts';
import {
  LOCALES,
  SCRIPTS,
  message,
  samples,
  pluralCategory,
} from '../src/app/world/world-model.solid.ts';
import { stressRows, FrameMonitor } from '../src/app/stress/stress-rows.solid.ts';
import { assertNativeSheets } from './native-sheets.ts';
import reference from './legacy-reference.json' with { type: 'json' };

// The original fixtures, helper outputs and CLDR cardinal rules, captured from the retired
// implementation when it was removed (legacy-reference.json).
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as unknown;
test('complete original fixtures and helpers remain: 12 settings rows, 4 networks, 3 cards, 11 transactions and all 10,000 stress rows', () => {
  const settings = reference.settings;
  assert.deepEqual(json({ GROUPS, ROWS, NETWORKS }), {
    GROUPS: settings.GROUPS,
    ROWS: settings.ROWS,
    NETWORKS: settings.NETWORKS,
  });
  assert.equal(ROWS.length, 12);
  assert.equal(NETWORKS.length, 4);
  for (const [query, expected] of Object.entries(settings.search))
    assert.deepEqual(json(search(query)), expected, query);
  const wallet = reference.wallet;
  assert.deepEqual(
    json({ CARDS, CURRENCIES, TRANSACTIONS, RATES, CATEGORY_NAMES, CATEGORY_TONES }),
    {
      CARDS: wallet.CARDS,
      CURRENCIES: wallet.CURRENCIES,
      TRANSACTIONS: wallet.TRANSACTIONS,
      RATES: wallet.RATES,
      CATEGORY_NAMES: wallet.CATEGORY_NAMES,
      CATEGORY_TONES: wallet.CATEGORY_TONES,
    },
  );
  assert.equal(CARDS.length, 3);
  assert.equal(TRANSACTIONS.length, 11);
  assert.deepEqual(json(dailySpend(TRANSACTIONS)), wallet.dailySpend);
  assert.deepEqual(json(shares(TRANSACTIONS)), wallet.shares);
  for (const currency of CURRENCIES)
    for (const pence of [1840, -290, 0, 824615])
      assert.equal(
        money(pence, currency),
        wallet.money[`${currency} ${pence}` as keyof typeof wallet.money],
      );
  assert.equal(money(1840, 'EUR'), '€21.53');
  assert.equal(money(1840, 'JPY'), 'JP¥3,459');
  const digest = createHash('sha256').update(JSON.stringify(stressRows())).digest('hex');
  assert.equal(digest, reference.stressRowsSha256);
  assert.equal(stressRows().length, 10000);
});
test('all seven locales and six script fixtures, samples and original cardinal rules work without Intl.PluralRules', (t) => {
  assert.deepEqual(json({ LOCALES, SCRIPTS }), reference.world);
  assert.equal(LOCALES.length, 7);
  assert.equal(SCRIPTS.length, 6);
  t.mock.method(Intl, 'PluralRules', () => {
    throw new Error('Hermes has no PluralRules');
  });
  for (const locale of LOCALES) {
    const rules = reference.pluralRules[locale.tag as keyof typeof reference.pluralRules];
    for (const [key, category] of Object.entries(rules)) {
      const count = Number(key);
      assert.equal(pluralCategory(locale.tag, count), category, `${locale.tag} ${count}`);
      const exact = count === 0 && locale.messages.zero ? 'zero' : category;
      const expected = (
        locale.messages[exact as Intl.LDMLPluralRule] ?? locale.messages.other
      ).replace('#', new Intl.NumberFormat(locale.tag).format(count));
      assert.equal(message(locale, count), expected);
    }
    const when = new Date('2026-09-25T14:30:00Z');
    const sample = samples(locale, when);
    assert.deepEqual(sample, {
      money: new Intl.NumberFormat(locale.tag, {
        style: 'currency',
        currency: locale.currency,
      }).format(1234.5),
      date: new Intl.DateTimeFormat(locale.tag, { dateStyle: 'full' }).format(when),
      number: new Intl.NumberFormat(locale.tag).format(12345678.9),
    });
  }
});
test('wallet state recalculates balance, currencies, week and category shares under real client reactivity', () =>
  createRoot((dispose) => {
    const wallet = createWallet();
    assert.equal(wallet.balance(), 1109311);
    wallet.setCurrency('EUR');
    assert.equal(wallet.format(wallet.balance()), '€12,978.94');
    wallet.setTransactions([
      ...TRANSACTIONS,
      { id: 'late', merchant: 'Train', category: 'transport', amount: -1000, daysAgo: 0 },
    ]);
    assert.equal(wallet.days()[6], 3130);
    assert.equal(wallet.balance(), 1108311);
    assert.ok(Math.abs(wallet.categories().reduce((sum, part) => sum + part.share, 0) - 1) < 1e-12);
    dispose();
  }));
test('all six sheets, composed shared settings CSS included, compile on iOS and Android', () => {
  assertNativeSheets([
    'settings/settings-page',
    'settings/settings-detail',
    'wallet/wallet-page',
    'world/world-page',
    'stress/stress-list',
    'navigation/regressions',
  ]);
});
test('frame monitor cancels pending frames and rejects queued callbacks from stopped and superseded measurements', (t) => {
  const frames = new Map<number, FrameRequestCallback>();
  let next = 0,
    now = 0;
  const raf = globalThis.requestAnimationFrame,
    caf = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => {
    frames.set(++next, callback);
    return next;
  };
  globalThis.cancelAnimationFrame = (id: number | null | undefined) => {
    if (id != null) frames.delete(id);
  };
  t.after(() => {
    globalThis.requestAnimationFrame = raf;
    globalThis.cancelAnimationFrame = caf;
  });
  t.mock.method(performance, 'now', () => now);
  const monitor = new FrameMonitor();
  monitor.start();
  const old = frames.get(next)!;
  now = 30;
  old(now);
  assert.deepEqual(monitor.stop(), { frames: 1, late: 1, worst: 30 });
  const callbacks = frames.size;
  old(70);
  assert.equal(frames.size, callbacks);
  monitor.start();
  old(100);
  assert.deepEqual(monitor.stop(), { frames: 0, late: 0, worst: 0 });
});
