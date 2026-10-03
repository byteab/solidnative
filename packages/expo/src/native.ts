/**
 * Reaching an Expo module without importing one.
 *
 * A static `import ... from 'expo-battery'` makes the file unloadable by Node, which is what used
 * to force every service into two files: the behaviour somewhere the test suite could reach, and
 * the binding somewhere it could not. A `require` inside a function has neither problem. Metro
 * still resolves the string literal at build time, so the module is bundled exactly as before and
 * an app that has not installed it still gets a build error rather than a surprise at runtime;
 * Node never evaluates the call at all, because nothing in a test asks for the real platform.
 *
 * The `catch` is doing two jobs, and only one of them is Node. In an ESM test `require` is not
 * defined, so calling it throws `ReferenceError` and the service goes inert - the same state as
 * a device that has no such sensor. On a device the throw is a module that is present but not
 * linked, which is the same answer for the same reason.
 */
export function optional<T>(load: () => T): T | null {
  try {
    return load();
  } catch {
    return null;
  }
}

/** The platforms an Expo module is written for. */
export type ModulePlatform = 'ios' | 'android' | 'web';

/**
 * A module the app needs and does not have: the package is not installed, or it is and the app was
 * not rebuilt since, so its native half is not in the binary. Development builds and Expo Go carry
 * only the native modules they were built with.
 */
export class MissingModuleError extends Error {
  override readonly name = 'MissingModuleError';
  /** The package, as it is installed: `expo-haptics`. */
  readonly module: string;

  constructor(module: string, platform: ModulePlatform, cause?: unknown) {
    super(
      platform === 'web'
        ? `${module} is not installed. Install it with "npx expo install ${module}", then restart the dev server.`
        : `${module} is not in this build of the app. Install it with "npx expo install ${module}", ` +
            `then rebuild the app ("npx expo run:${platform}", or a new EAS build): a development ` +
            `build, and Expo Go, contain only the native modules they were built with.`,
      { cause },
    );
    this.module = module;
  }
}

/** The platform the app is running on, or null in Node, where there is none to ask. */
function currentPlatform(): ModulePlatform | null {
  return optional(
    () => (require('react-native') as { Platform: { OS: string } }).Platform.OS as ModulePlatform,
  );
}

/**
 * The Expo module a service needs.
 *
 * Where the module exists for the platform the app is on, a module that is missing is a mistake
 * the developer can fix, so this throws a `MissingModuleError` that says how - rather than leave a
 * feature that silently does nothing. Anywhere it cannot exist - an iOS-only module on Android, the
 * web, and Node, where a test runs with no platform at all - this answers null, and the service
 * goes inert, as code shared across platforms needs it to.
 *
 * `load` answering null or undefined counts as missing too: `requireOptionalNativeModule` answers
 * null rather than throwing.
 */
export function expoModule<T>(
  module: string,
  load: () => T | null | undefined,
  platforms: readonly ModulePlatform[] = ['ios', 'android'],
): T | null {
  let failure: unknown;
  try {
    const loaded = load();
    if (loaded != null) return loaded;
  } catch (error) {
    failure = error;
  }
  const platform = currentPlatform();
  if (platform === null || !platforms.includes(platform)) return null;
  throw new MissingModuleError(module, platform, failure);
}
