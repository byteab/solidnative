import type { Plugin } from 'vite';

/**
 * The Vite plugin that lets Vitest run solidnative's Solid code in Node: Solid TSX and `.native.css`
 * compiled as Metro compiles them, `solid-js`'s client build, asset requires as `{ testUri }`, and
 * stand-ins for the native gesture and animation libraries.
 */
export declare function solidNative(): Plugin;
