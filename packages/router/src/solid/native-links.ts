import { batch, createRenderEffect, createSignal, getOwner, onCleanup } from 'solid-js';
import type { NativeNavigation } from './native-navigation.ts';

export type LinkParent = (url: string) => string | null;

/** Outermost first. Cycles stop before a path repeats. */
export function linkAncestry(url: string, parentOf: LinkParent): string[] {
  const chain: string[] = [];
  const seen = new Set([url]);
  for (let parent = parentOf(url); parent; parent = parentOf(parent)) {
    if (seen.has(parent)) break;
    if (seen.size > 128) throw new Error('Native link ancestry exceeds 128 parents.');
    seen.add(parent);
    chain.unshift(parent);
  }
  return chain;
}

/** One atomic preparation/staging transaction; native settles the complete ancestry proposal. */
export function followLink(
  navigation: NativeNavigation,
  url: string,
  parentOf: LinkParent,
): Promise<boolean> {
  if (navigation.url() === url && navigation.current()) return Promise.resolve(true);
  const chain = linkAncestry(url, parentOf);
  const from = chain.indexOf(navigation.url());
  return navigation.pushStack([...chain.slice(from + 1), url]);
}

/** Structural contracts allow default device tokens or app-owned source implementations. */
export interface NavigationLinks {
  readonly ready: Promise<void>;
  initialUrl(): string | null;
  subscribe(listener: (path: string) => void): () => void;
}
export interface NavigationBack {
  handle(answer: () => boolean): () => void;
}
export interface NativeNavigationBindingOptions {
  readonly links?: NavigationLinks;
  readonly back?: NavigationBack;
  readonly initialPath?: string;
  readonly parentOf?: LinkParent;
  readonly onError?: (error: unknown) => void;
}
export interface NativeNavigationBinding {
  /** First startup route staged or refused; native animation completion is separate. */
  readonly ready: Promise<boolean>;
  dispose(): void;
}

/** Subscribe before startup resolution and retain the latest link while native is transitioning. */
export function bindNativeNavigation(
  navigation: NativeNavigation,
  options: NativeNavigationBindingOptions = {},
): NativeNavigationBinding {
  if (!getOwner()) throw new Error('bindNativeNavigation requires an active Solid owner.');
  const [queued, setQueued] = createSignal<string>();
  const [started, setStarted] = createSignal(false);
  const [working, setWorking] = createSignal(false);
  let active = true;
  let completeStartup!: (result: boolean) => void;
  const ready = new Promise<boolean>((resolve) => {
    completeStartup = resolve;
  });
  const report = (error: unknown) => {
    try {
      options.onError?.(error);
    } catch {
      /* Reporting must not reject native callbacks. */
    }
  };
  const stops: (() => void)[] = [];
  const binding = {
    ready,
    dispose() {
      if (!active) return;
      active = false;
      for (const stop of stops.splice(0).reverse()) {
        try {
          stop();
        } catch (error) {
          report(error);
        }
      }
      completeStartup(false);
    },
  };
  onCleanup(binding.dispose);
  const acquire = (subscribe: () => () => void) => {
    if (!active) return;
    const stop = subscribe();
    if (active) stops.push(stop);
    else {
      try {
        stop();
      } catch (error) {
        report(error);
      }
    }
  };
  try {
    if (options.links)
      acquire(() =>
        options.links!.subscribe((path) => {
          if (!active) return;
          batch(() => {
            setQueued(path);
            setStarted(true);
          });
        }),
      );
    if (options.back)
      acquire(() =>
        options.back!.handle(() => {
          if (!active || navigation.disposed) return false;
          if (navigation.busy()) return true;
          if (!navigation.canGoBack()) return false;
          void navigation.back().catch(report);
          return true;
        }),
      );
  } catch (error) {
    binding.dispose();
    throw error;
  }
  if (!active) return binding;
  createRenderEffect(() => {
    const path = queued();
    if (
      !active ||
      navigation.disposed ||
      !started() ||
      working() ||
      navigation.busy() ||
      path === undefined
    )
      return;
    setWorking(true);
    setQueued(undefined);
    let work: Promise<boolean>;
    try {
      work = followLink(navigation, path, options.parentOf ?? (() => null));
    } catch (error) {
      report(error);
      work = Promise.resolve(false);
    }
    void work
      .then(completeStartup, (error) => {
        report(error);
        completeStartup(false);
      })
      .finally(() => {
        if (active) setWorking(false);
      });
  });
  async function startup(): Promise<void> {
    try {
      await options.links?.ready;
      if (!active || started()) return;
      setQueued((value) => value ?? options.links?.initialUrl() ?? options.initialPath ?? '/');
      setStarted(true);
    } catch (error) {
      report(error);
      completeStartup(false);
    }
  }
  void startup();
  return binding;
}
