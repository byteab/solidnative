import { createComputed, createMemo, onCleanup, untrack } from 'solid-js';
import type { NativeSyntheticEvent } from '@solidnative/fabric';
import { createServiceToken, useService } from '@solidnative/device/solid';
import { createNativeRef, type ViewProps } from '@solidnative/components/solid';
import { optional } from '../native.ts';
import { registerExpoView } from '../register-expo-view.ts';
import { nativeView, viewProps } from './view.ts';
import { viewFunctions, viewTarget } from './g11-features-view.ts';

/** The separate browser page uses the existing JSON bridge; native never renders React. */
registerExpoView('dom-component', 'ExpoDomWebViewModule');
export type DomComponentOutputHandler = (value: never) => void;
export interface WebViewFunctions {
  injectJavaScript(this: { nativeTag: number }, script: string): Promise<void>;
}
export interface DomComponentSource {
  readonly baseUrl: string | null;
  readonly functions: WebViewFunctions | null;
}
export interface DomComponentReference {
  readonly domComponent: string;
}
export interface DomComponentProps extends ViewProps {
  src: DomComponentReference;
  inputs?: Readonly<Record<string, unknown>>;
  outputs?: Readonly<Record<string, DomComponentOutputHandler>>;
  foreground?: () => boolean;
  onError?: (error: Error) => void;
  webviewDebuggingEnabled?: boolean;
}
const SOURCE = createServiceToken<DomComponentSource>('expo.domComponent.source', () => {
  const base = optional(() => require('expo/src/dom/base') as { getBaseURL(): string });
  return {
    baseUrl: optional(() => base?.getBaseURL() ?? null),
    functions: viewFunctions<WebViewFunctions>('ExpoDomWebViewModule'),
  };
});
type PageMessage =
  | { type: 'ready'; outputs: string[] }
  | { type: 'output'; name: string; value: unknown }
  | { type: 'error'; message: string };
export const DomComponent = Object.assign(
  (props: DomComponentProps) => {
    const native = useService(SOURCE);
    let active = true;
    let ready = false;
    let declared: readonly string[] = [];
    let revision = 0;
    onCleanup(() => {
      active = false;
      ready = false;
      revision++;
    });
    const page = createMemo(() => {
      props.src;
      ready = false;
      declared = [];
      revision++;
      return JSON.stringify({ inputs: untrack(() => props.inputs ?? {}) });
    });
    const name = () => props.src.domComponent.split('?')[0]!;
    const checkOutputs = () => {
      for (const key of Object.keys(props.outputs ?? {})) {
        if (!declared.includes(key))
          throw new Error(
            `<dom-component>: ${name()} has no output '${key}' (its outputs: ${declared.join(', ') || 'none'}).`,
          );
      }
    };
    let target!: ReturnType<typeof viewTarget>;
    const report = (error: unknown) => {
      if (!active) return;
      const failure = error instanceof Error ? error : new Error(String(error));
      if (props.onError) props.onError(failure);
      else console.error(failure);
    };
    const send = (inputs: Readonly<Record<string, unknown>>) => {
      const tag = target.tag();
      if (!ready || !active || !native.functions || tag === null) return;
      const request = revision;
      const message = JSON.stringify({ type: 'inputs', inputs });
      if (!active || request !== revision || !target.live()) return;
      try {
        void Promise.resolve(
          native.functions.injectJavaScript.call(
            { nativeTag: tag },
            `window.__solidNative && window.__solidNative.receive(${message}); true;`,
          ),
        ).catch((error) => {
          if (request === revision) report(error);
        });
      } catch (error) {
        report(error);
      }
    };
    const dispatchOutput = (message: Extract<PageMessage, { type: 'output' }>) => {
      if (ready && declared.includes(message.name))
        props.outputs?.[message.name]?.(message.value as never);
    };
    const receive = (event: NativeSyntheticEvent<{ data: string }>) => {
      if (!active || !target.live()) return;
      const message = JSON.parse(event.nativeEvent.data) as PageMessage;
      if (message.type === 'ready') {
        if (!Array.isArray(message.outputs))
          throw new Error('Malformed DOM component ready message.');
        declared = message.outputs;
        checkOutputs();
        ready = true;
        send(props.inputs ?? {});
      } else if (message.type === 'output') {
        dispatchOutput(message);
      } else if (message.type === 'error') {
        const error = new Error(`<dom-component> ${name()}: ${message.message}`);
        if (props.onError) props.onError(error);
        else throw error;
      }
    };
    const node = nativeView(
      'dom-component',
      {
        get children() {
          return props.children;
        },
      },
      () => ({
        ...viewProps(props, [
          'src',
          'inputs',
          'outputs',
          'foreground',
          'onError',
          'webviewDebuggingEnabled',
        ]),
        source:
          native.baseUrl === null ? null : { uri: `${native.baseUrl}/${props.src.domComponent}` },
        injectedJavaScriptObject: page(),
        webviewDebuggingEnabled:
          props.webviewDebuggingEnabled ?? (typeof __DEV__ === 'undefined' || __DEV__),
        onMessage: receive,
      }),
    );
    target = viewTarget(node, props.foreground);
    props.ref?.(createNativeRef(node));
    createComputed(() => {
      const inputs = props.inputs ?? {};
      props.foreground?.();
      props.outputs;
      if (ready) {
        checkOutputs();
        untrack(() => send(inputs));
      }
    });
    return node;
  },
  { SOURCE },
);
declare const __DEV__: boolean | undefined;
