import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRoot } from 'solid-js';
import { createLedger, dayOf, money, toPence } from '../src/app/payments/ledger.solid.ts';
import { partOfDay, spendingByDay } from '../src/app/home/home.solid.tsx';

test('money is pounds and pence, with thousands separated', () => {
  assert.equal(money(124_050), '£1,240.50');
  assert.equal(money(-480, { signed: true }), '- £4.80');
  assert.equal(money(320_000, { signed: true }), '+ £3,200.00');
});

test('an amount is read the way people type one', () => {
  assert.equal(toPence('12'), 1200);
  assert.equal(toPence('£1,200.5'), 120_050);
  assert.ok(Number.isNaN(toPence('12.345')));
  assert.ok(Number.isNaN(toPence('twelve')));
});

test('a payment is dated today, yesterday, or by day and month', () => {
  const today = new Date(2026, 8, 14, 9);
  assert.equal(dayOf(new Date(2026, 8, 14, 23), today), 'Today');
  assert.equal(dayOf(new Date(2026, 8, 13, 1), today), 'Yesterday');
  assert.equal(dayOf(new Date(2026, 8, 12), today), '12 Sep');
});

test('the greeting follows the hour, and the week chart scales to the busiest day', () => {
  assert.equal(partOfDay(new Date(2026, 0, 1, 9)), 'morning');
  assert.equal(partOfDay(new Date(2026, 0, 1, 13)), 'afternoon');
  assert.equal(partOfDay(new Date(2026, 0, 1, 20)), 'evening');
  const today = new Date(2026, 8, 14, 9);
  const week = spendingByDay(
    [
      { pence: -1000, date: new Date(2026, 8, 14, 12) },
      { pence: -500, date: new Date(2026, 8, 13, 12) },
      { pence: 320_000, date: new Date(2026, 8, 13, 12) },
    ],
    today,
  );
  assert.deepEqual(
    week.map((day) => [day.name, day.pence, day.height, day.today]),
    [
      ['T', 0, 6, false],
      ['W', 0, 6, false],
      ['T', 0, 6, false],
      ['F', 0, 6, false],
      ['S', 0, 6, false],
      ['S', 500, 40, false],
      ['M', 1000, 80, true],
    ],
  );
});

test('the ledger keeps four months of history, newest first, and a sent payment comes first', () => {
  createRoot((dispose) => {
    const ledger = createLedger();
    const before = ledger.balance();
    assert.ok(ledger.payments().length > 200);
    assert.ok(ledger.payments().some((p) => p.name === 'Salary'));
    const sent = ledger.send('Grace Hopper', 1250, '');
    assert.equal(ledger.payments()[0], sent);
    assert.equal(sent.category, 'Transfer');
    assert.equal(sent.note, undefined);
    assert.equal(ledger.balance(), before - 1250);
    assert.equal(ledger.find(sent.id), sent);
    dispose();
  });
});
