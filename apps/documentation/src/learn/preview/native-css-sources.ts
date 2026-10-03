/**
 * The native CSS compiler's CommonJS files, as text, for `native-css.ts` to run. A module of their
 * own so they download with the WebAssembly, when there is CSS to check, rather than with the frame.
 */
import colorSpacesSource from '@solid-native/metro/css/color-spaces.cjs?raw';
import colourExpressionSource from '@solid-native/metro/css/colour-expression.cjs?raw';
import tokenArithmeticSource from '@solid-native/metro/css/token-arithmetic.cjs?raw';
import compileSource from '@solid-native/metro/css/compile.cjs?raw';
import filtersSource from '@solid-native/metro/css/filters.cjs?raw';
import gradientsSource from '@solid-native/metro/css/gradients.cjs?raw';
import propertiesSource from '@solid-native/metro/css/properties.cjs?raw';
import shorthandsSource from '@solid-native/metro/css/shorthands.cjs?raw';
import valuesSource from '@solid-native/metro/css/values.cjs?raw';
import flattenSource from '@solid-native/tailwind/flatten.cjs?raw';

export const SOURCES: Readonly<Record<string, string>> = {
  './compile.cjs': compileSource,
  './values.cjs': valuesSource,
  './color-spaces.cjs': colorSpacesSource,
  './colour-expression.cjs': colourExpressionSource,
  './token-arithmetic.cjs': tokenArithmeticSource,
  './properties.cjs': propertiesSource,
  './gradients.cjs': gradientsSource,
  './shorthands.cjs': shorthandsSource,
  './filters.cjs': filtersSource,
  './flatten.cjs': flattenSource,
};
