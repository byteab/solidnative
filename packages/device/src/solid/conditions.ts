import { getOwner, onCleanup } from 'solid-js';
import type { Conditions, TokenValue } from '@solidnative/fabric';
import { reactNative } from '../react-native.ts';
import { conditionSources, type ConditionSources } from './condition-sources.ts';

/** A CSS-capable host, without coupling device sources to the concrete Fabric engine. */
export interface ConditionHost<Node> {
  readonly root: Node;
  updateConditions(conditions: Conditions): void;
  addClass(node: Node, name: string): void;
  removeClass(node: Node, name: string): void;
  remeasureText?(): void;
}
export interface WatchOptions {
  readonly darkClass?: boolean;
  readonly sources?: ConditionSources;
}

export function currentConditions(sources: ConditionSources = conditionSources()): Conditions {
  const { window } = sources.screen.current();
  return {
    width: window.width,
    height: window.height,
    colorScheme: sources.colors.current(),
    reducedMotion: false,
  };
}

/** Density is fixed for the application lifetime; safe-area tokens belong to their providers. */
export function deviceTokens(
  source: () => number | undefined = () => reactNative()?.StyleSheet.hairlineWidth,
): Record<string, TokenValue> {
  const width = source();
  return width === undefined ? {} : { '--hairline': { length: width } };
}

/**
 * Subscribes before snapshots. A current Solid owner releases the watcher automatically.
 * Bootstrap callers outside an owner must bind the returned disposer to native root teardown.
 */
export function watchConditions<Node>(
  engine: ConditionHost<Node>,
  options: WatchOptions = {},
): () => void {
  const sources = options.sources ?? conditionSources();
  let active = true;
  const stops: (() => void)[] = [];
  const stop = () => {
    if (!active) return;
    active = false;
    // Complete every removal even if one native subscription throws.
    const errors: unknown[] = [];
    for (const remove of stops.splice(0).reverse()) {
      try {
        remove();
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length) throw new AggregateError(errors, 'Condition source cleanup failed.');
  };
  if (getOwner()) onCleanup(stop);
  let conditions: Conditions = { width: 0, height: 0, colorScheme: 'light', reducedMotion: false };
  let scale = sources.fontScale();
  let initializing = true;
  // What the engine already resolves under: the snapshot it was created from, then each update.
  // A push that changes nothing is not sent - every update re-resolves and commits the whole tree.
  let sent = conditions;
  let dark = false;
  const push = (change: Partial<Conditions>) => {
    if (!active) return;
    conditions = { ...conditions, ...change };
    if (initializing) return;
    if (options.darkClass !== false && (conditions.colorScheme === 'dark') !== dark) {
      dark = !dark;
      if (dark) engine.addClass(engine.root, 'dark');
      else engine.removeClass(engine.root, 'dark');
    }
    if (
      conditions.width === sent.width &&
      conditions.height === sent.height &&
      conditions.colorScheme === sent.colorScheme &&
      conditions.reducedMotion === sent.reducedMotion
    )
      return;
    sent = conditions;
    engine.updateConditions(conditions);
  };
  const rescale = (next: number) => {
    if (!active || next === scale) return;
    scale = next;
    engine.remeasureText?.();
  };
  const watch = (subscribe: () => () => void) => {
    if (!active) return;
    const remove = subscribe();
    if (active) stops.push(remove);
    else remove();
  };
  let screenHeard = false;
  let colorHeard = false;
  let motionHeard = false;
  let scaleHeard = false;
  try {
    watch(() =>
      sources.screen.subscribe(({ window }) => {
        screenHeard = true;
        scaleHeard = true;
        if (!active) return;
        rescale(sources.fontScale());
        push({ width: window.width, height: window.height });
      }),
    );
    watch(() =>
      sources.colors.subscribe((colorScheme) => {
        colorHeard = true;
        push({ colorScheme });
      }),
    );
    watch(() =>
      sources.settings.subscribe((change) => {
        if (change.fontScale !== undefined) {
          scaleHeard = true;
          rescale(change.fontScale);
        }
        if (change.reduceMotion !== undefined) {
          motionHeard = true;
          push({ reducedMotion: change.reduceMotion });
        }
      }),
    );
    if (!active) return stop;
    const { window } = sources.screen.current();
    if (!screenHeard) push({ width: window.width, height: window.height });
    const colorScheme = sources.colors.current();
    if (!colorHeard) push({ colorScheme });
    // The same reads `currentConditions` gives the engine at creation; only events heard while
    // subscribing differ from it.
    sent = { width: window.width, height: window.height, colorScheme, reducedMotion: false };
    void Promise.resolve(sources.settings.current()).then(
      (settings) => {
        if (!active) return;
        if (!scaleHeard) rescale(settings.fontScale);
        if (!motionHeard) push({ reducedMotion: settings.reduceMotion });
      },
      () => {},
    );
    initializing = false;
    push({});
  } catch (error) {
    try {
      stop();
    } catch {
      /* Preserve the original construction failure. */
    }
    throw error;
  }
  return stop;
}
