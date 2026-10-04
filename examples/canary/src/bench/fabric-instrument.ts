/**
 * The typed way into the instrument, which is a Metro polyfill: see `instrument.js` for why
 * it has to be one, and `metro.config.js` for where it is added.
 */
interface Instrument {
  fabric: never;
  restore(): void;
  begin(name: string): void;
  report(): string;
}

function instrument(): Instrument | undefined {
  return (globalThis as { __bench?: Instrument }).__bench;
}

/** The instrumented Fabric, to hand a renderer that takes one. */
export function wrappedFabric(): never {
  return instrument()!.fabric;
}

/** Put the real host object back on the global, now React's renderer has captured what it needs. */
export function restoreFabric(): void {
  instrument()?.restore();
}

/**
 * How long every side spins the CPU before a phase. After the 400 ms between steps a core has
 * cooled, and how much a renderer's own work warms it before Fabric is reached is the renderer's
 * size, not its speed: React's 17 ms of reconciling a small update ran its Fabric calls warm and
 * Solid's 2 ms did not. The same spin first for both measures the step instead.
 */
const WARM_MS = 15;

export function beginPhase(name: string): void {
  const end = performance.now() + WARM_MS;
  while (performance.now() < end) {
    // spinning
  }
  instrument()?.begin(name);
}

export function report(): string {
  return instrument()?.report() ?? 'no instrument';
}

/**
 * The report, also written to `bench.txt` in the app's documents, for a physical device: its
 * JavaScript log is in the system log, which `devicectl` cannot stream, but it can copy a file
 * out of the app's container. See `run-device.sh`.
 */
export function saveReport(line: string): void {
  try {
    const { File, Paths } = require('expo-file-system') as typeof import('expo-file-system');
    const file = new File(Paths.document, 'bench.txt');
    if (!file.exists) file.create();
    file.write(line);
  } catch (error) {
    console.error(`[bench] could not save the report: ${String(error)}`);
  }
}
