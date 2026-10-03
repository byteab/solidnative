/**
 * Explicit opt-in during migration:
 * withSolidNative(getDefaultConfig(__dirname))
 *
 * Author .tsx/.jsx files use a leading @jsxImportSource @solidnative/platform/solid comment,
 * or a .solid.tsx/.solid.jsx suffix. React/Flow dependencies remain Expo-owned.
 * Non-JSX .solid.ts/.solid.js author helpers opt into clean reload with Expo-owned syntax.
 * The initial native slice selects production Solid client modules in every mode.
 * Development also requires the per-file Expo Babel override documented in solid-babel.cjs;
 * withSolidNative alone cannot disable Expo's React Refresh registrations.
 * Explicit .native.css imports yield native stylesheet data. Restart Metro after compiler edits.
 */
const path = require('node:path');
const { readFileSync } = require('node:fs');
const { createRequire } = require('node:module');
const { createSolidRuntime } = require('./solid-runtime.cjs');
const { solidCompilerFingerprint } = require('./solid-cache.cjs');

function nativePluginVersions(projectRoot) {
  const appRequire = createRequire(path.join(projectRoot, 'package.json'));
  return ['react-native-worklets', 'react-native-reanimated'].map((name) => {
    try {
      return `${name}:${JSON.parse(readFileSync(appRequire.resolve(`${name}/package.json`), 'utf8')).version}`;
    } catch (error) {
      if (error.code === 'MODULE_NOT_FOUND') return `${name}:absent`;
      throw error;
    }
  });
}

/**
 * `compilerOptions.customConditions` from the project's own `tsconfig.json`, or none. Only that
 * file, not its `extends`: the Nx generator writes the workspace's conditions into it.
 */
function tsconfigConditions(projectRoot) {
  try {
    const text = readFileSync(path.join(projectRoot, 'tsconfig.json'), 'utf8');
    const conditions = JSON.parse(withoutJsonComments(text)).compilerOptions?.customConditions;
    return Array.isArray(conditions) ? conditions : [];
  } catch {
    return [];
  }
}

/** A tsconfig as plain JSON: tsc allows comments and trailing commas, strict JSON throws on both. */
function withoutJsonComments(text) {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const end = pastStringOrComment(text, i);
    if (end === i) out += text[i];
    else if (text[i] === '"') out += text.slice(i, end);
    else out += ' ';
    if (end !== i) i = end - 1;
  }
  // Comments are gone, so every comma outside a string is structural.
  let json = '';
  for (let i = 0; i < out.length; i++) {
    const end = pastStringOrComment(out, i);
    if (end !== i) {
      json += out.slice(i, end);
      i = end - 1;
    } else if (out[i] !== ',' || !/^\s*[}\]]/.test(out.slice(i + 1))) {
      json += out[i];
    }
  }
  return json;
}

/** Index just past the string or comment starting at `at`, or `at` itself when neither does. */
function pastStringOrComment(text, at) {
  if (text[at] === '"') {
    for (let i = at + 1; i < text.length; i++) {
      if (text[i] === '\\') i++;
      else if (text[i] === '"') return i + 1;
    }
    return text.length;
  }
  if (text.startsWith('//', at)) {
    const end = text.indexOf('\n', at);
    return end === -1 ? text.length : end;
  }
  if (text.startsWith('/*', at)) {
    const end = text.indexOf('*/', at + 2);
    return end === -1 ? text.length : end + 2;
  }
  return at;
}

function solidResolver(base, runtime, projectRoot) {
  const next = base.resolveRequest;
  // The conditions the app's tsconfig resolves packages with, so Metro takes the same entry tsc
  // does (Nx exports a library's source only under one). `react-native` is Metro's own already.
  const named = base.unstable_conditionNames ?? [];
  const conditions = tsconfigConditions(projectRoot).filter(
    (condition) => condition !== 'react-native' && !named.includes(condition),
  );
  return {
    ...base,
    ...(conditions.length ? { unstable_conditionNames: [...named, ...new Set(conditions)] } : {}),
    sourceExts: [...new Set([...(base.sourceExts ?? []), 'tsx', 'jsx', 'css'])],
    ...(base.assetExts
      ? { assetExts: base.assetExts.filter((extension) => extension !== 'css') }
      : {}),
    resolveRequest(context, name, platform) {
      if (platform !== 'web') {
        const filePath = runtime.resolve(name);
        if (filePath) return { type: 'sourceFile', filePath };
        if (name === 'solid-js/web' || name.startsWith('solid-js/web/'))
          throw new Error('solid-js/web is not a native host runtime.');
      }
      const resolve = next ?? context.resolveRequest;
      try {
        return resolve(context, name, platform);
      } catch (error) {
        if (!/^\.{1,2}\/.*\.[mc]?js$/.test(name)) throw error;
        try {
          return resolve(context, name.replace(/\.[mc]?js$/, ''), platform);
        } catch {
          throw error;
        }
      }
    },
  };
}

/** Monorepo wiring: the framework packages live outside the app's own node_modules. */
function workspaceFolders(config, resolver, projectRoot, workspaceRoot) {
  if (!workspaceRoot) return { resolver };
  return {
    watchFolders: [...new Set([...(config.watchFolders ?? []), path.resolve(workspaceRoot)])],
    resolver: {
      ...resolver,
      nodeModulesPaths: [
        path.resolve(projectRoot, 'node_modules'),
        path.resolve(workspaceRoot, 'node_modules'),
      ],
    },
  };
}

function withSolidNative(config, options = {}) {
  if (config.transformer?.unstable_disableModuleWrapping)
    throw new Error('Native Solid clean reload requires Metro module wrapping.');
  const projectRoot = path.resolve(options.projectRoot ?? config.projectRoot ?? process.cwd());
  const runtime = createSolidRuntime(projectRoot);
  const resolver = solidResolver(config.resolver ?? {}, runtime, projectRoot);
  const transformer = {
    ...config.transformer,
    babelTransformerPath: require.resolve('./solid-transformer.cjs'),
    cacheVersion: [
      config.transformer?.cacheVersion,
      solidCompilerFingerprint(),
      `solid-js:${runtime.version}:production-client`,
      ...nativePluginVersions(projectRoot),
    ]
      .filter(Boolean)
      .join('-'),
  };
  // Wrap only Expo's known worker: a third-party worker keeps its own dispatch contract.
  const expoWorker =
    /(?:^|[\\/])@expo[\\/]metro-config[\\/]build[\\/]transform-worker[\\/]transform-worker\.js$/.test(
      config.transformerPath ?? '',
    );
  if (expoWorker)
    transformer.solidNativeUpstreamTransformer = path.relative(projectRoot, config.transformerPath);
  return {
    ...config,
    projectRoot,
    transformer,
    ...(expoWorker ? { transformerPath: require.resolve('./solid-worker.cjs') } : {}),
    // `serializer` is the app's own, untouched: Solid adds no polyfill, and keeps any it has.
    ...workspaceFolders(config, resolver, projectRoot, options.workspaceRoot),
  };
}

module.exports = { withSolidNative };
