import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bootMusic } from './music-harness.ts';

// Five journeys through the real Solid entry.
for (const platform of ['ios', 'android'] as const) {
  async function start(t: { after(fn: () => void): void }) {
    const h = bootMusic(platform);
    t.after(() => h.root.dispose());
    await h.idle();
    return h;
  }

  test(`${platform}: opens an album and starts playback, which shows the mini player`, async (t) => {
    const h = await start(t);
    await h.press('Drift');
    assert.ok(h.texts().includes('Low Tide'));
    await h.press('Play all');

    const mini = h.byTestId('mini-player');
    assert.ok(h.texts(mini).includes('Low Tide'));
    assert.ok(h.button('Pause', mini));
    assert.deepEqual(h.errors, []);
  });

  test(`${platform}: the mini player skips to the next track`, async (t) => {
    const h = await start(t);
    await h.press('Drift');
    await h.press('Play all');
    await h.press('Next', h.byTestId('mini-player'));
    assert.ok(h.texts(h.byTestId('mini-player')).includes('Open Water'));
  });

  test(`${platform}: tapping a track in the album plays from there, not from the top`, async (t) => {
    const h = await start(t);
    await h.press('Drift');
    await h.press(/Undertow/, h.byTestId('album-tracks'));
    assert.ok(h.texts(h.byTestId('mini-player')).includes('Undertow'));
  });

  test(`${platform}: the mini player opens Now Playing, with transport controls of its own`, async (t) => {
    const h = await start(t);
    await h.press('Drift');
    await h.press('Play all');
    await h.press('Now playing: Low Tide');

    const sheet = h
      .nodes()
      .filter((node) => node.viewName === 'RNSScreen')
      .at(-1)!;
    assert.equal(sheet.props['stackPresentation'], 'formSheet');
    assert.deepEqual(sheet.props['sheetAllowedDetents'], [1]);
    assert.equal(sheet.props['sheetGrabberVisible'], true);

    assert.ok(h.texts(h.byTestId('now-playing')).includes('Low Tide'));
    assert.ok(h.button('Pause', h.byTestId('now-playing')));
    await h.press('Next', h.byTestId('now-playing'));
    assert.ok(h.texts(h.byTestId('now-playing')).includes('Open Water'));

    await h.press('Close', h.byTestId('now-playing'));
    assert.equal(h.queryTestId('now-playing'), undefined);
    assert.ok(h.button('Play all'));
    assert.deepEqual(h.errors, []);
  });

  test(`${platform}: searching the library narrows the track list`, async (t) => {
    const h = await start(t);
    const search = h.byTestId('search');
    const count = (title: string) =>
      h.texts(h.byTestId('tracks')).filter((x) => x === title).length;
    assert.ok(count('First Light') > 0);

    h.fabric.emit(search, 'topChangeText', { text: 'blue hour' });
    await h.idle();

    assert.ok(count('Blue Hour') > 0);
    assert.equal(count('First Light'), 0);
    assert.ok(!h.texts().includes('Albums'));

    h.fabric.emit(search, 'topChangeText', { text: 'zzz' });
    await h.idle();
    assert.ok(h.texts().includes('No songs match "zzz"'));
  });
}
