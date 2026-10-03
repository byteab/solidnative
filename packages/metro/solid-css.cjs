const { compileCss } = require('./css/compile.cjs');

/** Explicit data imports; ordinary CSS and CSS modules remain owned by Expo. */
const isNativeCss = (filename) => /\.native\.css$/.test(filename);

function transformNativeCss(source, filename, options = {}) {
  if (options.platform === 'web')
    throw new Error(
      'A native stylesheet requires the native host; web stylesheet parity is pending.',
    );
  const sheet = compileCss(source, filename, {
    platform: options.platform,
    onUnsupported:
      options.onUnsupported ?? ((message) => console.warn(`[solid-native] ${message}`)),
  });
  // Font source markers must become static requires so Metro owns their asset graph edges.
  const literal = JSON.stringify(sheet).replace(
    /\{"asset":("(?:[^"\\]|\\.)*")\}/g,
    (_, asset) => `require(${asset})`,
  );
  return { code: `export default ${literal};` };
}

module.exports = { isNativeCss, transformNativeCss };
