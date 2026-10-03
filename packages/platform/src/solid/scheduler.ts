import type { Engine } from '@solid-native/fabric';

export interface NativeClock {
  queueMicrotask(callback: () => void): void;
  requestFrame(callback: (timestamp: number) => void): unknown;
  cancelFrame(handle: unknown): void;
}

interface SchedulerOptions {
  readonly clock?: NativeClock;
  readonly report: (error: unknown, source: string) => void;
  readonly beforeCommit: () => void;
}

const defaultClock: NativeClock = {
  queueMicrotask: (callback) => globalThis.queueMicrotask(callback),
  requestFrame: (callback) =>
    globalThis.requestAnimationFrame
      ? globalThis.requestAnimationFrame(callback)
      : setTimeout(() => callback(globalThis.performance?.now() ?? Date.now()), 16),
  cancelFrame(handle) {
    if (globalThis.cancelAnimationFrame) globalThis.cancelAnimationFrame(handle as number);
    else clearTimeout(handle as ReturnType<typeof setTimeout>);
  },
};

/** Reactive work uses microtasks; CSS animation frames retain their own clock. */
export function createNativeScheduler(engine: Engine, options: SchedulerOptions) {
  const clock = options.clock ?? defaultClock;
  const callbacks = new Set<() => void>();
  let disposed = false;
  let flushing = false;
  let queued = false;
  let generation = 0;
  let framePending = false;
  let frame: unknown;

  function report(error: unknown, source: string): void {
    try {
      options.report(error, source);
    } catch {
      // Error reporting must not escape a native frame or prevent later cleanup/callbacks.
    }
  }

  function schedule(): void {
    if (disposed || flushing || queued) return;
    queued = true;
    const ticket = ++generation;
    clock.queueMicrotask(() => {
      if (disposed || !queued || ticket !== generation) return;
      queued = false;
      flush();
    });
  }

  function scheduleFrame(): void {
    if (disposed || framePending) return;
    framePending = true;
    frame = clock.requestFrame((timestamp) => {
      framePending = false;
      if (!disposed) performFlush(timestamp);
    });
  }

  function runCallbacks(pending: readonly (() => void)[]): void {
    for (const callback of pending) {
      if (disposed) return;
      if (!callbacks.delete(callback)) continue;
      try {
        callback();
      } catch (error) {
        report(error, 'after commit');
      }
    }
  }

  function continueWork(frameFlush: boolean): void {
    if (engine.animating || (frameFlush && engine.pending)) scheduleFrame();
    if (callbacks.size || (!frameFlush && engine.pending)) schedule();
  }

  function performFlush(timestamp?: number): boolean {
    if (disposed || flushing) return false;
    flushing = true;
    queued = false;
    generation++;
    const pending = [...callbacks];
    let committed = false;
    let succeeded = false;
    try {
      if (timestamp !== undefined) engine.advanceAnimations(timestamp);
      options.beforeCommit();
      if (!disposed) {
        committed = engine.commit();
        succeeded = true;
        // A clean tree is already committed: barriers need no empty completeRoot call.
        runCallbacks(pending);
      }
    } catch (error) {
      report(error, 'native commit');
    } finally {
      flushing = false;
    }
    if (succeeded && !disposed) continueWork(timestamp !== undefined);
    return committed;
  }

  function flush(): boolean {
    return performFlush();
  }

  function afterCommit(callback: () => void): () => void {
    if (disposed) return () => {};
    // Separate registration identities let the same function be registered more than once.
    const entry = () => callback();
    callbacks.add(entry);
    schedule();
    return () => {
      callbacks.delete(entry);
    };
  }

  /** A callback on the next frame, cancelled with the root; returns its cancel. */
  function requestFrame(callback: () => void): () => void {
    if (disposed) return () => {};
    let live = true;
    const handle = clock.requestFrame(() => {
      if (!live || disposed) return;
      live = false;
      try {
        callback();
      } catch (error) {
        report(error, 'frame');
      }
    });
    return () => {
      if (!live) return;
      live = false;
      clock.cancelFrame(handle);
    };
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    queued = false;
    generation++;
    callbacks.clear();
    if (framePending) clock.cancelFrame(frame);
    framePending = false;
    engine.setOnDirty(() => {});
  }

  engine.setOnDirty(schedule);
  return { schedule, flush, afterCommit, requestFrame, dispose };
}
