import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bootWallet, textOf, type Wallet } from './wallet-harness.ts';

async function start(
  t: { after(fn: () => void): void },
  options?: Parameters<typeof bootWallet>[0],
) {
  const w = bootWallet(options);
  t.after(() => w.root.dispose());
  await w.settle(() => w.pressables('button', /balance$/).length > 0, 'home');
  return w;
}
const ACCENT = 'rgb(225, 29, 72)';
const openSend = async (w: Wallet) => {
  w.press(w.pressables('button', 'Send money')[0]);
  await w.settle(() => w.byLabel('Amount').length > 0, 'send');
};
const openActivity = async (w: Wallet) => {
  w.press(w.pressables('link', 'See all')[0]);
  await w.settle(() => !!w.byTestId('search') && !!w.byTestId('payments'), 'activity');
};

for (const platform of ['ios', 'android'] as const) {
  test(`${platform}: the home screen shows the balance, the week and recent payments under a real tab bar`, async (t) => {
    const w = await start(t, { platform });
    const text = w.renderedText();
    for (const expected of ['Ada Lovelace', 'Total balance', 'VISA', 'Spent this week', 'Recent'])
      assert.ok(text.includes(expected), expected);
    assert.match(text, /Good (morning|afternoon|evening)/);
    assert.match(textOf(w.pressables('button', 'Hide balance')[0]!), /£[\d,]+\.\d\d/);
    // Four recent payments, newest first.
    assert.equal(w.pressables('button', /^.+ · /).length >= 4, true);
    assert.ok(w.nodes().some((n) => /^RNSTabsHost/.test(n.viewName)));
    const props = JSON.stringify(w.nodes().map((n) => n.props));
    for (const title of ['Home', 'Activity', 'Settings']) assert.ok(props.includes(title), title);
    if (platform === 'ios') assert.ok(props.includes('house.fill'));
    else assert.ok(props.includes('tab-home.png'));
    // The root carries the class the ios: and android: variants match.
    // `createNativeRoot` puts it on the surface root, the parent of everything the app commits.
    const surface = w.root.engine.root;
    assert.ok(surface.classes?.has(`platform-${platform}`));
    assert.ok(w.nodes().some((node) => node.instanceHandle.parent === surface));
    assert.deepEqual(w.errors, []);
  });
}

test('hides the balance when the card is tapped, and keeps the choice in the keychain', async (t) => {
  const w = await start(t);
  w.press(w.pressables('button', 'Hide balance')[0]);
  w.finish();
  assert.equal(w.byText('£ ••••••').length, 1);
  assert.equal(w.pressables('button', 'Show balance').length, 1);
  await w.settle(() => w.keychain.get('hide-balance') === 'true', 'keychain write');
});

test('a hidden balance stays hidden on the next launch', async (t) => {
  const w = await start(t, { keychain: new Map([['hide-balance', 'true']]) });
  assert.equal(w.byText('£ ••••••').length, 1);
});

test('sends money, and the payment is the first thing on the home screen', async (t) => {
  const w = await start(t);
  await openSend(w);
  w.type(w.byLabel('Recipient')[0], 'Grace Hopper');
  w.type(w.byLabel('Amount')[0], '12.50');
  const send = w.pressables('button', 'Send £12.50')[0];
  assert.ok(send);
  assert.equal(send.instanceHandle.props['data-disabled'], undefined);
  assert.notEqual(send.props['opacity'], 0.4);
  w.press(send);
  await w.settle(() => w.byLabel('Amount').length === 0, 'dismissal');
  assert.ok(w.byText('Grace Hopper').length > 0);
  assert.ok(w.byText('- £12.50').length > 0);
  assert.deepEqual(w.haptics, ['notify:success']);
});

test('will not send more than the balance', async (t) => {
  const w = await start(t);
  await openSend(w);
  w.type(w.byLabel('Amount')[0], '999999');
  assert.equal(w.byText('More than you have').length, 1);
  const send = w.pressables('button', 'Send £999,999.00')[0]!;
  // Component CSS: the submit fades while the form is invalid, and the touched field turns red.
  assert.equal(send.instanceHandle.props['data-disabled'], '');
  assert.equal(send.props['opacity'], 0.4);
  assert.equal(w.byLabel('Amount')[0]!.props['borderTopColor'], ACCENT);
  w.press(send);
  assert.deepEqual(w.haptics, ['notify:error']);
  assert.equal(w.byLabel('Amount').length, 1);
});

