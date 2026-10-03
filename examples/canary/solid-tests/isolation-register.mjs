import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { registerHooks } from 'node:module';

// Test the consumer through public native entries. The build-time compiler is a separate hook.
registerHooks({
  load(url, context, nextLoad) {
    if (url.startsWith('file:') && url.endsWith('.png')) {
      // Real asset existence is checked; Node has no Metro asset registry.
      const bytes = readFileSync(fileURLToPath(url));
      if (bytes.toString('hex', 0, 8) !== '89504e470d0a1a0a') throw new Error('Invalid PNG');
      return {
        format: 'commonjs',
        source: `module.exports = ${JSON.stringify({ uri: url, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) })}`,
        shortCircuit: true,
      };
    }
    const result = nextLoad(url, context);
    if (
      url.endsWith('/tabs/tabs.solid.tsx') ||
      url.endsWith('/components/primitives.solid.tsx') ||
      url.endsWith('/expo/expo.solid.tsx')
    )
      return {
        ...result,
        source:
          "import { createRequire as __assetRequire } from 'node:module'; const require = __assetRequire(import.meta.url);\n" +
          result.source,
      };
    return result;
  },
  resolve(specifier, context, nextResolve) {
    if (/^(?:react$|react\/|react-native$|react-native\/|solid-js\/web(?:$|\/))/.test(specifier))
      throw new Error(`A Solid canary runtime imported a forbidden wrapper: ${specifier}`);
    return nextResolve(specifier, context);
  },
});
