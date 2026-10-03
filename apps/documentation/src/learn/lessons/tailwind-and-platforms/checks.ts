import type { NativeRoot } from '@solidnative/platform/solid';
import { render, screen, settle, type FakeFabricNode } from '@solidnative/testing';
import { expect } from 'vitest';
import { check, parentOf } from '../../check.ts';
import { App } from './solution/app.tsx';
import { HabitRow } from './solution/habit-row.tsx';

/**
 * Restyle a render as if it were on `platform`: swap the class on the root, which is all that
 * `ios:` and `android:` match, so one run can compare the two.
 */
async function asPlatform({ root }: { root: NativeRoot }, platform: 'ios' | 'android') {
  root.engine.removeClass(root.engine.root, 'platform-ios');
  root.engine.removeClass(root.engine.root, 'platform-android');
  root.engine.addClass(root.engine.root, `platform-${platform}`);
  await settle();
}

/**
 * Put a render in dark mode as the phone does: the `dark` class on the root, which `dark:`
 * matches, and which `watchConditions` keeps in step with the system on a device.
 */
async function inDark({ root }: { root: NativeRoot }, dark: boolean) {
  if (dark) root.engine.addClass(root.engine.root, 'dark');
  else root.engine.removeClass(root.engine.root, 'dark');
  await settle();
}

/** A text's own props and its row's, as they are committed now. */
const looks = (roots: readonly FakeFabricNode[], text: string) => {
  const node = screen.getByText(text);
  return { text: node.props, row: parentOf(roots, node)?.props };
};

const usesStylesheet = /withNativeStyles|\.native\.css/;

check(
  1,
  'The screen is styled with Tailwind, not a stylesheet',
  ({ file }) => {
    expect(file('app.tsx')).not.toMatch(usesStylesheet);
    const { fabric } = render(App);
    const title = screen.getByText('Today');
    expect(title.props['fontSize']).toBeGreaterThanOrEqual(24);
    // Set either way: bold on iOS, and android:font-medium on Android.
    expect(title.props['fontWeight']).toBeDefined();
    const screenView = parentOf(fabric.committed, title);
    expect(screenView?.props['backgroundColor']).toBeDefined();
    expect(screenView?.props['rowGap']).toBeGreaterThan(0);
  },
  'Take withNativeStyles and the stylesheet out of app.tsx, and give its elements classes: flex-1 gap-2 bg-zinc-100 px-5 pt-safe on the view, text-3xl font-bold on the title.',
  { readsStyles: true },
);

check(
  2,
  'The row is styled with Tailwind too',
  ({ file }) => {
    expect(file('habit-row.tsx')).not.toMatch(usesStylesheet);
    const { fabric } = render(HabitRow, { props: { name: 'Stretch' } });
    const row = parentOf(fabric.committed, screen.getByText('Stretch'));
    expect(row?.props['flexDirection']).toBe('row');
    expect(row?.props['justifyContent']).toBe('space-between');
    expect(row?.props['borderTopLeftRadius']).toBeGreaterThan(0);
  },
  'Take the stylesheet out of habit-row.tsx too, and give the pressable flex-row justify-between rounded-xl bg-white p-4 active:bg-zinc-200.',
  { readsStyles: true },
);

check(
  2,
  'The row changes color while it is touched',
  async () => {
    const { fabric } = render(HabitRow, { props: { name: 'Stretch' } });
    const row = () => parentOf(fabric.committed, screen.getByText('Stretch'))!;
    const resting = row().props['backgroundColor'];
    fabric.emit(screen.getByText('Stretch'), 'topTouchStart', {
      touches: [{}],
      changedTouches: [{}],
    });
    await settle();
    expect(row().props['backgroundColor']).not.toEqual(resting);
    fabric.emit(screen.getByText('Stretch'), 'topTouchEnd', { touches: [], changedTouches: [{}] });
    await settle();
    expect(row().props['backgroundColor']).toEqual(resting);
  },
  'Give the pressable active:bg-zinc-200, which applies while a finger is on it.',
  { readsStyles: true },
);

check(
  3,
  'The title and the count look different on iOS and on Android',
  async () => {
    const result = render(App);
    await asPlatform(result, 'ios');
    const ios = [
      looks(result.fabric.committed, 'Today'),
      looks(result.fabric.committed, '2 left to do'),
    ];
    await asPlatform(result, 'android');
    const android = [
      looks(result.fabric.committed, 'Today'),
      looks(result.fabric.committed, '2 left to do'),
    ];
    expect(android.map((look) => look.text)).not.toEqual(ios.map((look) => look.text));
  },
  'Add an ios: class and an android: class to the title or the count, such as android:text-2xl on the title and ios:uppercase on the count.',
  { readsStyles: true },
);

check(
  3,
  'The row has squarer corners on Android',
  async () => {
    const result = render(HabitRow, { props: { name: 'Stretch' } });
    await asPlatform(result, 'ios');
    const ios = looks(result.fabric.committed, 'Stretch').row?.['borderTopLeftRadius'];
    await asPlatform(result, 'android');
    const android = looks(result.fabric.committed, 'Stretch').row?.['borderTopLeftRadius'];
    expect(android).toBeLessThan(ios as number);
  },
  'Add android:rounded-md to the pressable in habit-row.tsx.',
  { readsStyles: true },
);

check(
  4,
  'The screen follows the phone into dark mode',
  async () => {
    const result = render(App);
    const looksNow = () => ({
      title: screen.getByText('Today').props['color'],
      screen: parentOf(result.fabric.committed, screen.getByText('Today'))?.props[
        'backgroundColor'
      ],
      row: parentOf(result.fabric.committed, screen.getByText('Drink water'))?.props[
        'backgroundColor'
      ],
    });
    const light = looksNow();
    await inDark(result, true);
    const dark = looksNow();
    expect(dark.title).not.toEqual(light.title);
    expect(dark.screen).not.toEqual(light.screen);
    expect(dark.row).not.toEqual(light.row);
    await inDark(result, false);
    expect(looksNow()).toEqual(light);
  },
  'Add dark: classes: dark:bg-black on the screen, dark:text-white on the title, and dark:bg-zinc-900 on the row.',
  { readsStyles: true },
);
