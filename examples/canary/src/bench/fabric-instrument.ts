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

export function beginPhase(name: string): void {
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
