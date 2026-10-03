/**
 * The messages between a lesson page and its preview frame, both ways. The frame is
 * `learn-preview.html`, sandboxed without `allow-same-origin`, so the learner's code runs in an
 * opaque origin and cannot reach the site's cookies, storage or the lesson page. Messages are the
 * only way between the two, and each side checks both the window a message came from and its
 * origin:
 *
 * - The lesson page posts with target `'*'`, since an opaque origin has no name to target, and
 *   takes a message only from its own frame's window with origin `'null'`.
 * - The frame posts to, and takes messages only from, its parent at `location.origin`, which is
 *   still the site's: a sandboxed document keeps its URL, only its origin is opaque.
 *
 * Every module, chunk and WebAssembly file the frame loads is therefore a cross-origin request, so
 * `/assets/*` is served with `Access-Control-Allow-Origin: *`. See `public/_headers`.
 */
import type { CheckOutcome } from './preview/test-runner.ts';
import type { Problem } from './preview/program.ts';
import type { TestOutcome } from './check.ts';

export type { CheckOutcome, Problem, TestOutcome };

export type Platform = 'ios' | 'android';
export type Scheme = 'light' | 'dark';

export type Files = Readonly<Record<string, string>>;

export interface Appearance {
  readonly scheme: Scheme;
  readonly xray: boolean;
}

/** How long each part of the last run took, in milliseconds. */
export interface RunTimings {
  /** Scoping the `.native.css` files for the phone. */
  readonly styles: number;
  readonly compile: number;
  readonly mount: number;
  readonly total: number;
}

export type ToPreview =
  | {
      readonly type: 'run';
      readonly id: number;
      readonly files: Files;
      readonly entry: string;
      /**
       * The files as the lesson started. The native CSS notes wait until the stylesheets or the
       * Tailwind classes differ from these: a lesson's own starting point has nothing to report.
       */
      readonly baseline?: Files;
    }
  | { readonly type: 'appearance'; readonly appearance: Appearance }
  | { readonly type: 'test'; readonly id: number; readonly files: Files; readonly file: string }
  | {
      readonly type: 'check';
      readonly id: number;
      readonly files: Files;
      readonly checks: string;
      readonly step: number;
    };

export type FromPreview =
  | { readonly type: 'ready'; readonly platform: Platform }
  /** Every second, from the frame's own event loop: it is not stuck. See `preview-client.ts`. */
  | { readonly type: 'alive' }
  | {
      readonly type: 'ran';
      readonly id: number;
      readonly ok: boolean;
      readonly problems: readonly Problem[];
      readonly timings?: RunTimings;
    }
  /** Something went wrong after a run finished: a press handler threw, or a warning was logged. */
  | { readonly type: 'problem'; readonly problem: Problem }
  /**
   * What a device would say that a browser does not: the native CSS compiler's errors and
   * warnings, and the engine's own development warnings. Arrives after `ran`, once checked.
   */
  | { readonly type: 'notes'; readonly notes: readonly Problem[] }
  | { readonly type: 'tested'; readonly id: number; readonly outcomes: readonly TestOutcome[] }
  | { readonly type: 'checked'; readonly id: number; readonly outcomes: readonly CheckOutcome[] };
