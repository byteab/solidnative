const path = require('node:path');
const { TraceMap, originalPositionFor } = require('@jridgewell/trace-mapping');
const { transformSolid, isSolidSource, isSolidReloadSource } = require('./solid-transform.cjs');
const { solidCompilerFingerprint } = require('./solid-cache.cjs');
const { isNativeCss, transformNativeCss } = require('./solid-css.cjs');
const { addSolidReloadBoundary } = require('./solid-reload.cjs');
const { inlineIcons } = require('./inline-icons.cjs');
const {
  isSolidDomSource,
  isSolidDomComponent,
  transformSolidDom,
  domComponentReference,
} = require('./solid-dom.cjs');

function expoTransformer() {
  const id = '@expo/metro-config/build/babel-transformer';
  try {
    return require(id);
  } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') throw error;
    const expoRoot = path.dirname(require.resolve('expo/package.json', { paths: [process.cwd()] }));
    return require(require.resolve(id, { paths: [expoRoot] }));
  }
}

/** Metro generates maps from AST locations, so compose the first pass into those locations. */
function remapPositions(node, tracer) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const child of node) remapPositions(child, tracer);
    return;
  }
  if (node.loc?.start && node.loc?.end) {
    node.loc = originalLocation(node.loc, tracer);
    // Offsets still refer to intermediate JavaScript; downstream must use mapped locations.
    delete node.start;
    delete node.end;
  }
  for (const key of Object.keys(node)) if (key !== 'loc') remapPositions(node[key], tracer);
}

function originalLocation(loc, tracer) {
  const start = originalPositionFor(tracer, loc.start);
  if (start.line == null) return null;
  const end = originalPositionFor(tracer, loc.end);
  return {
    start: { line: start.line, column: start.column },
    end:
      end.line == null
        ? { line: start.line, column: start.column }
        : { line: end.line, column: end.column },
    filename: start.source,
    identifierName: loc.identifierName,
  };
}

function hasReactRefresh(node) {
  if (!node || typeof node !== 'object') return false;
  if (node.type === 'Identifier' && /^\$Refresh(?:Reg|Sig)\$$/.test(node.name)) return true;
  return Object.entries(node).some(
    ([key, value]) =>
      key !== 'loc' &&
      (Array.isArray(value) ? value.some(hasReactRefresh) : hasReactRefresh(value)),
  );
}

const upstream = expoTransformer();

function withReloadBoundary(result, params) {
  if (hasReactRefresh(result.ast))
    throw new Error(
      'Native Solid cannot use React Refresh. Add an Expo Babel override with enableReactFastRefresh: false for opted-in Solid files and helpers (see solid-babel.cjs). Solid edits require a clean native reload.',
    );
  if (params.options.dev && result.ast) addSolidReloadBoundary(result.ast, params.filename);
  return result;
}

function transformHelper(params) {
  const result = upstream.transform(params);
  return params.options.dev &&
    params.options.platform !== 'web' &&
    isSolidReloadSource(params.src, params.filename)
    ? withReloadBoundary(result, params)
    : result;
}

module.exports = {
  ...upstream,
  getCacheKey(...args) {
    return `${upstream.getCacheKey?.(...args) ?? ''}:${solidCompilerFingerprint()}`;
  },
  transform(params) {
    if (isSolidDomComponent(params.src) && params.options.platform !== 'web') {
      const { code, reference } = domComponentReference(params.filename, params.options);
      const result = upstream.transform({ ...params, src: code });
      result.metadata = { ...result.metadata, expoDomComponentReference: reference };
      return result;
    }
    // Before any other stage, so the `lucide-static` module never enters the graph.
    params = { ...params, src: inlineIcons(params.src, params.filename) };
    if (isSolidDomSource(params.src, params.filename)) {
      if (params.options.platform !== 'web')
        throw new Error('Solid DOM helpers must stay inside a use dom page.');
      const { code, map } = transformSolidDom(params.src, params.filename);
      const result = upstream.transform({ ...params, src: code });
      if (result.ast) remapPositions(result.ast, new TraceMap(map));
      if (hasReactRefresh(result.ast))
        throw new Error('Solid DOM cannot use React Refresh; use the isSolidFile Babel override.');
      return result;
    }
    if (params.options.platform !== 'web' && isNativeCss(params.filename)) {
      const { code } = transformNativeCss(params.src, params.filename, params.options);
      return withReloadBoundary(upstream.transform({ ...params, src: code }), params);
    }
    if (!isSolidSource(params.src, params.filename)) return transformHelper(params);
    const { code, map } = transformSolid(params.src, params.filename, params.options);
    const result = upstream.transform({ ...params, src: code });
    if (result.ast) remapPositions(result.ast, new TraceMap(map));
    return withReloadBoundary(result, params);
  },
};
