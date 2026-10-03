import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { registerHooks } from 'node:module';

const audio = new Map();

// Test the app through public native entries. The build-time compiler is a separate hook.
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
    if (url.startsWith('file:') && url.endsWith('.m4a')) {
      // An MPEG-4 container: `ftyp` at byte 4. Metro would hand back an asset id; so does this.
      const bytes = readFileSync(fileURLToPath(url));
      if (bytes.toString('ascii', 4, 8) !== 'ftyp') throw new Error('Invalid M4A');
      if (!audio.has(url)) audio.set(url, audio.size + 1);
      return {
        format: 'commonjs',
        source: `module.exports = ${audio.get(url)}`,
        shortCircuit: true,
      };
    }
    const result = nextLoad(url, context);
    if (url.endsWith('/catalogue/catalogue.solid.ts') || url.endsWith('/app/tabs.solid.tsx'))
      return {
        ...result,
        source:
          "import { createRequire as __assetRequire } from 'node:module'; const require = __assetRequire(import.meta.url);\n" +
          String(result.source),
      };
    return result;
  },
  resolve(specifier, context, nextResolve) {
    if (
      /^(?:react$|react\/|react-native$|react-native\/|solid-js\/web(?:$|\/)|expo-audio$|expo-keep-awake$)/.test(
        specifier,
      )
    )
      throw new Error(`A Solid music runtime imported a forbidden wrapper: ${specifier}`);
    return nextResolve(specifier, context);
  },
});
