const path = require('node:path');
const { isNativeCss } = require('./solid-css.cjs');
const { isSolidReloadSource } = require('./solid-transform.cjs');
const { solidDomPage } = require('./solid-dom.cjs');

function upstreamPath(config, projectRoot) {
  return path.resolve(projectRoot, config.solidNativeUpstreamTransformer);
}

/** Expo otherwise replaces every native CSS module with an empty module before Babel. */
module.exports = {
  transform(config, projectRoot, filename, data, options) {
    const upstream = upstreamPath(config, projectRoot);
    const page = solidDomPage(path.resolve(projectRoot, filename), options);
    if (page)
      return require(path.join(path.dirname(upstream), 'metro-transform-worker')).transform(
        config,
        projectRoot,
        filename,
        page,
        options,
      );
    const ours = options.platform !== 'web' && options.type !== 'asset' && isNativeCss(filename);
    if (
      options.dev &&
      (ours || isSolidReloadSource(data.toString(), filename)) &&
      (config.unstable_disableModuleWrapping ||
        String(options.customTransformOptions?.optimize) === 'true')
    )
      throw new Error(
        'Native Solid clean reload requires Metro module wrapping; disable unwrapped/optimized development output.',
      );
    const worker = ours ? path.join(path.dirname(upstream), 'metro-transform-worker') : upstream;
    return require(worker).transform(config, projectRoot, filename, data, options);
  },
  getCacheKey(config, context) {
    const upstream = require(upstreamPath(config, context.projectRoot));
    return upstream.getCacheKey?.(config, context) ?? '';
  },
};
