/**
 * The fake `nativeFabricUIManager`, and a Testing Library on top of it, for Solid components on
 * solid-native. Kept out of the engine so nothing in a shipped bundle can reach it.
 *
 * Run under `node --import @solidnative/testing/register --test`, which compiles Solid TSX and
 * `.native.css` as Metro does and stands in for the native gesture and animation libraries.
 */
export {
  createClock,
  createFakeFabric,
  type FakeFabric,
  type FakeFabricNode,
  type ManualClock,
} from './test-utils.ts';
export {
  cleanup,
  flushRenders,
  render,
  renderWith,
  screen,
  settle,
  waitForElementToBeRemoved,
  within,
  type ComponentRenderResult,
  type HostOptions,
  type Mountable,
  type RenderHost,
  type RenderOptions,
  type RenderResult,
} from './render.ts';
export type { BoundQueries, ByRoleOptions, Matcher, TextMatchOptions } from './queries.ts';
export { waitFor, type WaitForOptions } from './wait-for.ts';
export { gestureOf } from './gesture-of.ts';
export type { TestGesture } from './gesture-handler.ts';
export {
  fireEvent,
  userEvent,
  type EventPayload,
  type TypeOptions,
  type UserEvent,
} from './events.ts';