test('a quick amount fills the field, is marked selected, and plays a tick', async (t) => {
  const w = await start(t);
  await openSend(w);
  const chip = w.pressables('button', '£20')[0];
  w.press(chip);
  w.finish();
  assert.equal(w.byLabel('Amount')[0]!.props['text'], '20');
  const twenty = w.pressables('button', '£20')[0]!;
  const ten = w.pressables('button', '£10')[0]!;
  assert.equal(twenty.instanceHandle.props['data-selected'], '');
  assert.equal(twenty.props['borderTopColor'], ACCENT);
  assert.equal(ten.instanceHandle.props['data-selected'], undefined);
  assert.notEqual(ten.props['borderTopColor'], ACCENT);
  assert.equal(w.pressables('button', 'Send £20.00').length, 1);
  assert.deepEqual(w.haptics, ['select']);
  w.press(w.pressables('button', 'Cancel')[0]);
  await w.settle(() => w.byLabel('Amount').length === 0, 'cancel');
});

test('searches the activity list from the navigation bar', async (t) => {
  const w = await start(t);
  await openActivity(w);
  const list = () => w.byTestId('payments')!;
  assert.ok(w.byText('Pret', list()).length > 0);

  w.fabric.emit(w.byTestId('search')!, 'topChangeText', { text: 'spotify' });
  w.finish();

  assert.ok(w.byText('Spotify', list()).length > 0);
  assert.equal(w.byText('Pret', list()).length, 0);

  w.fabric.emit(w.byTestId('search')!, 'topChangeText', { text: 'nothing like this' });
  w.finish();
  assert.ok(w.renderedText().includes('No payments match "nothing like this"'));
});

test('hiding the balance in settings hides it on the home screen', async (t) => {
  const w = await start(t);
  await w.navigation().push('/settings');
  await w.settle(
    () => w.nodes().some((n) => n.viewName === 'RNSwitch' || n.viewName === 'AndroidSwitch'),
    'settings',
  );
  for (const label of ['Settings', 'Privacy', 'Notifications'])
    assert.equal(w.byText(label).length >= 1, true, label);
  const switches = w.nodes().filter((n) => n.instanceHandle.name === 'switch');
  assert.deepEqual(
    switches.map((n) => [n.props['accessibilityLabel'], n.props['value']]),
    [
      ['Hide balance', false],
      ['Payments', true],
      ['Salary arrived', true],
      ['Offers', false],
    ],
  );
  const toggle = switches[0];
  assert.ok(toggle);
  assert.equal(toggle.props['accessibilityRole'], 'switch');
  w.fabric.emit(toggle, 'topChange', { value: true });
  w.finish();
  await w.navigation().push('/home');
  w.finish();
  assert.equal(w.byText('£ ••••••').length, 1);
});

test('a payment opened from home goes back to home, and the activity list still opens one', async (t) => {
  const w = await start(t);
  w.press(w.pressables('button', /Blue Bottle/)[0]);
  await w.settle(() => w.byText('Category').length > 0, 'detail');
  assert.ok(w.byText('Coffee').length > 0);
  assert.ok(w.byText('•••• 4821').length > 0);

  await w.navigation().back();
  w.finish();
  await w.settle(() => w.byText('Category').length === 0, 'back');
  await openActivity(w);
  w.press(w.pressables('button', /Dishoom/, w.byTestId('payments'))[0]);
  await w.settle(() => w.byText('Eating out').length > 0 && w.byText('Category').length > 0);

  assert.equal(w.byText('Category').length, 1);
  assert.deepEqual(w.errors, []);
});

test('a link to a payment opens it over the tabs, and a missing one says so', async (t) => {
  const w = bootWallet({ launchUrl: 'wallet://payment/nope' });
  t.after(() => w.root.dispose());
  await w.settle(() => w.renderedText().includes('This payment no longer exists.'), 'link');
  const header = w
    .nodes()
    .find((n) => n.viewName === 'RNSScreenStackHeaderConfig' && n.props['title'] === 'Payment');
  assert.ok(header);
});

test('the system scheme puts the class the dark: variants match on the root', async (t) => {
  const dark = await start(t, { scheme: 'dark' });
  const light = await start(t, { scheme: 'light' });
  assert.equal(dark.root.engine.root.classes?.has('dark'), true);
  assert.notEqual(light.root.engine.root.classes?.has('dark'), true);
});
