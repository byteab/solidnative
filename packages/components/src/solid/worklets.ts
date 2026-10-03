import type { ScrollPayload } from '../events.ts';
import type { SharedValue, WorkletScrollSpec, WorkletStyleSpec } from './animation-bindings.ts';

export type { SharedValue, WorkletScrollSpec, WorkletStyleSpec } from './animation-bindings.ts';
export function workletStyle<const T extends readonly SharedValue<unknown>[]>(
  values: T,
  updater: (...values: T) => Record<string, unknown>,
): WorkletStyleSpec {
  return { values, updater };
}
export function workletScroll<const T extends readonly SharedValue<unknown>[]>(
  values: T,
  handler: (event: ScrollPayload, ...values: T) => void,
): WorkletScrollSpec {
  return { values, handler };
}
