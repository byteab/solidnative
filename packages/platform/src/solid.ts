/** The native renderer module for Solid's universal JSX transform. */
export {
  createNativeRoot,
  mountNative,
  type NativeRoot,
  type NativeRootOptions,
  type NativeChild,
} from './solid/root.ts';
export { onNativeCleanup } from './solid/context.ts';
export { retirer, settler, type Retire } from './solid/retire.ts';
export {
  withHostAdapter,
  useHostAdapter,
  useHostEngine,
  createHostElement,
  spreadHostProps,
  insertHostChildren,
  onHostCleanup,
  afterHostCommit,
  type HostAdapter,
  type HostChild,
} from './solid/host-context.ts';
export { withNativeStyles, setNativeStyleHost } from './solid/styles.ts';
export type { NativeClock } from './solid/scheduler.ts';
export { spread } from './solid/renderer.ts';
import { renderer } from './solid/renderer.ts';

export const {
  createElement,
  createTextNode,
  insertNode,
  insert,
  setProp,
  effect,
  memo,
  createComponent,
  mergeProps,
  use,
} = renderer;

export {
  For,
  Show,
  Index,
  Switch,
  Match,
  ErrorBoundary,
  Suspense,
  SuspenseList,
  Defer,
} from './solid/control-flow.ts';
