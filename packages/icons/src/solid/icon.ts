import { createComponent, createContext, createMemo, useContext, type Accessor } from 'solid-js';
import { claimHost, type HostNode } from '@solid-native/fabric';
import {
  createHostElement,
  insertHostChildren,
  spreadHostProps,
  useHostEngine,
  type HostChild,
} from '@solid-native/platform/solid';
import { createNativeRef, hostProps, type ViewProps } from '@solid-native/components/solid';
import { parseSvg, type SvgNode } from '../parse-svg.ts';
import { registerSvgComponents } from '../svg-elements.ts';
import { SVG_ELEMENTS, nativeProps, styleAttributes, viewBoxProps } from '../svg-props.ts';
export type IconSet = Readonly<Record<string, string>>;
export interface IconProviderProps {
  icons: IconSet;
  children?: HostChild;
}
export interface IconProps extends Omit<ViewProps, 'children'> {
  name?: string;
  svg?: string;
  size?: number | string;
  color?: string;
  strokeWidth?: number | string;
}
interface Icons {
  readonly own: Accessor<IconSet>;
  readonly parent?: Icons;
}
const context = createContext<Icons>();
export function IconProvider(props: IconProviderProps): HostChild {
  const parent = useContext(context);
  return createComponent(context.Provider, {
    value: { own: () => props.icons, parent },
    get children() {
      return props.children as never;
    },
  }) as HostChild;
}
function propertyName(name: string): string {
  return name
    .replace(/([^a-zA-Z0-9])+(.)?/g, (_, __, character: string | undefined) =>
      character ? character.toUpperCase() : '',
    )
    .replace(/[^a-zA-Z\d]/g, '')
    .replace(/^([A-Z])/, (match) => match.toLowerCase());
}
export function Icon(props: IconProps): HostNode {
  const icons = useContext(context);
  const engine = useHostEngine();
  registerSvgComponents();
  const host = createHostElement('svg-icon');
  claimHost(host);
  const markup = createMemo(() => {
    if (props.svg !== undefined) return props.svg;
    if (!props.name) return undefined;
    const key = propertyName(props.name);
    // `chevron-down` finds `chevronDown`, or `ChevronDown` as lucide-static exports it.
    const pascal = key.charAt(0).toUpperCase() + key.slice(1);
    for (let scope = icons; scope; scope = scope.parent) {
      const value = scope.own()[key] ?? scope.own()[pascal];
      if (value) return value;
    }
    return undefined;
  });
  const root = createMemo(() => {
    const svg = markup();
    return svg === undefined ? null : parseSvg(svg);
  });
  const size = () => {
    const value = Number(props.size ?? 24);
    return Number.isFinite(value) ? value : 24;
  };
  spreadHostProps(
    host,
    () => ({
      ...hostProps(
        props,
        {
          accessible: (props.accessibilityLabel ?? props['aria-label']) !== undefined,
          role:
            (props.accessibilityLabel ?? props['aria-label']) === undefined ? undefined : 'image',
        },
        ['name', 'svg', 'size', 'strokeWidth'],
      ),
      style: [props.style, { width: size(), height: size() }],
      color: props.color,
      bbWidth: size(),
      bbHeight: size(),
      ...viewBoxProps(root()?.attrs['viewBox']),
    }),
    true,
  );
  const shape = (element: string, data: SvgNode, isRoot = false): HostNode => {
    const node = createHostElement(element);
    claimHost(node);
    spreadHostProps(
      node,
      () =>
        nativeProps(
          data.tag,
          {
            ...data.attrs,
            ...styleAttributes(data.attrs['style'] ?? ''),
            // The root's stroke width is the icon's, and every shape without its own inherits it.
            ...(isRoot && props.strokeWidth !== undefined
              ? { 'stroke-width': String(props.strokeWidth) }
              : {}),
          },
          { color: (value) => engine.color(value) },
        ),
      true,
    );
    insertHostChildren(
      node,
      data.children.flatMap((child) => {
        const name = SVG_ELEMENTS[child.tag];
        return name ? [shape(name, child)] : [];
      }),
    );
    return node;
  };
  // Only markup changes replace shapes; color, size and stroke width retain native identity.
  const drawing = createMemo(() => {
    const data = root();
    return data ? shape('svg-g', data, true) : null;
  });
  insertHostChildren(host, drawing);
  props.ref?.(createNativeRef(host));
  return host;
}
