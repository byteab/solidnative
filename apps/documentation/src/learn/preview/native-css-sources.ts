/**
 * The native CSS compiler's CommonJS files, as text, for `native-css.ts` to run. A module of their
 * own so they download with the WebAssembly, when there is CSS to check, rather than with the frame.
 */
import colorSpacesSource from '@solidnative/metro/css/color-spaces.cjs?raw';
import colourExpressionSource from '@solidnative/metro/css/colour-expression.cjs?raw';
import tokenArithmeticSource from '@solidnative/metro/css/token-arithmetic.cjs?raw';
import compileSource from '@solidnative/metro/css/compile.cjs?raw';
import filtersSource from '@solidnative/metro/css/filters.cjs?raw';
import gradientsSource from '@solidnative/metro/css/gradients.cjs?raw';
import propertiesSource from '@solidnative/metro/css/properties.cjs?raw';
import shorthandsSource from '@solidnative/metro/css/shorthands.cjs?raw';
import valuesSource from '@solidnative/metro/css/values.cjs?raw';
import flattenSource from '@solidnative/tailwind/flatten.cjs?raw';

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
