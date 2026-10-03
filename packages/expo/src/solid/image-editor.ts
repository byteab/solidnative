import { expoModule } from '../native.ts';
import { ownedRequests, silence, sourcedService } from './owned.ts';

export const SaveFormat = { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' } as const;
export type SaveFormat = (typeof SaveFormat)[keyof typeof SaveFormat];
export const FlipType = { Vertical: 'vertical', Horizontal: 'horizontal' } as const;
export type FlipType = (typeof FlipType)[keyof typeof FlipType];
export interface ImageResult {
  uri: string;
  width: number;
  height: number;
  base64?: string;
}
export interface SaveOptions {
  base64?: boolean;
  compress?: number;
  format?: SaveFormat;
}
export type Action =
  | { resize: { width?: number; height?: number } }
  | { rotate: number }
  | { flip: FlipType }
  | { crop: CropRect }
  | { extent: ExtentOptions };
export interface CropRect {
  originX: number;
  originY: number;
  width: number;
  height: number;
}
export interface ExtentOptions {
  backgroundColor?: string | null;
  originX?: number;
  originY?: number;
  width: number;
  height: number;
}
export interface ImageRef {
  width: number;
  height: number;
  saveAsync(options?: SaveOptions): Promise<ImageResult>;
  release(): void;
}
export interface ImageManipulatorContext {
  resize(size: { width?: number | null; height?: number | null }): ImageManipulatorContext;
  rotate(degrees: number): ImageManipulatorContext;
  flip(direction: FlipType): ImageManipulatorContext;
  crop(rect: CropRect): ImageManipulatorContext;
  extent?(options: ExtentOptions): ImageManipulatorContext;
  reset(): ImageManipulatorContext;
  renderAsync(): Promise<ImageRef>;
  release(): void;
}
export interface NativeImageEditor {
  ImageManipulator: { manipulate(source: string): ImageManipulatorContext };
}
export interface ImageEditor {
  edit(
    source: string,
    actions?: readonly Action[],
    options?: SaveOptions,
  ): Promise<ImageResult | null>;
  /** Caller owns and releases this context and every image it renders. */
  manipulate(source: string): ImageManipulatorContext | null;
}
export const ImageEditor = sourcedService<ImageEditor, NativeImageEditor | null>(
  'expo.imageEditor',
  () =>
    expoModule(
      'expo-image-manipulator',
      () => require('expo-image-manipulator') as NativeImageEditor,
    ),
  (native) => {
    const requests = ownedRequests();
    return {
      manipulate: (source) => {
        if (!requests.active()) return null;
        const context = native?.ImageManipulator.manipulate(source) ?? null;
        if (requests.active()) return context;
        silence(() => context?.release());
        return null;
      },
      edit: (source, actions = [], options = {}) =>
        requests.run<ImageResult | null>(null, async (active) => {
          const context = native?.ImageManipulator.manipulate(source);
          if (!context) return null;
          let image: ImageRef | undefined;
          try {
            if (!active()) return null;
            for (const action of actions) {
              apply(context, action);
              if (!active()) return null;
            }
            image = await context.renderAsync();
            if (!active()) return null;
            return await image.saveAsync({ format: SaveFormat.JPEG, ...options });
          } finally {
            // Independent cleanup preserves the primary operation error and releases both handles.
            silence(() => context.release());
            silence(() => image?.release());
          }
        }),
    };
  },
);
function apply(context: ImageManipulatorContext, action: Action): void {
  if ('resize' in action) context.resize(action.resize);
  else if ('rotate' in action) context.rotate(action.rotate);
  else if ('flip' in action) context.flip(action.flip);
  else if ('crop' in action) context.crop(action.crop);
  else if ('extent' in action) context.extent?.(action.extent);
}
