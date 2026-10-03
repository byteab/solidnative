import { DeepLinks, provideService, type ConditionSources } from '@solidnative/device';
import type { NativeNavigation } from '@solidnative/router';
import { fireEvent, renderWith, waitFor, type FakeFabricNode } from '@solidnative/testing';
import { mountApp } from '../bootstrap.solid.tsx';

export interface StartOptions {
  readonly scheme?: 'light' | 'dark';
  readonly launchUrl?: string | null;
  /** Android in a test file of its own: a process that renders for Android stays on it. */
  readonly platform?: 'ios' | 'android';
}

const flatten = (nodes: readonly FakeFabricNode[]): FakeFabricNode[] =>
  nodes.flatMap((node) => [node, ...flatten(node.children)]);

/**
 * The real entry's mount on a fake Fabric, with the device's conditions and links faked, waiting
 * for the first screen. Tests drive it through the same events native sends.
 */
export async function startApp(options: StartOptions = {}) {
  let navigation: NativeNavigation | undefined;
  const errors: unknown[] = [];
  const conditions: ConditionSources = {
    screen: {
      current: () => ({ window: { width: 402, height: 874 }, screen: { width: 402, height: 874 } }),
      subscribe: () => () => {},
    },
    colors: { current: () => options.scheme ?? 'light', subscribe: () => () => {} },
    settings: { current: () => ({ reduceMotion: false, fontScale: 1 }), subscribe: () => () => {} },
    fontScale: () => 1,
  };
  const app = renderWith(
    ({ fabric, rootTag, clock }) =>
      mountApp({
        fabric,
        rootTag,
        clock,
        conditions,
        engineOptions: { onError: (error) => errors.push(error) },
        onNavigation: (value) => (navigation = value),
        services: [
          provideService(DeepLinks.SOURCE, () => ({
            launchUrl: async () => options.launchUrl ?? null,
            subscribe: () => () => {},
            open() {},
          })),
        ],
      }),
    { platform: options.platform },
  );
  const nodes = () => flatten(app.fabric.committed);

  /** Tell every native stack its push or pop animation finished, as the device would. */
  async function finishTransitions() {
    for (const stack of nodes().filter((node) => node.viewName === 'RNSScreenStack'))
      await fireEvent(stack, 'topFinishTransitioning');
  }

  let provenance = 0;
  /** A tap on a tab bar item: native reports the selection, the router follows. */
  async function selectTab(path: string) {
    await fireEvent(app.getByTestId('tabs'), 'topTabSelected', {
      selectedScreenKey: path,
      provenance: ++provenance,
    });
  }

  /**
   * Wait until `find` succeeds with no navigation in flight, finishing stack transitions while
   * either is not so.
   */
  async function until<T>(find: () => T): Promise<T> {
    return waitFor(
      async () => {
        await finishTransitions();
        const found = find();
        if (!navigation?.current() || navigation.busy()) throw new Error('Still navigating.');
        return found;
      },
      // Startup alone can pass waitFor's 1s default on a loaded machine.
      { timeout: 5000 },
    );
  }

  await until(() => undefined);
  return {
    ...app,
    errors,
    nodes,
    navigation: () => navigation!,
    finishTransitions,
    selectTab,
    until,
  };
}
