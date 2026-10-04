/**
 * The benchmark's instrument, as a Metro polyfill.
 *
 * It has to be a polyfill, and that is the whole reason this file is not TypeScript beside the
 * rest of the benchmark. React's Fabric renderer destructures the Fabric methods off the global at
 * module scope, and `RendererImplementation` imports it during `InitializeCore` - before a single
 * line of app code runs. A polyfill is the only thing earlier than that.
 *
 * The wrapper must not stay on the global: `UIManagerBinding::getBinding` reads
 * `nativeFabricUIManager` and casts it straight back to its C++ host object, on every event
 * dispatch among other things, and a plain JavaScript object there is not an error, it is a
 * segfault inside UIKit a few frames later. So the app's first module calls `restore()`, by which
 * point React is holding the wrapped functions and native is holding its own object again.
 *
 * Polyfills run outside the module system, so there is no import and no export: the API goes on
 * the global, and `bench/fabric-instrument.ts` is the typed way in.
 */
(function installBenchInstrument(global) {
  'use strict';

  var fabric = global.nativeFabricUIManager;
  global.__benchPolyfill = { ran: true, fabric: !!fabric };
  if (!fabric) return;

  var METHODS = [
    'createNode',
    'cloneNodeWithNewChildren',
    'cloneNodeWithNewProps',
    'cloneNodeWithNewChildrenAndProps',
    'appendChild',
    'createChildSet',
    'appendChildToSet',
    'completeRoot',
  ];

  var done = [];
  var open = null;
  /**
   * When the first line of JavaScript ran, which a polyfill is the earliest to see. On the native
   * clock directly: `performance` is not installed until React Native's own setup runs, after this.
   */
  var clock = global.nativePerformanceNow || Date.now;
  var bootStart = clock();
  var bootMs = null;

  /** Hermes' own GC accounting, in ms, so a phase that paid for a collection says so. */
  /** Bytes allocated so far, garbage and all: what drives the collector. */
  function allocated() {
    var stats = global.HermesInternal && global.HermesInternal.getInstrumentedStats;
    return stats ? stats().js_totalAllocatedBytes || 0 : 0;
  }

  function gcMs() {
    var stats = global.HermesInternal && global.HermesInternal.getInstrumentedStats;
    if (!stats) return 0;
    var s = stats();
    return (
      (s.js_gcTime || s.js_totalGCTime || 0) *
      (s.js_gcTime !== undefined && s.js_gcTime < 1000 ? 1000 : 1)
    );
  }

  var wrapped = Object.create(fabric);
  METHODS.forEach(function (name) {
    var original = fabric[name];
    if (typeof original !== 'function') return;
    wrapped[name] = function () {
      var started = performance.now();
      var result = original.apply(fabric, arguments);
      if (open) {
        var spent = performance.now() - started;
        open.inside += spent;
        open.calls[name] = (open.calls[name] || 0) + 1;
        open.times[name] = (open.times[name] || 0) + spent;
        // The commit closes the phase: a renderer is done when Fabric has the finished tree.
        if (name === 'completeRoot') {
          open.span = performance.now() - open.startedAt;
          open.gc = gcMs() - open.gcAt;
          open.alloc = allocated() - open.allocAt;
          done.push(open);
          open = null;
        }
      }
      return result;
    };
  });

  global.nativeFabricUIManager = wrapped;

  global.__bench = {
    /** The instrumented Fabric, for a renderer that can simply be handed one. */
    fabric: wrapped,

    /** Put the real host object back, once React's renderer has taken what it needs. */
    restore: function () {
      global.nativeFabricUIManager = fabric;
    },

    /** Start measuring. The next `completeRoot` ends it. */
    begin: function (name) {
      // The first phase opens as the root component starts to render: everything before it is the
      // bundle evaluating and the framework booting.
      if (bootMs === null) bootMs = clock() - bootStart;
      open = {
        name: name,
        span: 0,
        inside: 0,
        gc: 0,
        gcAt: gcMs(),
        alloc: 0,
        allocAt: allocated(),
        calls: {},
        times: {},
        startedAt: performance.now(),
      };
    },

    /** One line per phase: what it cost, and how much of that was Fabric and not the renderer. */
    /** The raw stats keys, once, so the GC unit above can be checked. */
    gcKeys: function () {
      var stats = global.HermesInternal && global.HermesInternal.getInstrumentedStats;
      return stats ? JSON.stringify(stats()) : 'no HermesInternal.getInstrumentedStats';
    },

    report: function () {
      if (!done.length) return 'no phases recorded - the renderer never reached the wrapper';
      var boot =
        'boot: ' +
        (bootMs === null ? '?' : bootMs.toFixed(1)) +
        'ms until the root component renders\n';
      return (
        boot +
        done
          .map(function (phase) {
            var created = phase.calls['createNode'] || 0;
            var cloned =
              (phase.calls['cloneNodeWithNewChildren'] || 0) +
              (phase.calls['cloneNodeWithNewProps'] || 0) +
              (phase.calls['cloneNodeWithNewChildrenAndProps'] || 0);
            var renderer = phase.span - phase.inside;
            return (
              phase.name +
              ': ' +
              phase.span.toFixed(1) +
              'ms (renderer ' +
              renderer.toFixed(1) +
              ', fabric ' +
              phase.inside.toFixed(1) +
              ' [create ' +
              (phase.times['createNode'] || 0).toFixed(1) +
              ', complete ' +
              (phase.times['completeRoot'] || 0).toFixed(1) +
              ', append ' +
              (phase.times['appendChild'] || 0).toFixed(1) +
              ']' +
              ', gc ' +
              phase.gc.toFixed(1) +
              ', ' +
              (phase.alloc / 1048576).toFixed(1) +
              'MB allocated' +
              '), ' +
              created +
              ' created, ' +
              cloned +
              ' cloned'
            );
          })
          .join('\n')
      );
    },
  };
})(globalThis);
