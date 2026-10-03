import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bootRuns } from './runs-harness.tsx';

type Runs = ReturnType<typeof bootRuns>;

async function start(t: { after(fn: () => void): void }, options?: Parameters<typeof bootRuns>[0]) {
  const h = bootRuns(options);
  t.after(() => h.root.dispose());
  await h.waitFor(() => h.byTestId('elapsed') !== undefined, 'the run screen never opened');
  return h;
}
const elapsed = (h: Runs) => h.textOf(h.byTestId('elapsed')!);
/** Waits for the elapsed-time stat to read something other than the start value. */
const waitForProgress = (h: Runs) =>
  h.waitFor(() => elapsed(h) !== '0:00', 'the simulated route never moved the clock');

for (const platform of ['ios', 'android'] as const) {
  test(`${platform}: the run screen opens on the run tab, idle, with an empty clock`, async (t) => {
    const h = await start(t, { platform });
    assert.equal(h.navigation().url(), '/run');
    assert.equal(elapsed(h), '0:00');
    assert.equal(h.textOf(h.byTestId('distance')!), '0.00');
    assert.equal(h.textOf(h.byTestId('pace')!), '--:--');
    assert.equal(h.textOf(h.byTestId('unit')!), 'km');
    assert.ok(h.button('Start run'));
    // Three native tabs, and the map under the panel.
    const tabs = h.nodes().filter((node) => node.viewName.startsWith('RNSTabsScreen'));
    assert.equal(tabs.length, 3);
    assert.ok(h.nodes().some((node) => node.viewName === 'RNSSafeAreaView'));
    assert.match(JSON.stringify(h.nodes().map((node) => node.props)), /figure\.run/);
    assert.deepEqual(h.errors, []);
  });
}

test('starting a run moves the stats as the simulated route plays, and holds the screen awake', async (t) => {
  const h = await start(t);
  h.press('Start run');
  await waitForProgress(h);
  assert.ok(h.button('Pause run'));
  assert.ok(h.button('Finish run'));
  assert.notEqual(h.textOf(h.byTestId('distance')!), '0.00');
  await h.waitFor(() => h.natives.keepAwake.includes('+run-recording'));
  // The route is drawn and followed as it records.
  const map = h.nodes().find((node) => Array.isArray(node.props['polylines']));
  assert.ok(map);
  assert.equal((map.props['markers'] as { id: string }[])[0]!.id, 'current');
  assert.deepEqual(h.errors, []);
});

test('pausing a run holds the stats, and resuming continues them', async (t) => {
  const h = await start(t);
  h.press('Start run');
  await waitForProgress(h);
  h.press('Pause run');
  await h.waitFor(() => h.natives.keepAwake.includes('-run-recording'));
  const paused = elapsed(h);
  const distance = h.textOf(h.byTestId('distance')!);
  // Held for a moment: nothing arrives from the source while paused, so nothing changes.
  await new Promise((resolve) => setTimeout(resolve, 50));
  h.finish();
  assert.equal(elapsed(h), paused);
  assert.equal(h.textOf(h.byTestId('distance')!), distance);
  h.press('Resume run');
  assert.ok(h.button('Pause run'));
  await h.waitFor(() => h.textOf(h.byTestId('distance')!) !== distance);
});

test('finishing a run pushes its detail screen, with a GPX export button, then back to Run', async (t) => {
  const h = await start(t);
  h.press('Start run');
  await waitForProgress(h);
  h.press('Finish run');
  await h.waitFor(() => h.navigation().url().startsWith('/runs/'));
  await h.waitFor(() => h.button('Export as GPX') !== undefined);
  assert.match(h.renderedText(), /Time/);
  assert.ok(h.nodes().some((node) => node.viewName === 'RNSScreenStackHeaderConfig'));

  h.press('Export as GPX');
  await h.waitFor(() => h.natives.shares.length === 1);
  const [share] = h.natives.shares;
  assert.match(share!.url!, /^file:\/\/\/cache\/run-\d{4}-\d{2}-\d{2}-r.*\.gpx$/);
  const [gpx] = [...h.natives.written.values()];
  assert.match(gpx!, /<gpx version="1.1"/);

  assert.equal(await h.navigation().back(), true);
  await h.waitFor(() => h.navigation().url() === '/run');
  await h.waitFor(() => h.button('Start run') !== undefined);
  assert.equal(elapsed(h), '0:00');
  assert.deepEqual(h.errors, []);
});

