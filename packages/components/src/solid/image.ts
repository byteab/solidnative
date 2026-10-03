import { createMemo } from 'solid-js';
import type { HostNode, NativeSyntheticEvent } from '@solidnative/fabric';
import { spreadHostProps, useHostEngine } from '@solidnative/platform/solid';
import type { Insets, ImageLoadEvent, ImageErrorEvent, ImageProgressEvent } from '../events.ts';
import { hostProps, primitiveNode } from './primitive.ts';
import { createNativeRef } from './ref.ts';
import type { ViewProps } from './types.ts';

/** A remote or local image, or several at different scales for native to choose between. */
export interface ImageURISource {
  readonly uri: string;
  readonly width?: number;
  readonly height?: number;
  readonly scale?: number;
  readonly headers?: Readonly<Record<string, string>>;
  readonly method?: string;
  readonly body?: string;
  readonly cache?: 'default' | 'reload' | 'force-cache' | 'only-if-cached';
}
/** A `require()`d asset compiles to a number; the host resolves it at commit time. */
export type ImageSource = number | ImageURISource | readonly ImageURISource[];

export type ImageResizeMode = 'cover' | 'contain' | 'stretch' | 'repeat' | 'center' | 'none';

export interface ImageProps extends Omit<ViewProps, 'children'> {
  source?: ImageSource;
  src?: string;
  srcSet?: string;
  defaultSource?: ImageSource;
  loadingIndicatorSource?: ImageURISource;
  resizeMode?: ImageResizeMode;
  resizeMethod?: 'auto' | 'resize' | 'scale' | 'none';
  resizeMultiplier?: number;
  blurRadius?: number;
  capInsets?: Insets;
  tintColor?: string;
  fadeDuration?: number;
  progressiveRenderingEnabled?: boolean;
  alt?: string;
  crossOrigin?: 'anonymous' | 'use-credentials';
  referrerPolicy?: string;
  accessibilityIgnoresInvertColors?: boolean;
  onLoad?: (event: ImageLoadEvent) => void;
  onError?: (event: ImageErrorEvent) => void;
  onProgress?: (event: ImageProgressEvent) => void;
  onLoadStart?: (event: NativeSyntheticEvent) => void;
  onLoadEnd?: (event: NativeSyntheticEvent) => void;
}

function srcSources(props: ImageProps): ImageURISource[] {
  const sources = (props.srcSet ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [uri, descriptor] = s.split(/\s+/);
      const scale = descriptor?.endsWith('x') ? Number(descriptor.slice(0, -1)) : 1;
      return { uri: uri!, scale: Number.isFinite(scale) ? scale : 1 };
    });
  if (props.src && !sources.some((s) => s.scale === 1)) sources.push({ uri: props.src, scale: 1 });
  return sources;
}

function withHeaders(sources: ImageURISource[], headers: Record<string, string>) {
  if (!sources.length) return undefined;
  return Object.keys(headers).length
    ? sources.map((source) => ({ ...source, headers: { ...source.headers, ...headers } }))
    : sources;
}

export function Image(props: ImageProps): HostNode {
  const node = primitiveNode('image');
  const engine = useHostEngine();
  const fromSource = createMemo<readonly ImageURISource[]>(() => {
    if (props.source === undefined) return [];
    if (Array.isArray(props.source)) return props.source;
    const resolved = engine.resolveAsset(props.source) as ImageURISource | undefined;
    return resolved ? [resolved] : [];
  });
  spreadHostProps(
    node,
    () => {
      const headers: Record<string, string> = {};
      if (props.crossOrigin === 'use-credentials')
        headers['Access-Control-Allow-Credentials'] = 'true';
      if (props.referrerPolicy) headers['Referrer-Policy'] = props.referrerPolicy;
      const listed = [...fromSource(), ...srcSources(props)];
      const one = fromSource()[0];
      return {
        ...hostProps(props, { accessible: props.alt !== undefined }, [
          'src',
          'srcSet',
          'alt',
          'crossOrigin',
          'referrerPolicy',
        ]),
        accessibilityLabel: props.accessibilityLabel ?? props['aria-label'] ?? props.alt,
        source: withHeaders(listed, headers),
        intrinsicSize:
          !props.src &&
          !props.srcSet &&
          !Array.isArray(props.source) &&
          one?.width !== undefined &&
          one.height !== undefined
            ? { width: one.width, height: one.height }
            : undefined,
      };
    },
    true,
  );
  props.ref?.(createNativeRef(node));
  return node;
}
