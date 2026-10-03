/** Universal native JSX compiler. Expo owns the subsequent native Babel pass. */
const babel = require('@babel/core');

const IMPORT_SOURCE = '@solidnative/platform/solid';
const PRAGMA = /@jsxImportSource[\t ]+@solidnative\/platform\/solid(?=[\s*]|$)/;

/** Explicit author opt-in: a header pragma or the .solid.tsx/.solid.jsx suffix. */
function isSolidSource(source, filename) {
  if (!/\.[jt]sx$/i.test(filename) || /(?:^|[\\/])node_modules(?:[\\/]|$)/.test(filename))
    return false;
  if (/\.solid\.[jt]sx$/i.test(filename)) return true;
  // Only leading comments count. Strings containing a pragma must not opt React code in.
  const header = source.match(/^(?:\s|\/\/[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)*/)?.[0] ?? '';
  return PRAGMA.test(header);
}

/** Non-JSX author helpers opt into clean reload while Expo retains their syntax transform. */
function isSolidReloadSource(source, filename) {
  if (/(?:^|[\\/])node_modules(?:[\\/]|$)/.test(filename)) return false;
  return /\.solid\.[jt]s$/i.test(filename) || isSolidSource(source, filename);
}

/** @returns {{ code: string, map: object }} Plain ESM with authored TSX source positions. */
function transformSolid(source, filename, options = {}) {
  if (options.platform === 'web')
    throw new Error(
      'Native Solid JSX cannot target web; a browser host compiler is not implemented.',
    );
  const result = babel.transformSync(source, {
    filename,
    sourceFileName: filename,
    babelrc: false,
    configFile: false,
    sourceType: 'module',
    sourceMaps: true,
    comments: true,
    presets: [
      [
        require('babel-preset-solid'),
        {
          generate: 'universal',
          moduleName: IMPORT_SOURCE,
          // The native slice uses one production client graph, including in development.
          dev: false,
        },
      ],
    ],
    plugins: [
      // `lowerPrimitives: false` keeps every View and Text a component, for comparing the two.
      ...(options.lowerPrimitives === false
        ? []
        : [[require('./solid-lower.cjs'), { platform: options.platform }]]),
      [
        require('@babel/plugin-transform-typescript'),
        {
          isTSX: true,
          allExtensions: true,
          allowDeclareFields: true,
          onlyRemoveTypeImports: true,
        },
      ],
    ],
  });
  if (!result?.code || !result.map) throw new Error(`No Solid compiler output for ${filename}`);
  return { code: result.code, map: result.map };
}

module.exports = { IMPORT_SOURCE, isSolidSource, isSolidReloadSource, transformSolid };