test('a finished run appears at the top of History, which lists the seeded runs', async (t) => {
  const h = await start(t);
  h.press('Start run');
  await waitForProgress(h);
  h.press('Finish run');
  await h.waitFor(() => h.navigation().url().startsWith('/runs/'));
  const id = h.navigation().url().slice('/runs/'.length);
  await h.navigation().back();
  await h.waitFor(() => h.navigation().url() === '/run');

  assert.equal(await h.navigation().push('/history'), true);
  await h.waitFor(() => h.navigation().url() === '/history');
  await h.waitFor(() => (h.renderedText().match(/splits?/g) ?? []).length > 5);
  const rows = h
    .nodes()
    .filter(
      (node) =>
        node.instanceHandle.name === 'pressable' && node.props['accessibilityRole'] === 'button',
    )
    .filter((node) => /splits?/.test(h.textOf(node)));
  assert.equal(rows.length, 6);
  assert.ok(
    h
      .nodes()
      .some((node) => node.props['title'] === 'History' && node.props['largeTitle'] === true),
  );

  // Tapping the newest row opens the run just finished.
  h.press(h.textOf(rows[0]!));
  await h.waitFor(() => h.navigation().url() === `/runs/${id}`);
  assert.deepEqual(h.errors, []);
});

test('switching units in Settings changes how distance is shown on Run, and persists', async (t) => {
  const h = await start(t);
  assert.equal(await h.navigation().push('/settings'), true);
  await h.waitFor(() => h.button('mi') !== undefined);
  assert.match(h.renderedText(), /Distance and pace/);
  h.press('mi');
  await h.waitFor(() => h.natives.stored.get('runs.unit') === '"mi"');
  assert.equal(await h.navigation().push('/run'), true);
  await h.waitFor(() => h.textOf(h.byTestId('unit')!) === 'mi');
  assert.match(h.renderedText(), /Pace \/mi/);
});

test('the developer switch turns the simulated route off, and Run then asks for location', async (t) => {
  const h = await start(t);
  assert.doesNotMatch(h.renderedText(), /Location access needed/);
  await h.navigation().push('/settings');
  await h.waitFor(() => /Simulate location/.test(h.renderedText()));
  const toggle = h.nodes().find((node) => node.props['accessibilityLabel'] === 'Simulate location');
  assert.ok(toggle);
  assert.equal(toggle.props['value'], true);
  h.fabric.emit(toggle, 'topChange', { value: false });
  await h.waitFor(() => h.natives.stored.get('runs.simulateLocation') === 'false');
  await h.navigation().push('/run');
  await h.waitFor(() => /Location access needed/.test(h.renderedText()));
  h.press('Allow location');
  await h.waitFor(() => h.natives.locationRequests.length === 1);
  await h.waitFor(() => !/Location access needed/.test(h.renderedText()));
});

test('a saved unit and the dark scheme are honoured from launch', async (t) => {
  const h = await start(t, {
    natives: { stored: new Map([['runs.unit', '"mi"']]), scheme: 'dark' },
  });
  await h.waitFor(() => h.textOf(h.byTestId('unit')!) === 'mi');
  h.press('Start run');
  await h.waitFor(() => h.button('Pause run') !== undefined);
  // The secondary control's icon follows the scheme, which CSS cannot reach.
  assert.match(JSON.stringify(h.button('Pause run')!.children.map((c) => c.props)), /fafafa/);
});

test('a run that no longer exists says so', async (t) => {
  const h = await start(t);
  assert.equal(await h.navigation().push('/runs/missing'), true);
  await h.waitFor(() => /This run no longer exists\./.test(h.renderedText()));
  assert.equal(h.button('Export as GPX'), undefined);
});

test('leaving the app mid-run discards the run and releases everything', async (t) => {
  const h = await start(t);
  h.press('Start run');
  await waitForProgress(h);
  h.root.dispose();
  assert.deepEqual(h.fabric.roots.get(1), []);
  assert.deepEqual(h.errors, []);
});
