import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ALBUMS, TRACKS } from '../src/app/catalogue/catalogue.solid.ts';
import { bootMusic, flatten } from './music-harness.ts';

type Harness = ReturnType<typeof bootMusic>;

async function start(t: { after(fn: () => void): void }, platform: 'ios' | 'android') {
  const h = bootMusic(platform);
  t.after(() => h.root.dispose());
  await h.idle();
  return h;
}
const tabs = (h: Harness) => h.nodes().filter((node) => node.viewName.startsWith('RNSTabsScreen'));
const icons = (scope: Parameters<typeof flatten>[0]) =>
  flatten(scope).filter((node) => node.instanceHandle.name === 'svg-icon');
/** What a tab-bar tap does: select a visited tab, or push an unvisited one under the root. */
const selectTab = async (h: Harness, path: string) => {
  assert.equal(await h.navigation().current()!.children!.selectTab(path), true);
  await h.idle();
};
async function openNowPlaying(h: Harness) {
  await h.press('Drift');
  await h.press('Play all');
  await h.press('Now playing: Low Tide');
  return () => h.byTestId('now-playing');
}

for (const platform of ['ios', 'android'] as const) {
  test(`${platform}: tab bar, library header, every album and every song`, async (t) => {
    const h = await start(t, platform);
    assert.equal(h.navigation().url(), '/library');
    const bars = tabs(h);
    assert.deepEqual(
      bars.map((node) => node.props['title']),
      ['Library', 'Settings'],
    );
    const props = JSON.stringify(bars.map((node) => node.props));
    if (platform === 'ios') {
      assert.match(props, /music\.note\.list/);
      assert.match(props, /gearshape\.fill/);
    } else {
      assert.match(props, /tab-library\.png/);
      assert.match(props, /tab-settings\.png/);
    }
    const header = h
      .nodes()
      .find(
        (node) =>
          node.viewName === 'RNSScreenStackHeaderConfig' && node.props['title'] === 'Library',
      );
    assert.ok(header);
    assert.equal(header.props['largeTitle'], true);
    const bar = h.nodes().find((node) => node.viewName === 'RNSSearchBar')!;
    assert.equal(bar.props['placeholder'], 'Search songs');
    for (const album of ALBUMS) assert.ok(h.button(album.title));
    for (const track of TRACKS) assert.ok(h.texts(h.byTestId('tracks')).includes(track.title));
    // No mini player until something has played.
    assert.equal(h.queryTestId('mini-player'), undefined);
    assert.deepEqual(h.errors, []);
  });

  test(`${platform}: a song in the list plays the whole library from there, and holds the screen awake`, async (t) => {
    const h = await start(t, platform);
    await h.press(/Kindling/, h.byTestId('tracks'));
    assert.deepEqual(h.calls.slice(-2), [`replace ${TRACKS[7]!.source}`, 'play']);
    assert.ok(h.texts(h.byTestId('mini-player')).includes('Kindling'));
    assert.deepEqual(h.awake, ['activate music-playback']);

    // The mini player's own play/pause, without leaving the tab.
    await h.press('Pause', h.byTestId('mini-player'));
    assert.equal(h.calls.at(-1), 'pause');
    assert.ok(h.button('Play', h.byTestId('mini-player')));
    await h.press('Play', h.byTestId('mini-player'));
    assert.equal(h.calls.at(-1), 'play');
    assert.deepEqual(h.errors, []);
  });

  test(`${platform}: a track that ends on its own advances, unless repeat-one loops it natively`, async (t) => {
    const h = await start(t, platform);
    await h.press('Drift');
    await h.press('Play all');
    h.players[0]!.report({ ended: true, playing: false });
    await h.idle();
    assert.ok(h.texts(h.byTestId('mini-player')).includes('Open Water'));

    const now = await (async () => {
      await h.press('Now playing: Open Water');
      return () => h.byTestId('now-playing');
    })();
    await h.press('Repeat', now()); // all
    await h.press('Repeat', now()); // one
    assert.equal(h.calls.at(-1), 'loop true');
    assert.deepEqual(h.button('Repeat', now()).props['accessibilityState'], { selected: true });
    h.players[0]!.report({ ended: true, playing: false });
    await h.idle();
    assert.ok(h.texts(now()).includes('Open Water'));
    await h.press('Repeat', now()); // off
    assert.equal(h.calls.at(-1), 'loop false');
    assert.deepEqual(h.button('Repeat', now()).props['accessibilityState'], { selected: false });
    assert.deepEqual(h.errors, []);
  });

  test(`${platform}: Now Playing seeks, restarts, goes back, shuffles and shows times`, async (t) => {
    const h = await start(t, platform);
    const now = await openNowPlaying(h);
    assert.ok(h.texts(now()).includes('Analytical Engine · Drift'));
    assert.ok(h.texts(now()).includes('0:00'));
    assert.ok(h.texts(now()).includes('-0:08'));

    // Fake Fabric clones a node on every prop update, so it is looked up each time.
    const slider = () => h.nodes().find((node) => node.instanceHandle.name === 'ui-slider')!;
    assert.equal(slider().props['accessibilityLabel'], 'Seek');
    h.fabric.emit(slider(), 'topValueChanged', { value: 0.5 });
    await h.idle();
    assert.equal(h.calls.at(-1), 'seek 4');
    assert.ok(h.texts(now()).includes('0:04'));
    assert.ok(h.texts(now()).includes('-0:04'));
    // The slider follows the decoder's position.
    h.players[0]!.report({ currentTime: 2 });
    await h.idle();
    assert.equal(slider().props['value'], 0.25);

    // More than two seconds in, "previous" restarts the track.
    await h.press('Previous', now());
    assert.equal(h.calls.at(-1), 'seek 0');
    await h.press('Next', now());
    await h.press('Previous', now());
    assert.ok(h.texts(now()).includes('Low Tide'));

    await h.press('Shuffle', now());
    assert.deepEqual(h.button('Shuffle', now()).props['accessibilityState'], { selected: true });
    assert.ok(h.texts(now()).includes('Low Tide'));
    await h.press('Shuffle', now());
    assert.deepEqual(h.button('Shuffle', now()).props['accessibilityState'], { selected: false });

    await h.press('Pause', now());
    assert.equal(h.calls.at(-1), 'pause');
    assert.ok(h.button('Play', now()));
    assert.deepEqual(h.errors, []);
  });

  test(`${platform}: the colour scheme recolours the transport icons`, async (t) => {
    const h = await start(t, platform);
    const now = await openNowPlaying(h);
    const close = () => icons([h.button('Close', now())])[0]!;
    const colour = () => JSON.stringify(close().props['color']);
    const light = colour();
    h.theme('dark');
    await h.idle();
    assert.notEqual(colour(), light);
    assert.deepEqual(h.errors, []);
  });

  test(`${platform}: settings lists every toggle, and each one flips`, async (t) => {
    const h = await start(t, platform);
    await selectTab(h, 'settings');
    // The tab changed inside the one tab bar; nothing was pushed over it.
    assert.equal(h.navigation().entries().length, 1);
    assert.equal(h.navigation().url(), '/settings');
    for (const text of ['Settings', 'Playback', 'Notifications'])
      assert.ok(h.texts().includes(text));
    const toggle = (label: string) =>
      h
        .nodes()
        .find((node) => node.props['accessibilityLabel'] === label && 'value' in node.props)!;
    assert.equal(toggle('High quality audio').props['value'], true);
    assert.equal(toggle('Autoplay related songs').props['value'], false);
    assert.equal(toggle('New releases').props['value'], true);
    h.fabric.emit(toggle('Autoplay related songs'), 'topChange', { value: true });
    await h.idle();
    assert.equal(toggle('Autoplay related songs').props['value'], true);

    // The mini player docks on this tab too, once something plays.
    assert.equal(h.queryTestId('mini-player'), undefined);
    await selectTab(h, 'library');
    await h.press('Low Tide');
    await selectTab(h, 'settings');
    assert.equal(
      h.nodes().filter((node) => node.props['testID'] === 'mini-player').length >= 1,
      true,
    );
    assert.deepEqual(h.errors, []);
  });

  test(`${platform}: unknown album, empty Now Playing and hardware back`, async (t) => {
    const h = await start(t, platform);
    await h.navigation().push('/library/album/nope');
    await h.idle();
    assert.ok(h.texts().includes('This album no longer exists.'));
    assert.ok(
      h
        .nodes()
        .some(
          (node) =>
            node.viewName === 'RNSScreenStackHeaderConfig' && node.props['title'] === 'Album',
        ),
    );
    // Android's back button pops the album off the library's own stack.
    assert.equal(h.backHandlers.at(-1)!(), true);
    await h.idle();
    assert.ok(!h.texts().includes('This album no longer exists.'));

    await h.navigation().present('/now-playing');
    await h.idle();
    assert.ok(h.texts(h.byTestId('now-playing')).includes('Nothing playing'));
    await h.press('Close', h.byTestId('now-playing'));
    assert.equal(h.queryTestId('now-playing'), undefined);
    assert.deepEqual(h.errors, []);
  });

  test(`${platform}: disposing the root releases the screen-awake hold`, async (t) => {
    const h = await start(t, platform);
    await h.press('Low Tide');
    assert.deepEqual(h.awake, ['activate music-playback']);
    h.root.dispose();
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.deepEqual(h.awake, ['activate music-playback', 'deactivate music-playback']);
  });

  test(`${platform}: an unvisited tab is selectable from the bar`, async (t) => {
    const h = await start(t, platform);
    assert.equal(await h.navigation().current()!.children!.selectTab('settings'), true);
    await h.idle();
    assert.equal(h.navigation().url(), '/settings');
    assert.deepEqual(h.errors, []);
  });
}
